-- migrate:up

create or replace function app_public.view_gene_set(gsid uuid)
returns table (symbol varchar) as
$$
  select g.symbol
  from 
    app_public.gene g
    inner join app_public.gene_set_gene as gsg on g.id = gsg.gene_id
  where gsg.gene_set_id = gsid;
$$ language sql immutable strict parallel safe;

grant execute on function app_public.view_gene_set to guest, authenticated;


-- migrate:down

drop function app_public.view_gene_set(gsid uuid);


