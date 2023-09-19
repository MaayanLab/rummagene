#[macro_use] extern crate rocket;
extern crate bit_set;
use futures::StreamExt;
use rocket::http::ContentType;
use std::io::Cursor;
use rocket::request::Request;
use rocket::response::{self, Response, Responder};
use rocket_db_pools::{Database, Connection};
use rocket_db_pools::sqlx::{self, Row};
use std::collections::HashMap;
use async_std::sync::RwLock;
use rayon::prelude::*;
use uuid::Uuid;
use bit_set::BitSet;
use fishers_exact::fishers_exact;
use adjustp::{adjust, Procedure};
use rocket::{State, response::status::Custom, http::Status};
use rocket::serde::{json::{json, Json, Value}, Serialize};
use std::sync::Arc;
use retainer::Cache;
use std::time::Instant;

#[derive(Database)]
#[database("postgres")]
struct Postgres(sqlx::PgPool);

struct Bitmap {
    columns: HashMap<Uuid, usize>,
    index: Vec<Uuid>,
    values: Vec<BitSet>,
}

#[derive(Clone, Eq, Ord, PartialEq, PartialOrd)]
struct BackgroundQuery {
    background_id: Uuid,
    input_gene_set: BitSet,
}

// This structure stores a persistent many-reader single-writer hashmap containing cached indexes for a given background id
struct PersistentState { 
    bitmaps: RwLock<HashMap<Uuid, Bitmap>>,
    cache: Cache<Arc<BackgroundQuery>, Arc<Vec<Arc<QueryResult>>>>,
}

