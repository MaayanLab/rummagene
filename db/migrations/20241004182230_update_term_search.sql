-- migrate:up

create or replace function app_public_v2.gene_set_term_search_desc(terms varchar[]) returns setof app_public_v2.gene_set
as $$
  select distinct gs.*
  from app_public_v2.gene_set gs
  inner join unnest(terms) ut(term) on gs.term ilike ('%' || ut.term || '%') or gs.description ilike ('%' || ut.term || '%');
$$ language sql immutable strict parallel safe;

grant execute on function app_public_v2.gene_set_term_search_desc to guest, authenticated;



-- migrate:down

drop function app_public_v2.gene_set_term_search_desc(terms varchar[]);