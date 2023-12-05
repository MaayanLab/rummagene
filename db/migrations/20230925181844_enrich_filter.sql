-- migrate:up
drop function app_public_v2.background_enrich;
drop function app_private_v2.indexed_enrich;

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

-- migrate:down
drop function app_public_v2.background_enrich;
drop function app_private_v2.indexed_enrich;

create or replace function app_private_v2.indexed_enrich(
  background app_public_v2.background,
  gene_ids uuid[],
  overlap_ge int default 1,
  pvalue_le double precision default 0.05,
  adj_pvalue_le double precision default 0.05,
  "offset" int default 0,
  "first" int default 100
) returns app_public_v2.paginated_enrich_result as $$
  import requests
  req = requests.post(
    f"http://rummagene-enrich:8000/{background['id']}",
    params=dict(
      overlap_ge=overlap_ge,
      pvalue_le=pvalue_le,
      adj_pvalue_le=adj_pvalue_le,
      offset=offset,
      limit=first,
    ),
    json=gene_ids,
  )
  total_count = req.headers.get('Content-Range').partition('/')[-1]
  return dict(nodes=req.json(), total_count=total_count)
$$ language plpython3u immutable strict parallel safe;

create or replace function app_public_v2.background_enrich(
  background app_public_v2.background,
  genes varchar[],
  overlap_ge int default 1,
  pvalue_le double precision default 0.05,
  adj_pvalue_le double precision default 0.05,
  "offset" int default 0,
  "first" int default 100
) returns app_public_v2.paginated_enrich_result
as $$
  select r.*
  from app_private_v2.indexed_enrich(
    background_enrich.background,
    (select array_agg(gene_id) from app_public_v2.gene_map(genes) gm),
    background_enrich.overlap_ge,
    background_enrich.pvalue_le,
    background_enrich.adj_pvalue_le,
    background_enrich."offset",
    background_enrich."first"
  ) r;
$$ language sql immutable strict parallel safe security definer;
grant execute on function app_public_v2.background_enrich to guest, authenticated;