// The response data, containing the ids, and relevant metrics
struct PartialQueryResult {
    index: usize,
    n_overlap: u32,
    odds_ratio: f64,
    pvalue: f64,
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
    results: Arc<Vec<Arc<QueryResult>>>,
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

fn bitvec(background: &HashMap<Uuid, usize>, gene_set: Vec<Uuid>) -> BitSet {
    BitSet::from_iter(gene_set.iter().filter_map(|gene_id| Some(*background.get(gene_id)?)))
}

// Ensure the specific background_id exists in state, resolving it if necessary
async fn ensure_index(db: &mut Connection<Postgres>, state: &State<PersistentState>, background_id: Uuid) -> Result<(), String> {
    let requires_fetch = {
        let index_reader = state.bitmaps.read().await;
        !(*index_reader).contains_key(&background_id)
    };
    if requires_fetch {
        let mut index_writer = state.bitmaps.write().await;
        println!("[{}] initializing", background_id);
        let start = Instant::now();

        let background_info = sqlx::query("select * from app_public_v2.background where id = $1::uuid;")
            .bind(background_id.to_string())
            .fetch_one(&mut **db).await.map_err(|e| e.to_string())?;
        let background_gene_ids: sqlx::types::Json<HashMap<String, sqlx::types::JsonValue>> = background_info.try_get("gene_ids").map_err(|e| e.to_string())?;
        let mut background_gene_ids = background_gene_ids.keys().map(|gene| Uuid::parse_str(gene)).collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?;
        background_gene_ids.sort_unstable();
        let background_gene_ids: HashMap<Uuid, usize> = background_gene_ids.into_iter().enumerate().map(|(i, gene_id)| (gene_id, i)).collect();

        // compute the index in memory
        let (index, bitmap): (Vec<_>, Vec<_>) = sqlx::query("select id, gene_ids from app_public_v2.gene_set;")
            .fetch(&mut **db)
            .map(|row| {
                let row = row.unwrap();
                let gene_set_id: uuid::Uuid = row.try_get("id").unwrap();
                let gene_ids: sqlx::types::Json<HashMap<String, sqlx::types::JsonValue>> = row.try_get("gene_ids").unwrap();
                let gene_ids = gene_ids.keys().map(|gene_id| Uuid::parse_str(gene_id).unwrap()).collect::<Vec<Uuid>>();
                let bitset = bitvec(&background_gene_ids, gene_ids);
                (gene_set_id, bitset)
            })
            .unzip()
            .await;

        // load pre-computed index into memory
        // let (index, bitmap): (Vec<_>, Vec<_>) = sqlx::query("SELECT gene_set_id, bitvec from app_private_v2.computed_index where background_id = $1::uuid;")
        //     .bind(background_id.to_string())
        //     .fetch(&mut **db)
        //     .map(|row| {
        //         let row = row.unwrap();
        //         let gene_set_id: uuid::Uuid = row.try_get("gene_set_id").unwrap();
        //         let bitset: Vec<u8> = row.get("bitvec");
        //         let bitset = BitSet::from_bit_vec(bit_vec::BitVec::from_bytes(&bitset));
        //         (gene_set_id, bitset)
        //     })
        //     .unzip()
        //     .await;

        index_writer.insert(background_id, Bitmap { columns: background_gene_ids, index, values: bitmap });

        let duration = start.elapsed();
        println!("[{}] initialized in {:?}", background_id, duration);
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
    let index_reader = state.bitmaps.read().await;
    let bitmap = index_reader.get(&background_id).ok_or("Can't find background").map_err(|e| Custom(Status::NotFound, e.to_string()))?;
    Ok(json!({
        "columns": bitmap.columns.len(),
        "index": bitmap.index.len(),
    }))
}

#[delete("/<background_id>")]
async fn delete(
    state: &State<PersistentState>,
    background_id: &str,
) -> Result<(), Custom<String>> {
    let background_id = Uuid::parse_str(background_id).map_err(|e| Custom(Status::BadRequest, e.to_string()))?;
    let requires_delete = {
        let index_reader = state.bitmaps.read().await;
        (*index_reader).contains_key(&background_id)
    };
    if !requires_delete { return Err(Custom(Status::NotFound, String::from("Not Found"))); }
    let mut index_writer = state.bitmaps.write().await;
    index_writer.remove(&background_id);
    println!("[{}] deleted", background_id);
    Ok(())
}

// query a specific background_id, providing the bitset vector as input
//  the result are the gene_set_ids & relevant metrics
// this can be pretty fast since the index is saved in memory and the overlaps can be computed in parallel
#[post("/<background_id>?<overlap_ge>&<pvalue_le>&<adj_pvalue_le>&<offset>&<limit>", data = "<input_gene_set>")]
async fn query(
    mut db: Connection<Postgres>,
    state: &State<PersistentState>,
    input_gene_set: Json<Vec<String>>,
    background_id: &str,
    overlap_ge: Option<u32>,
    pvalue_le: Option<f64>,
    adj_pvalue_le: Option<f64>,
    offset: Option<usize>,
    limit: Option<usize>,
) -> Result<QueryResponse, Custom<String>> {
    let background_id = Uuid::parse_str(background_id).map_err(|e| Custom(Status::BadRequest, e.to_string()))?;
    ensure_index(&mut db, &state, background_id).await.map_err(|e| Custom(Status::InternalServerError, e.to_string()))?;
    let start = Instant::now();
    let input_gene_set = input_gene_set.0.into_iter().map(|gene| Uuid::parse_str(&gene)).collect::<Result<Vec<_>, _>>().map_err(|e| Custom(Status::BadRequest, e.to_string()))?;
    let index_reader = state.bitmaps.read().await;
    let bitmap = index_reader.get(&background_id).ok_or("Can't find background").map_err(|e| Custom(Status::NotFound, e.to_string()))?;
    let input_gene_set = bitvec(&bitmap.columns, input_gene_set);
    let background_query = Arc::new(BackgroundQuery { background_id, input_gene_set });
    let results = {
        let results = state.cache.get(&background_query).await;
        if let Some(results) = results {
            results.value().clone()
        } else {
            let overlap_ge = overlap_ge.unwrap_or(1);
            let pvalue_le =  pvalue_le.unwrap_or(1.0);
            let adj_pvalue_le =  adj_pvalue_le.unwrap_or(1.0);
            // parallel overlap computation
            let n_background = bitmap.columns.len() as u32;
            let n_user_gene_id = background_query.input_gene_set.len() as u32;
            let results: Vec<_> = bitmap.values.par_iter()
                .enumerate()
                .filter_map(|(index, gene_set)| {
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
                    Some(PartialQueryResult { index, n_overlap, odds_ratio, pvalue })
                })
                .collect();
            // extract pvalues from results and compute adj_pvalues
            let mut pvalues = vec![1.0; bitmap.index.len()];
            for result in &results {
                pvalues[result.index] = result.pvalue;
            }
            let adj_pvalues = adjust(&pvalues, Procedure::BenjaminiHochberg);
            // create final results, adding gene_set_id & adj_pvalues
            let mut results: Vec<_> = results
                .into_iter()
                .filter_map(|result| {
                    let adj_pvalue = *adj_pvalues.get(result.index)?;
                    if adj_pvalue > adj_pvalue_le { return None }
                    let gene_set_id = bitmap.index.get(result.index)?.to_string();
                    Some(Arc::new(QueryResult {
                        gene_set_id,
                        n_overlap: result.n_overlap,
                        odds_ratio: result.odds_ratio,
                        pvalue: result.pvalue,
                        adj_pvalue,
                    }))
                })
                .collect();
            results.sort_unstable_by(|a, b| a.pvalue.partial_cmp(&b.pvalue).unwrap_or(std::cmp::Ordering::Equal));
            let results = Arc::new(results);
            state.cache.insert(background_query, results.clone(), 10000).await;
            let duration = start.elapsed();
            println!("[{}] {} genes enriched in {:?}", background_id, n_user_gene_id, duration);
            results
        }
    };
    let range_total = results.len();
    let (range_start, range_end, results) = match (offset.unwrap_or(0), limit) {
        (0, None) => (0, range_total, results),
        (offset, None) => {
            let results = Arc::new(results[offset..].to_vec());
            (offset, range_total, results)
        },
        (offset, Some(limit)) => {
            let results = Arc::new(results[offset..(offset+limit)].to_vec());
            (offset, offset + results.len(), results)
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
            bitmaps: RwLock::new(HashMap::new()),
            cache: Cache::new(),
        })
        .attach(Postgres::init())
        .mount("/", routes![ensure, query, delete])
}
