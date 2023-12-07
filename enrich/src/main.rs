mod async_rwlockhashmap;

#[macro_use] extern crate rocket;
use async_lock::RwLock;
use futures::StreamExt;
use rocket::http::ContentType;
use std::future;
use std::io::Cursor;
use rocket::request::Request;
use rocket::response::{self, Response, Responder, stream::TextStream};
use rocket_db_pools::{Database, Connection};
use rocket_db_pools::sqlx::{self, Row};
use std::collections::HashMap;
use rayon::prelude::*;
use uuid::Uuid;
use fishers_exact::fishers_exact;
use adjustp::{adjust, Procedure};
use rocket::{State, response::status::Custom, http::Status};
use rocket::serde::{json::{json, Json, Value}, Serialize};
use std::sync::Arc;
use retainer::Cache;
use std::time::Instant;
use fnv::FnvHashSet;

use async_rwlockhashmap::RwLockHashMap;

/**
 * Without this alternative allocator, very large chunks of memory do not get released back to the OS causing a large memory footprint over time.
 */
#[global_allocator]
static GLOBAL: tikv_jemallocator::Jemalloc = tikv_jemallocator::Jemalloc;

#[derive(Database)]
#[database("postgres")]
struct Postgres(sqlx::PgPool);

struct Bitmap {
    columns: HashMap<Uuid, u32>,
    columns_str: Vec<String>,
    values: Vec<(Uuid, String, FnvHashSet<u32>)>,
}

impl Bitmap {
    fn new() -> Self {
        Bitmap {
            columns: HashMap::new(),
            columns_str: Vec::new(),
            values: Vec::new(),
        }
    }
}

#[derive(Eq, PartialEq)]
struct BackgroundQuery {
    background_id: Uuid,
    input_gene_set: FnvHashSet<u32>,
}

impl PartialOrd for BackgroundQuery {
    fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> {
        match self.background_id.partial_cmp(&other.background_id) {
            Some(cmp) if cmp != std::cmp::Ordering::Equal => Some(cmp),
            _ => self.input_gene_set.iter().collect::<Vec<&u32>>().partial_cmp(
                &other.input_gene_set.iter().collect::<Vec<&u32>>()
            ),
        }
    }
}

impl Ord for BackgroundQuery {
    fn cmp(&self, other: &Self) -> std::cmp::Ordering {
        match self.background_id.cmp(&other.background_id) {
            std::cmp::Ordering::Equal => self.input_gene_set.iter().collect::<Vec<&u32>>().cmp(
                &other.input_gene_set.iter().collect::<Vec<&u32>>()
            ),
            cmp => cmp,
        }
    }
}

// This structure stores a persistent many-reader single-writer hashmap containing cached indexes for a given background id
struct PersistentState { 
    bitmaps: RwLockHashMap<Uuid, Bitmap>,
    latest: RwLock<Option<Uuid>>,
    cache: Cache<Arc<BackgroundQuery>, Arc<Vec<PartialQueryResult>>>,
}

// The response data, containing the ids, and relevant metrics
struct PartialQueryResult {
    index: usize,
    n_overlap: u32,
    odds_ratio: f64,
    pvalue: f64,
    adj_pvalue: f64,
}

#[derive(Serialize, Debug)]
struct QueryResult {
    gene_set_id: String,
    n_overlap: u32,
    odds_ratio: f64,
    pvalue: f64,
    adj_pvalue: f64,
}

struct QueryResponse {
    results: Vec<QueryResult>,
    content_range: (usize, usize, usize),
}

#[rocket::async_trait]
impl<'r> Responder<'r, 'static> for QueryResponse {
    fn respond_to(self, _: &'r Request<'_>) -> response::Result<'static> {
        let json = rocket::serde::json::serde_json::to_string(&self.results).unwrap();
        Response::build()
            .header(ContentType::JSON)
            .raw_header("Range-Unit", "items")
            .raw_header("Content-Range", format!("{}-{}/{}", self.content_range.0, self.content_range.1, self.content_range.2))
            .sized_body(json.len(), Cursor::new(json))
            .ok()
    }
}

