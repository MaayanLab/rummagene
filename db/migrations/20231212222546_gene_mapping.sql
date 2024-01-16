-- migrate:up
drop function app_public_v2.gene_map;

create type app_public_v2.gene_mapping as (
  gene_id uuid,
  gene varchar
);

create or replace function app_public_v2.gene_map(genes varchar[])
returns setof app_public_v2.gene_mapping as $$
  select g.id as gene_id, ug.gene as gene
  from unnest(gene_map.genes) ug(gene)
  inner join app_public_v2.gene g on g.symbol = ug.gene or g.synonyms ? ug.gene;
$$ language sql immutable strict parallel safe;
grant execute on function app_public_v2.gene_map to guest, authenticated;

create or replace function app_public_v2.gene_mapping_gene_info(gene_mapping app_public_v2.gene_mapping)
returns app_public_v2.gene as $$
  select *
  from app_public_v2.gene g
  where g.id = gene_mapping.gene_id
$$ language sql immutable strict parallel safe;
grant execute on function app_public_v2.gene_mapping_gene_info to guest, authenticated;

-- migrate:down
drop function app_public_v2.gene_mapping_gene_info;
drop function app_public_v2.gene_map;
drop type app_public_v2.gene_mapping;

create or replace function app_public_v2.gene_map(genes varchar[])
returns table (
  gene_id uuid,
  gene varchar
) as $$
  select g.id as gene_id, ug.gene as gene
  from unnest(gene_map.genes) ug(gene)
  inner join app_public_v2.gene g on g.symbol = ug.gene or g.synonyms ? ug.gene;
$$ language sql immutable strict parallel safe;
grant execute on function app_public_v2.gene_map to guest, authenticated;
