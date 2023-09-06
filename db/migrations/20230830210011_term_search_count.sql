-- migrate:up

create or replace function app_public.gene_set_term_search_count(terms varchar[]) 
returns table (id uuid, term varchar, count int) as 
$$
  select gs.id, gs.term, gsl.count
  from app_public.gene_set gs
  inner join unnest(terms) ut(term) on gs.term ilike ('%' || ut.term || '%')
  inner join app_public.gene_set_length gsl on gsl.id = gs.id;
$$ language sql immutable strict parallel safe;

grant execute on function app_public.gene_set_term_search_count to guest, authenticated;

create or replace function app_public.gene_set_library_term_search_count(gene_set_library app_public.gene_set_library, terms varchar[]) 
returns table (id uuid, term varchar, count int) as 
$$
  select distinct gs.id, gs.term, gsl.count
  from
    app_public.gene_set gs
    inner join unnest(terms) ut(term) on gs.term ilike ('%' || ut.term || '%')
    inner join app_public.gene_set_length gsl on gsl.id = gs.id
  where
    gs.library_id = gene_set_library.id;
$$ language sql immutable strict parallel safe;

grant execute on function app_public.gene_set_library_term_search_count to guest, authenticated;

-- migrate:down

drop function app_public.gene_set_term_search_count(terms varchar[]);
drop function app_public.gene_set_library_term_search_count(gene_set_library app_public.gene_set_library, terms varchar[]) 