-- migrate:up
drop function app_public_v2.background_enrich;
drop function app_private_v2.indexed_enrich;

create or replace function app_private_v2.indexed_enrich(
  background app_public_v2.background,
  gene_ids uuid[],
  overlap_ge int default 1,
  pvalue_le double precision default 0.05,
  adj_pvalue_le double precision default 0.05
) returns table (
  gene_set_id uuid,
  n_overlap int,
  odds_ratio double precision,
  pvalue double precision,
  adj_pvalue double precision
) as $$
  import requests
  yield from requests.post(
    f"http://enrich:8000/{background['id']}",
    params=dict(
      overlap_ge=overlap_ge,
      pvalue_le=pvalue_le,
      adj_pvalue_le=adj_pvalue_le,
    ),
    json=gene_ids,
  ).json()
$$ language plpython3u immutable strict parallel safe;

create or replace function app_public_v2.background_enrich(
  background app_public_v2.background,
  genes varchar[],
  overlap_ge int default 1,
  pvalue_le double precision default 0.05,
  adj_pvalue_le double precision default 0.05
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
    background_enrich.overlap_ge,
    background_enrich.pvalue_le,
    background_enrich.adj_pvalue_le
  ) r;
$$ language sql immutable strict parallel safe security definer;
grant execute on function app_public_v2.background_enrich to guest;

-- migrate:down
