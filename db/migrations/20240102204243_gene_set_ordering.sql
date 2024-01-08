-- migrate:up
create or replace function app_public_v2.gene_set_genes(gene_set app_public_v2.gene_set)
returns setof app_public_v2.gene as
$$
  select g.*
  from jsonb_each(gene_set_genes.gene_set.gene_ids) gsg(gene_id, position)
  inner join app_public_v2.gene g on gsg.gene_id = g.id::text
  order by gsg.position asc;
$$ language sql immutable strict parallel safe;
grant execute on function app_public_v2.gene_set_genes to guest, authenticated;

-- migrate:down
create or replace function app_public_v2.gene_set_genes(gene_set app_public_v2.gene_set)
returns setof app_public_v2.gene as
$$
  select g.*
  from app_public_v2.gene g
  where gene_set_genes.gene_set.gene_ids ? g.id::text;
$$ language sql immutable strict parallel safe;
grant execute on function app_public_v2.gene_set_genes to guest, authenticated;