fn bitvec(background: &HashMap<Uuid, u32>, gene_set: Vec<Uuid>) -> FnvHashSet<u32> {
    gene_set.iter().filter_map(|gene_id| Some(*background.get(gene_id)?)).collect()
}

// Ensure the specific background_id exists in state, resolving it if necessary
async fn ensure_index(db: &mut Connection<Postgres>, state: &State<PersistentState>, background_id: Uuid) -> Result<(), String> {
    if state.bitmaps.contains_key(&background_id).await {
        return Ok(())
    }

    println!("[{}] initializing", background_id);
    let start = Instant::now();
    {
        // this lets us write a new bitmap by only blocking the whole hashmap for a short period to register the new bitmap
        // after which we block the new empty bitmap for writing
        let mut bitmap = state.bitmaps.insert_write(background_id, Bitmap::new()).await;

        let background_info = sqlx::query("select id, species, (select jsonb_object_agg(g.id, g.symbol) from jsonb_each(gene_ids) bg(gene_id, nil) inner join app_public_v2.gene g on bg.gene_id::uuid = g.id) as genes from app_public_v2.background b where id = $1::uuid;")
            .bind(background_id.to_string())
            .fetch_one(&mut **db).await.map_err(|e| e.to_string())?;

        let background_genes: sqlx::types::Json<HashMap<String, String>> = background_info.try_get("genes").map_err(|e| e.to_string())?;
        let species: String = background_info.try_get("species").map_err(|e| e.to_string())?;
        let mut background_genes = background_genes.iter().map(|(id, symbol)| Ok((Uuid::parse_str(id).map_err(|e| e.to_string())?, symbol.clone()))).collect::<Result<Vec<_>, String>>()?;
        background_genes.sort_unstable();
        bitmap.columns.reserve(background_genes.len());
        bitmap.columns_str.reserve(background_genes.len());
        for (i, (gene_id, gene)) in background_genes.into_iter().enumerate() {
            bitmap.columns.insert(gene_id, i as u32);
            bitmap.columns_str.push(gene);
        }

        // compute the index in memory
        sqlx::query(format!("select id, term, gene_ids from app_public_v2.gene_set where species = '{}';", species).as_str())
            .fetch(&mut **db)
            .for_each(|row| {
                let row = row.unwrap();
                let gene_set_id: uuid::Uuid = row.try_get("id").unwrap();
                let term: String = row.try_get("term").unwrap();
                let gene_ids: sqlx::types::Json<HashMap<String, sqlx::types::JsonValue>> = row.try_get("gene_ids").unwrap();
                let gene_ids = gene_ids.keys().map(|gene_id| Uuid::parse_str(gene_id).unwrap()).collect::<Vec<Uuid>>();
                let bitset = bitvec(&bitmap.columns, gene_ids);
                bitmap.values.push((gene_set_id, term, bitset));
                future::ready(())
            })
            .await;
    }
    let duration = start.elapsed();
    println!("[{}] initialized in {:?}", background_id, duration);
    {
        let mut latest = state.latest.write().await;
        latest.replace(background_id);
    }
    Ok(())
}

#[get("/<background_id>")]
async fn ensure(
    mut db: Connection<Postgres>,
    state: &State<PersistentState>,
    background_id: &str,
) -> Result<Value, Custom<String>> {
    let background_id = Uuid::parse_str(background_id).map_err(|e| Custom(Status::BadRequest, e.to_string()))?;
    ensure_index(&mut db, &state, background_id).await.map_err(|e| Custom(Status::InternalServerError, e.to_string()))?;
    let bitmap = state.bitmaps.get_read(&background_id).await.ok_or(Custom(Status::NotFound, String::from("Can't find background")))?;
    Ok(json!({
        "columns": bitmap.columns.len(),
        "index": bitmap.values.len(),
    }))
}

/**
 * This is a helper for building a GMT file on the fly, it's much cheaper to do this here
 *  than fetch it from the database, it's also nice since we won't need to save raw files.
 */
