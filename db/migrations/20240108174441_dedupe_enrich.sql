-- migrate:up
drop function app_private_v2.indexed_enrich;
drop function app_public_v2.background_enrich;
drop type app_public_v2.paginated_enrich_result;
drop function app_public_v2.enrich_result_gene_set;
drop type app_public_v2.enrich_result;

create type app_public_v2.enrich_result as (
  gene_set_hash uuid,
  n_overlap int,
  odds_ratio double precision,
  pvalue double precision,
  adj_pvalue double precision
);
comment on type app_public_v2.enrich_result is E'@foreign key (gene_set_hash) references app_public_v2.gene_set (hash)';

create or replace function app_public_v2.enrich_result_gene_sets(enrich_result app_public_v2.enrich_result) returns setof app_public_v2.gene_set
as $$
  select gs.*
  from app_public_v2.gene_set gs
  where gs.hash = enrich_result.gene_set_hash;
$$ language sql immutable strict;
grant execute on function app_public_v2.enrich_result_gene_sets to guest, authenticated;

create type app_public_v2.paginated_enrich_result as (
  nodes app_public_v2.enrich_result[],
  total_count int
);

create or replace function app_private_v2.indexed_enrich(
  background app_public_v2.background,
  gene_ids uuid[],
  filter_term varchar default null,
  overlap_ge int default 1,
  pvalue_le double precision default 0.05,
  adj_pvalue_le double precision default 0.05,
  "offset" int default null,
  "first" int default null
) returns app_public_v2.paginated_enrich_result as $$
  import os, requests
  params = dict(
    overlap_ge=overlap_ge,
    pvalue_le=pvalue_le,
    adj_pvalue_le=adj_pvalue_le,
  )
  if filter_term: params['filter_term'] = filter_term
  if offset: params['offset'] = offset
  if first: params['limit'] = first
  req = requests.post(
    f"{os.environ.get('ENRICH_URL', 'http://rummagene-enrich:8000')}/{background['id']}",
    params=params,
    json=gene_ids,
  )
  total_count = req.headers.get('Content-Range').partition('/')[-1]
  return dict(nodes=req.json(), total_count=total_count)
$$ language plpython3u immutable parallel safe;

create or replace function app_public_v2.background_enrich(
  background app_public_v2.background,
  genes varchar[],
  filter_term varchar default null,
  overlap_ge int default 1,
  pvalue_le double precision default 0.05,
  adj_pvalue_le double precision default 0.05,
  "offset" int default null,
  "first" int default null
) returns app_public_v2.paginated_enrich_result
as $$
  select r.*
  from app_private_v2.indexed_enrich(
    background_enrich.background,
    (select array_agg(gene_id) from app_public_v2.gene_map(genes) gm),
    background_enrich.filter_term,
    background_enrich.overlap_ge,
    background_enrich.pvalue_le,
    background_enrich.adj_pvalue_le,
    background_enrich."offset",
    background_enrich."first"
  ) r;
$$ language sql immutable parallel safe security definer;
grant execute on function app_public_v2.background_enrich to guest, authenticated;

-- migrate:down
drop function app_public_v2.background_enrich;
drop function app_private_v2.indexed_enrich;
drop type app_public_v2.paginated_enrich_result;
drop function app_public_v2.enrich_result_gene_sets;
drop type app_public_v2.enrich_result;

create type app_public_v2.enrich_result as (
  gene_set_id uuid,
  n_overlap int,
  odds_ratio double precision,
  pvalue double precision,
  adj_pvalue double precision
);
comment on type app_public_v2.enrich_result is E'@foreign key (gene_set_id) references app_public_v2.gene_set (id)';

create or replace function app_public_v2.enrich_result_gene_set(enrich_result app_public_v2.enrich_result) returns app_public_v2.gene_set
as $$
  select gs.*
  from app_public_v2.gene_set gs
  where gs.id = enrich_result.gene_set_id;
$$ language sql immutable strict;
grant execute on function app_public_v2.enrich_result_gene_set to guest, authenticated;

create type app_public_v2.paginated_enrich_result as (
  nodes app_public_v2.enrich_result[],
  total_count int
);

create or replace function app_private_v2.indexed_enrich(
  background app_public_v2.background,
  gene_ids uuid[],
  filter_term varchar default null,
  overlap_ge int default 1,
  pvalue_le double precision default 0.05,
  adj_pvalue_le double precision default 0.05,
  "offset" int default null,
  "first" int default null
) returns app_public_v2.paginated_enrich_result as $$
  import requests
  params = dict(
    overlap_ge=overlap_ge,
    pvalue_le=pvalue_le,
    adj_pvalue_le=adj_pvalue_le,
  )
  if filter_term: params['filter_term'] = filter_term
  if offset: params['offset'] = offset
  if first: params['limit'] = first
  req = requests.post(
    f"http://rummagene-enrich:8000/{background['id']}",
    params=params,
    json=gene_ids,
  )
  total_count = req.headers.get('Content-Range').partition('/')[-1]
  return dict(nodes=req.json(), total_count=total_count)
$$ language plpython3u immutable parallel safe;

create or replace function app_public_v2.background_enrich(
  background app_public_v2.background,
  genes varchar[],
  filter_term varchar default null,
  overlap_ge int default 1,
  pvalue_le double precision default 0.05,
  adj_pvalue_le double precision default 0.05,
  "offset" int default null,
  "first" int default null
) returns app_public_v2.paginated_enrich_result
as $$
  select r.*
  from app_private_v2.indexed_enrich(
    background_enrich.background,
    (select array_agg(gene_id) from app_public_v2.gene_map(genes) gm),
    background_enrich.filter_term,
    background_enrich.overlap_ge,
    background_enrich.pvalue_le,
    background_enrich.adj_pvalue_le,
    background_enrich."offset",
    background_enrich."first"
  ) r;
$$ language sql immutable parallel safe security definer;
grant execute on function app_public_v2.background_enrich to guest, authenticated;
