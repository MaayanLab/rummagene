-- migrate:up
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
    (select coalesce(array_agg(gene_id), '{}'::uuid[]) from app_public_v2.gene_map(genes) gm),
    background_enrich.overlap_ge,
    background_enrich.pvalue_le,
    background_enrich.adj_pvalue_le,
    background_enrich."offset",
    background_enrich."first"
  ) r;
$$ language sql immutable strict parallel safe security definer;
grant execute on function app_public_v2.background_enrich to guest, authenticated;

-- migrate:down
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
