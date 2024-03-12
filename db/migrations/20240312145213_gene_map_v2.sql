-- migrate:up

create or replace function app_public_v2.gene_map_2(genes varchar[])
returns setof app_public_v2.gene_mapping as $$
  select g.id as gene_id, ug.gene as gene
  from unnest(gene_map_2.genes) ug(gene)
  inner join app_public_v2.gene g on g.symbol = upper(ug.gene) or g.synonyms ? upper(ug.gene);
$$ language sql immutable strict parallel safe;
grant execute on function app_public_v2.gene_map_2 to guest, authenticated;

-- migrate:down
drop function app_public_v2.gene_map_2;