#[get("/<background_id>/gmt")]
async fn get_gmt(
    mut db: Connection<Postgres>,
    state: &State<PersistentState>,
    background_id: String,
) -> Result<TextStream![String + '_], Custom<String>> {
    let background_id = {
        if background_id == "latest" {
            let latest = state.latest.read().await;
            latest.clone().ok_or(Custom(Status::NotFound, String::from("Nothing loaded")))?
        } else {
            Uuid::parse_str(&background_id).map_err(|e| Custom(Status::BadRequest, e.to_string()))?
        }
    };
    ensure_index(&mut db, &state, background_id).await.map_err(|e| Custom(Status::InternalServerError, e.to_string()))?;
    let bitmap = state.bitmaps.get_read(&background_id).await.ok_or(Custom(Status::InternalServerError, String::from("Can't find background")))?;
    Ok(TextStream! {
        for (_row_id, row_str, gene_set) in bitmap.values.iter() {
            let mut line = String::new();
            line.push_str(row_str);
            line.push_str("\t");
            for col_ind in gene_set.iter() {
                line.push_str("\t");
                line.push_str(&bitmap.columns_str[*col_ind as usize]);
            }
            line.push_str("\n");
            yield line
        }
    })
}

#[delete("/<background_id>")]
async fn delete(
    state: &State<PersistentState>,
    background_id: &str,
) -> Result<(), Custom<String>> {
    let background_id = {
        if background_id == "latest" {
            let latest = state.latest.read().await;
            latest.clone().ok_or(Custom(Status::NotFound, String::from("Nothing loaded")))?
        } else {
            Uuid::parse_str(&background_id).map_err(|e| Custom(Status::BadRequest, e.to_string()))?
        }
    };
    if !state.bitmaps.contains_key(&background_id).await {
        return Err(Custom(Status::NotFound, String::from("Not Found")));
    }
    if state.bitmaps.remove(&background_id).await {
        println!("[{}] deleted", background_id);
    }
    Ok(())
}

