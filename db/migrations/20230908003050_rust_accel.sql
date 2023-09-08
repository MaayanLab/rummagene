-- migrate:up

-- step 1: compute bitset vectors for a given background
-- that-is, store each gene set as a bitvector (1 bit for each gene in the background)

create or replace function app_private_v2.compute_index(
  background app_public_v2.background
) returns table (
  id uuid,
  bitvec bytea
) as $$
[dependencies]
bit-set = "0.5.3"
bit-vec = "0.6.3"
uuid = "1.4.1"

[code]
extern crate uuid;
extern crate bit_set;
use std::collections::HashMap;

let background_genes = background.get_by_name::<JsonB>("gene_ids").unwrap().unwrap().0
  .as_object().unwrap()
  .into_iter()
  .enumerate()
  .map(|(i, (key, _value))| (uuid::Uuid::parse_str(key).unwrap(), i))
  .collect::<HashMap<uuid::Uuid, usize>>();

Spi::connect(|client| {
  let results: Vec<_> = client.select("SELECT id, gene_ids from app_public_v2.gene_set;", None, None)?
    .into_iter()
    .map(|row| {
      let id = row["id"].value::<Uuid>().unwrap();
      let mut gene_set = bit_set::BitSet::with_capacity(background_genes.len());
      gene_set.extend(
        row["gene_ids"].value::<JsonB>().unwrap().unwrap().0
          .as_object().unwrap()
          .into_iter()
          .filter_map(|(gene_id, _)| background_genes.get(&uuid::Uuid::parse_str(gene_id).unwrap()))
          .map(|v| *v)
      );
      (id, Some(gene_set.into_bit_vec().to_bytes()))
    })
    .collect();
  Ok(Some(TableIterator::new(results)))
})
$$ language plrust immutable strict;

create materialized view app_private_v2.computed_index as
select b.id as background_id, r.id as gene_set_id, r.bitvec
from app_public_v2.background b, app_private_v2.compute_index(b) r;

-- perform enrichment:
-- create a bitset vector out of the user input and use the pre-computed bitset vectors to compute overlap
-- followed by fisher exact testing
create or replace function app_private_v2.indexed_enrich(
  background app_public_v2.background,
  gene_ids uuid[],
  overlap_greater_than int default 0,
  pvalue_less_than double precision default 0.05,
  adj_pvalue_less_than double precision default 0.05
) returns table (
  gene_set_id uuid,
  n_overlap int,
  odds_ratio double precision,
  pvalue double precision,
  adj_pvalue double precision
) as $$
[dependencies]
serde_json = "1.0.105"
bit-set = "0.5.3"
bit-vec = "0.6.3"
uuid = "1.4.1"
itertools = "0.8"
fishers_exact = "1.0.1"
adjustp = "0.1.4"

[code]
extern crate uuid;
extern crate bit_set;
extern crate bit_vec;
use itertools::izip;
use fishers_exact::fishers_exact;
use adjustp::{adjust, Procedure};
use std::collections::HashSet;

let background_id = background.get_by_name::<Uuid>("id").unwrap().unwrap();

let (input_genes, n_user_gene_id, n_background) = {
  let input_gene_set = gene_ids
    .into_iter()
    .map(|gene_id| uuid::Uuid::from_bytes(*gene_id.unwrap().as_bytes()))
    .collect::<HashSet<uuid::Uuid>>();
  let background = background.get_by_name::<JsonB>("gene_ids").unwrap().unwrap();
  let background = background.0.as_object().unwrap();
  let n_background = background.len() as u32;
  let mut input_genes = bit_set::BitSet::with_capacity(n_background as usize);
  input_genes.extend(
      background.into_iter().enumerate()
        .filter_map(|(i, (key, _value))| {
          let key = uuid::Uuid::parse_str(key).unwrap();
          if input_gene_set.contains(&key) {
            Some(i)
          } else {
            None
          }
        })
  );
  let n_user_gene_id = input_genes.len() as u32;
  (input_genes, n_user_gene_id, n_background)
};

Spi::connect(|client| {
  let mut gene_set_ids: Vec<_> = Vec::new();
  let mut n_overlaps: Vec<u32> = Vec::new();
  let mut odds_ratios: Vec<f64> = Vec::new();
  let mut pvalues: Vec<f64> = Vec::new();
  for row in client.select(
    client.prepare("SELECT gene_set_id, bitvec from app_private_v2.computed_index where background_id = $1;", Some(vec![pg_sys::oids::PgOid::BuiltIn(pg_sys::BuiltinOid::UUIDOID)]))?,
    None,
    Some(vec![background_id.into_datum()]),
  )? {
    let id = row["gene_set_id"].value::<Uuid>()?;
    let bitvec = row["bitvec"].value::<Vec<u8>>()?.unwrap();
    let mut gene_set = bit_set::BitSet::from_bit_vec(bit_vec::BitVec::from_bytes(&bitvec));
    let n_gs_gene_id = gene_set.len() as u32;
    gene_set.intersect_with(&input_genes);
    let n_overlap_gene_id = gene_set.len() as u32;
    gene_set_ids.push(id);
    if n_overlap_gene_id > (overlap_greater_than as u32) {
      let a = n_overlap_gene_id;
      let b = n_user_gene_id - a;
      let c = n_gs_gene_id - a;
      let d = n_background - b - c + a;
      let table = [a, b, c, d];
      let result = fishers_exact(&table).unwrap();
      n_overlaps.push(n_overlap_gene_id);
      pvalues.push(result.greater_pvalue);
      odds_ratios.push(((n_overlap_gene_id as f64) / (n_user_gene_id as f64)) / ((n_gs_gene_id as f64) / (n_background as f64)));
    } else {
      n_overlaps.push(0);
      pvalues.push(1.0);
      odds_ratios.push(0.0);
    }
  }
  let adjpvalues = adjust(&pvalues, Procedure::BenjaminiHochberg);
  Ok(Some(TableIterator::new(
    izip!(
      gene_set_ids,
      n_overlaps,
      odds_ratios,
      pvalues,
      adjpvalues
    ).into_iter()
      .filter_map(move |(gene_set_id, n_overlap, odds_ratio, pvalue, adjpvalue)| {
        if gene_set_id.is_some() && n_overlap > (overlap_greater_than as u32) && pvalue < pvalue_less_than && adjpvalue < adj_pvalue_less_than {
          Some((gene_set_id, Some(n_overlap as i32), Some(odds_ratio), Some(pvalue), Some(adjpvalue)))
        } else {
          None
        }
      })
  )))
})
$$ language plrust immutable strict;

-- Replace the background_enrich function with the indexed version
create or replace function app_public_v2.background_enrich(
  background app_public_v2.background,
  genes varchar[],
  overlap_greater_than int default 0,
  pvalue_less_than double precision default 0.05,
  adj_pvalue_less_than double precision default 0.05
) returns setof app_public_v2.enrich_result
as $$
  select
    r.gene_set_id,
    r.odds_ratio,
    r.pvalue,
    r.adj_pvalue
  from app_private_v2.indexed_enrich(
    background_enrich.background,
    (select array_agg(gene_id) from app_public_v2.gene_map(genes) gm),
    background_enrich.overlap_greater_than,
    background_enrich.pvalue_less_than,
    background_enrich.adj_pvalue_less_than
  ) r
  order by r.pvalue asc;
$$ language sql immutable strict security definer;

-- migrate:down
drop function app_private_v2.compute_index;
drop function app_private_v2.indexed_enrich;
