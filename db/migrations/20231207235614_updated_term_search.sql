-- migrate:up

create or replace function app_public_v2.gene_set_term_search(terms varchar[]) returns setof app_public_v2.gene_set_pmid
as $$
  select distinct gs.*
  from app_public_v2.gene_set_pmid gs
  inner join unnest(terms) ut(term) on gs.title ilike ('%' || ut.term || '%');
$$ language sql immutable strict parallel safe;
grant execute on function app_public_v2.gene_set_term_search to guest, authenticated;

-- migrate:down

drop function app_public_v2.gene_set_term_search;