// query a specific background_id, providing the bitset vector as input
//  the result are the gene_set_ids & relevant metrics
// this can be pretty fast since the index is saved in memory and the overlaps can be computed in parallel
#[post("/<background_id>?<filter_term>&<overlap_ge>&<pvalue_le>&<adj_pvalue_le>&<offset>&<limit>", data = "<input_gene_set>")]
async fn query(
    mut db: Connection<Postgres>,
    state: &State<PersistentState>,
    input_gene_set: Json<Vec<String>>,
    background_id: &str,
    filter_term: Option<String>,
    overlap_ge: Option<u32>,
    pvalue_le: Option<f64>,
    adj_pvalue_le: Option<f64>,
    offset: Option<usize>,
    limit: Option<usize>,
) -> Result<QueryResponse, Custom<String>> {
    let background_id = {
        if background_id == "latest" {
            let latest = state.latest.read().await;
            latest.clone().ok_or(Custom(Status::NotFound, String::from("Nothing loaded")))?
        } else {
            Uuid::parse_str(&background_id).map_err(|e| Custom(Status::BadRequest, e.to_string()))?
        }
    };
    ensure_index(&mut db, &state, background_id).await.map_err(|e| Custom(Status::InternalServerError, e.to_string()))?;
    let start = Instant::now();
    let input_gene_set = input_gene_set.0.into_iter().map(|gene| Uuid::parse_str(&gene)).collect::<Result<Vec<_>, _>>().map_err(|e| Custom(Status::BadRequest, e.to_string()))?;
    let bitmap = state.bitmaps.get_read(&background_id).await.ok_or(Custom(Status::NotFound, String::from("Can't find background")))?;
    let input_gene_set = bitvec(&bitmap.columns, input_gene_set);
    let filter_term = filter_term.and_then(|filter_term| Some(filter_term.to_lowercase()));
    let overlap_ge = overlap_ge.unwrap_or(1);
    let pvalue_le =  pvalue_le.unwrap_or(1.0);
    let adj_pvalue_le =  adj_pvalue_le.unwrap_or(1.0);
    let background_query = Arc::new(BackgroundQuery { background_id, input_gene_set });
    let results = {
        let results = state.cache.get(&background_query).await;
        if let Some(results) = results {
            results.value().clone()
        } else {
            // parallel overlap computation
            let n_background = bitmap.columns.len() as u32;
            let n_user_gene_id = background_query.input_gene_set.len() as u32;
            let mut results: Vec<_> = bitmap.values.par_iter()
                .enumerate()
                .filter_map(|(index, (_row_id, _row_str, gene_set))| {
                    let n_overlap = gene_set.intersection(&background_query.input_gene_set).count() as u32;
                    if n_overlap < overlap_ge {
                        return None
                    }
                    let n_gs_gene_id = gene_set.len() as u32;
                    let a = n_overlap;
                    let b = n_user_gene_id - a;
                    let c = n_gs_gene_id - a;
                    let d = n_background - b - c + a;
                    let table = [a, b, c, d];
                    let result = fishers_exact(&table).map_err(|e| Custom(Status::InternalServerError, e.to_string())).ok()?;
                    let pvalue = result.greater_pvalue;
                    if pvalue > pvalue_le {
                        return None
                    }
                    let odds_ratio = ((n_overlap as f64) / (n_user_gene_id as f64)) / ((n_gs_gene_id as f64) / (n_background as f64));
                    Some(PartialQueryResult { index, n_overlap, odds_ratio, pvalue, adj_pvalue: 1.0 })
                })
                .collect();
            // extract pvalues from results and compute adj_pvalues
            let mut pvalues = vec![1.0; bitmap.values.len()];
            for result in &results {
                pvalues[result.index] = result.pvalue;
            }
            // add adj_pvalues to results
            let adj_pvalues = adjust(&pvalues, Procedure::BenjaminiHochberg);
            results.retain_mut(|result| {
                if let Some(adj_pvalue) = adj_pvalues.get(result.index) {
                    result.adj_pvalue = *adj_pvalue;
                }
                result.adj_pvalue <= adj_pvalue_le
            });
            results.sort_unstable_by(|a, b| a.pvalue.partial_cmp(&b.pvalue).unwrap_or(std::cmp::Ordering::Equal));
            let results = Arc::new(results);
            state.cache.insert(background_query, results.clone(), 30000).await;
            let duration = start.elapsed();
            println!("[{}] {} genes enriched in {:?}", background_id, n_user_gene_id, duration);
            results
        }
    };
    let mut results: Vec<_> = results
        .iter()
        .filter_map(|result| {
            let (gene_set_id, gene_set_term, _gene_set) = bitmap.values.get(result.index)?;
            if let Some(filter_term) = &filter_term {
                if !gene_set_term.to_lowercase().contains(filter_term) { return None }
            }
            Some(QueryResult {
                gene_set_id: gene_set_id.to_string(),
                n_overlap: result.n_overlap,
                odds_ratio: result.odds_ratio,
                pvalue: result.pvalue,
                adj_pvalue: result.adj_pvalue,
            })
        })
        .collect();
    let range_total = results.len();
    let (range_start, range_end) = match (offset.unwrap_or(0), limit) {
        (0, None) => (0, range_total),
        (offset, None) => {
            if offset < results.len() {
                results.drain(..offset);
            };
            (offset, range_total)
        },
        (offset, Some(limit)) => {
            if offset < results.len() {
                results.drain(..offset);
                if limit < results.len() {
                    results.drain(limit..);
                }
            };
            (offset, offset + results.len())
        },
    };
    Ok(QueryResponse {
        results,
        content_range: (range_start, range_end, range_total),
    })
}

#[launch]
fn rocket() -> _ {
    rocket::build()
        .manage(PersistentState {
            bitmaps: RwLockHashMap::new(),
            latest: RwLock::new(None),
            cache: Cache::new(),
        })
        .attach(Postgres::init())
        .mount("/", routes![ensure, get_gmt, query, delete])
}
