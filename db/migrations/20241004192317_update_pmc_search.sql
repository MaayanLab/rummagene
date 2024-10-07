-- migrate:up

create or replace function app_public_v2.terms_pmcs_count_desc(pmcids varchar[])
returns table (pmc varchar, term varchar, id uuid,  description varchar, count int) as
$$
  select gsp.pmc, gs.term, gs.id, gs.description, gs.n_gene_ids as count
  from 
    app_public_v2.gene_set_pmc as gsp
    inner join app_public_v2.gene_set as gs on gs.id = gsp.id
  where gsp.pmc = ANY (pmcids);
$$ language sql immutable strict parallel safe;

grant execute on function app_public_v2.terms_pmcs_count_desc to guest, authenticated;

-- migrate:down

drop function app_public_v2.terms_pmcs_count_desc(pmcids varchar[]);