-- migrate:up

create materialized view app_public.gene_set_length as
select gsg.gene_set_id as id, count(*) as count
from app_public.gene_set_gene gsg
group by id;

create index idx_gene_set_length on app_public.gene_set_length (id);

comment on materialized view app_public.gene_set_length is E'@foreignKey (id) references app_public.gene_set (id)';

grant select on table app_public.gene_set_length to guest;
grant all privileges on table app_public.gene_set_length to authenticated;


create or replace function app_public.gene_set_library_terms_pmcs_count(gene_set_library app_public.gene_set_library, pmcids varchar[]) 
returns table (pmc varchar, term varchar, id uuid, count int) as
$$
  select gsp.pmc, gs.term, gs.id, gsl.count
  from 
    app_public.gene_set_pmc as gsp
    inner join app_public.gene_set as gs on gs.id = gsp.id
    inner join app_public.gene_set_length as gsl on gsl.id = gsp.id
  where 
    gsp.pmc = ANY (pmcids) and
    gs.library_id = gene_set_library.id;
$$ language sql immutable strict parallel safe;

create or replace function app_public.terms_pmcs_count(pmcids varchar[])
returns table (pmc varchar, term varchar, id uuid, count int) as
$$
  select gsp.pmc, gs.term, gs.id, gsl.count
  from 
    app_public.gene_set_pmc as gsp
    inner join app_public.gene_set as gs on gs.id = gsp.id
    inner join app_public.gene_set_length as gsl on gsl.id = gsp.id
  where gsp.pmc = ANY (pmcids);
$$ language sql immutable strict parallel safe;

grant execute on function app_public.terms_pmcs_count to guest, authenticated;

-- migrate:down

drop materialized view app_public.gene_set_length;
drop function app_public.terms_pmcs_count(pmcids varchar[]);
drop function app_public.gene_set_library_terms_pmcs_count(gene_set_library app_public.gene_set_library, pmcids varchar[]) 
