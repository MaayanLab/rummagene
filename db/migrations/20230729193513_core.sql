-- migrate:up

-- This gives us uuid support
create extension if not exists "uuid-ossp";

-- This gives us access to python functions
create extension if not exists "plpython3u";

-- fixup defaults from postgres
alter default privileges revoke execute on functions from public;

-- Everything in this schema is exposed via postgraphile
create schema app_public;
create schema internal;

-- We'll use this role to distinguish permissions for public/authenticated access
create role guest nologin;
create role authenticated nologin;

grant usage on schema app_public to guest, authenticated;

-- This table disambiguates genes by symbol and a set of synonyms
--  stored in a jsonb object (in the keys of the object, values don't matter)
create table app_public.gene (
  id uuid primary key default uuid_generate_v4(),
  symbol varchar not null unique
);

grant select on table app_public.gene to guest;
grant all privileges on table app_public.gene to authenticated;

create table app_public.gene_synonym (
  gene_id uuid not null references app_public.gene (id),
  synonym varchar not null unique,
  primary key (gene_id, synonym)
);

create index gene_synonym_gene_id_idx on app_public.gene_synonym (gene_id);

grant select on table app_public.gene_synonym to guest;
grant all privileges on table app_public.gene_synonym to authenticated;

-- This function can be used to produce a map from a the provided genes to the gene_id
create or replace function internal.gene_id_map_from_genes(genes varchar[]) returns jsonb
as $$
  select coalesce(
    jsonb_object_agg(ug.gene, coalesce(g.id, gs.gene_id)),
    '{}'::jsonb
  )
  from
    unnest(genes) ug(gene)
    left join app_public.gene g on g.symbol = ug.gene
    left join app_public.gene_synonym gs on gs.synonym = ug.gene
  where
    g.id is not null or gs.gene_id is not null
  ;
$$ language sql immutable strict parallel safe;

grant execute on function internal.gene_id_map_from_genes(genes varchar[]) to guest, authenticated;

-- This function can be used to produce a set of genes given genes
create or replace function app_public.gene_records_from_genes(genes varchar[]) returns setof app_public.gene
as $$
  with cte as (
    select distinct coalesce(g.id, gs.gene_id) as gene_id
    from
      unnest(genes) ug(gene)
      left join app_public.gene g on g.symbol = ug.gene
      left join app_public.gene_synonym gs on gs.synonym = ug.gene
    where
      g.id is not null or gs.gene_id is not null
  )
  select distinct g.*
  from
    cte
    inner join app_public.gene g on g.id = cte.gene_id
  ;
$$ language sql immutable strict parallel safe;

grant execute on function app_public.gene_records_from_genes(genes varchar[]) to guest, authenticated;

-- This table stores gene set libraries, containing a bunch of gene sets
create table app_public.gene_set_library (
  id uuid primary key default uuid_generate_v4(),
  name varchar not null unique,
  description varchar not null,
  created timestamp not null default now()
);

grant select on table app_public.gene_set_library to guest;
grant all privileges on table app_public.gene_set_library to authenticated;

-- This is a labeled gene set (effectively a row in a GMT) in a gene_set_library
create table app_public.gene_set (
  id uuid primary key default uuid_generate_v4(),
  library_id uuid not null references app_public.gene_set_library (id) on delete cascade,
  term varchar not null,
  unique (library_id, term)
);

create index gene_set_library_id_idx on app_public.gene_set (library_id);
create index gene_set_term_idx on app_public.gene_set (term);

grant select on table app_public.gene_set to guest;
grant all privileges on table app_public.gene_set to authenticated;

create table app_public.gene_set_gene (
  gene_set_id uuid not null references app_public.gene_set (id) on delete cascade,
  gene_id uuid not null references app_public.gene (id) on delete cascade,
  primary key (gene_set_id, gene_id)
);

create index gene_set_gene_set_id_idx on app_public.gene_set_gene (gene_set_id);
create index gene_set_gene_id_idx on app_public.gene_set_gene (gene_id);

grant select on table app_public.gene_set_gene to guest;
grant all privileges on table app_public.gene_set_gene to authenticated;

create table app_public.user_gene_set (
  id uuid primary key default uuid_generate_v4(),
  genes varchar[],
  description varchar default '',
  created timestamp not null default now()
);

grant select on table app_public.user_gene_set to guest;
grant all privileges on table app_public.user_gene_set to authenticated;

create or replace function app_public.add_user_gene_set(
  genes varchar[],
  description varchar default ''
) returns app_public.user_gene_set
as $$
  insert into app_public.user_gene_set (genes, description)
  select
    (
      select array_agg(ug.gene order by ug.gene)
      from unnest(add_user_gene_set.genes) ug(gene)
    ) as genes,
    add_user_gene_set.description
  returning *;
$$ language sql security definer;

grant execute on function app_public.add_user_gene_set to guest, authenticated;

-- here figure out the gene_set_library's background (the distinct set of genes in all of its genesets)
create materialized view app_public.gene_set_library_gene as
select distinct gsl.id as library_id, gsg.gene_id
from app_public.gene_set_library gsl
inner join app_public.gene_set gs on gs.library_id = gsl.id
inner join app_public.gene_set_gene gsg on gsg.gene_set_id = gs.id;
comment on materialized view app_public.gene_set_library_gene is E'@foreignKey (library_id) references app_public.gene_set_library (id)\n@foreignKey (gene_id) references app_public.gene (id)';

create index gene_set_library_gene_library_id_idx on app_public.gene_set_library_gene (library_id);
create index gene_set_library_gene_gene_id_idx on app_public.gene_set_library_gene (gene_id);
create unique index gene_set_library_gene_library_id_gene_id_idx on app_public.gene_set_library_gene (library_id, gene_id);

grant select on table app_public.gene_set_library_gene to guest;
grant all privileges on table app_public.gene_set_library_gene to authenticated;

create or replace function app_public.gene_set_library_background_genes(gene_set_library app_public.gene_set_library) returns setof app_public.gene
as $$
  select g.*
  from app_public.gene_set_library_gene gslg
  inner join app_public.gene g on g.id = gslg.gene_id
  where gslg.library_id = gene_set_library.id;
$$ language sql immutable parallel safe;

grant execute on function app_public.gene_set_library_background_genes(gene_set_library app_public.gene_set_library) to guest, authenticated;

-- This function can be used to return all gene sets with some set of terms present
create or replace function app_public.gene_set_term_search(terms varchar[]) returns setof app_public.gene_set
as $$
  select gs.*
  from app_public.gene_set gs
  inner join unnest(terms) ut(term) on gs.term ilike ('%' || ut.term || '%');
$$ language sql immutable strict parallel safe;

grant execute on function app_public.gene_set_term_search to guest, authenticated;

-- This function can be used to return all gene sets containing some set of genes
create or replace function app_public.gene_set_library_term_search(gene_set_library app_public.gene_set_library, terms varchar[]) returns setof app_public.gene_set
as $$
  select distinct gs.*
  from
    app_public.gene_set gs
    inner join unnest(terms) ut(term) on gs.term ilike ('%' || ut.term || '%')
  where
    gs.library_id = gene_set_library.id;
$$ language sql immutable strict parallel safe;

grant execute on function app_public.gene_set_library_term_search to guest, authenticated;

-- This function can be used to return all gene sets containing some set of genes
create or replace function app_public.gene_set_gene_search(genes varchar[]) returns setof app_public.gene_set
as $$
  select distinct gs.*
  from
    app_public.gene_records_from_genes(genes) g
    inner join app_public.gene_set_gene gsg on gsg.gene_id = g.id
    inner join app_public.gene_set gs on gs.id = gsg.gene_set_id;
$$ language sql immutable strict parallel safe;

grant execute on function app_public.gene_set_gene_search to guest, authenticated;

-- This function can be used to return all gene sets containing some set of genes
create or replace function app_public.gene_set_library_gene_search(gene_set_library app_public.gene_set_library, genes varchar[]) returns setof app_public.gene_set
as $$
  select distinct gs.*
  from
    app_public.gene_records_from_genes(genes) g
    inner join app_public.gene_set_gene gsg on gsg.gene_id = g.id
    inner join app_public.gene_set gs on gs.id = gsg.gene_set_id
  where
    gs.library_id = gene_set_library.id;
$$ language sql immutable strict parallel safe;

grant execute on function app_public.gene_set_library_gene_search to guest, authenticated;


-- step 1: overlap: compute overlapping genes, n_user_genes, n_gene_set_genes, n_background
-- overlap_fixed_background_size: this can be done with a fixed background size (as is done in speedrichr)
-- overlap_library_background:    it can be done considering the background of the gene_set_library
-- overlap_user_background:       it can be done considering both the background of the gene_set_library and the user provided background

create type internal.overlap_result as (
  gene_set_id uuid,
  overlap_gene_ids uuid[],
  n_user_gene_ids bigint,
  n_gs_gene_ids bigint,
  n_background bigint
);

create or replace function internal.gene_set_library_overlap_fixed_background_size(
  gene_set_library app_public.gene_set_library,
  genes varchar[],
  background_size bigint = 20000,
  overlap_greater_than bigint = 0
) returns setof internal.overlap_result
as $$
  select
    gs.id as gene_set_id,
    array_agg(gsg.gene_id) as overlap_gene_ids,
    (
      select count(ug_.id)
      from app_public.gene_records_from_genes(gene_set_library_overlap_fixed_background_size.genes) ug_
    ) as n_user_gene_ids,
    (
      select count(gsg_.gene_id)
      from app_public.gene_set_gene gsg_
      where gsg_.gene_set_id = gs.id
    ) as n_gs_gene_ids,
    gene_set_library_overlap_fixed_background_size.background_size
  from
    app_public.gene_records_from_genes(gene_set_library_overlap_fixed_background_size.genes) ug
    inner join app_public.gene_set_gene gsg on ug.id = gsg.gene_id
    inner join app_public.gene_set gs on gsg.gene_set_id = gs.id
  where
    gs.library_id = gene_set_library_overlap_fixed_background_size.gene_set_library.id
  group by gs.id
  having count(gsg.gene_id) > gene_set_library_overlap_fixed_background_size.overlap_greater_than
  order by count(gsg.gene_id) desc;
$$ language sql immutable strict parallel safe;

grant execute on function internal.gene_set_library_overlap_fixed_background_size(
  gene_set_library app_public.gene_set_library,
  genes varchar[],
  background_size bigint,
  overlap_greater_than bigint
) to guest, authenticated;

create or replace function internal.gene_set_library_overlap_library_background(
  gene_set_library app_public.gene_set_library,
  genes varchar[],
  overlap_greater_than bigint = 0
) returns setof internal.overlap_result
as $$
  select
    gs.id as gene_set_id,
    array_agg(gsg.gene_id) as overlap_gene_ids,
    (
      select count(ug_.id)
      from app_public.gene_records_from_genes(gene_set_library_overlap_library_background.genes) ug_
      inner join app_public.gene_set_library_background_genes(gene_set_library_overlap_library_background.gene_set_library) gsbg_ on gsbg_.id = ug_.id
    ) as n_user_gene_ids,
    (
      select count(gsg_.gene_id)
      from app_public.gene_set_gene gsg_
      where gsg_.gene_set_id = gs.id
    ) as n_gs_gene_ids,
    (
      select count(gsbg_.id)
      from app_public.gene_set_library_background_genes(gene_set_library_overlap_library_background.gene_set_library) gsbg_
    ) as n_background
  from
    app_public.gene_records_from_genes(gene_set_library_overlap_library_background.genes) ug
    inner join app_public.gene_set_library_background_genes(gene_set_library_overlap_library_background.gene_set_library) gsbg on gsbg.id = ug.id
    inner join app_public.gene_set_gene gsg on ug.id = gsg.gene_id
    inner join app_public.gene_set gs on gsg.gene_set_id = gs.id
  where
    gs.library_id = gene_set_library_overlap_library_background.gene_set_library.id
  group by gs.id
  having count(gsg.gene_id) > gene_set_library_overlap_library_background.overlap_greater_than
  order by count(gsg.gene_id) desc;
$$ language sql immutable strict parallel safe;

grant execute on function internal.gene_set_library_overlap_library_background to guest, authenticated;

create or replace function internal.gene_set_library_overlap_user_background(
  gene_set_library app_public.gene_set_library,
  genes varchar[],
  background_genes varchar[],
  overlap_greater_than bigint = 0
) returns setof internal.overlap_result
as $$
  select
    gs.id as gene_set_id,
    array_agg(gsg.gene_id) as overlap_gene_ids,
    (
      select count(ug_.id)
      from app_public.gene_records_from_genes(gene_set_library_overlap_user_background.genes) ug_
      inner join app_public.gene_records_from_genes(gene_set_library_overlap_user_background.background_genes) bg_ on bg_.id = ug_.id
      inner join app_public.gene_set_library_background_genes(gene_set_library_overlap_user_background.gene_set_library) gsbg_ on gsbg_.id = ug_.id
    ) as n_user_gene_ids,
    (
      select count(gsg_.gene_id)
      from app_public.gene_set_gene gsg_
      inner join app_public.gene_records_from_genes(gene_set_library_overlap_user_background.background_genes) bg_ on bg_.id = gsg_.gene_id
      where gsg_.gene_set_id = gs.id
    ) as n_gs_gene_ids,
    (
      select count(gsbg_.id)
      from app_public.gene_set_library_background_genes(gene_set_library_overlap_user_background.gene_set_library) gsbg_
      inner join app_public.gene_records_from_genes(gene_set_library_overlap_user_background.background_genes) bg_ on bg_.id = gsbg_.id
    ) as n_background
  from
    app_public.gene_records_from_genes(gene_set_library_overlap_user_background.genes) ug
    inner join app_public.gene_records_from_genes(gene_set_library_overlap_user_background.background_genes) ubg on ubg.id = ug.id
    inner join app_public.gene_set_library_background_genes(gene_set_library_overlap_user_background.gene_set_library) gsbg on gsbg.id = ug.id
    inner join app_public.gene_set_gene gsg on ug.id = gsg.gene_id
    inner join app_public.gene_set gs on gsg.gene_set_id = gs.id
  where
    gs.library_id = gene_set_library_overlap_user_background.gene_set_library.id
  group by gs.id
  having count(gsg.gene_id) > gene_set_library_overlap_user_background.overlap_greater_than
  order by count(gsg.gene_id) desc;
$$ language sql immutable strict parallel safe;

grant execute on function internal.gene_set_library_overlap_user_background to guest, authenticated;

-- step 2: compute pvalue/adjusted pvalues
create type internal.fishers_exact_result as (
  id uuid,
  pvalue double precision,
  adj_pvalue double precision
);
create or replace function internal.fishers_exact(
  ids uuid[],
  a bigint[],
  b bigint[],
  c bigint[],
  d bigint[],
  n bigint,
  fdr double precision default 0.05,
  pvalue_less_than double precision default 0.05,
  adj_pvalue_less_than double precision default 0.05
) returns setof internal.fishers_exact_result
as $$
  import sigcomlite
  yield from sigcomlite.fishers_exact(
    ids=ids,
    a=a,
    b=b,
    c=c,
    d=d,
    n=n,
    fdr=fdr,
    pvalue_less_than=pvalue_less_than,
    adj_pvalue_less_than=adj_pvalue_less_than,
  )
$$ language plpython3u immutable strict parallel safe;

grant execute on function internal.fishers_exact to guest, authenticated;


-- enrichment run steps 1 & 2 for the 3 possible:
-- fixed_background_size
-- library_background
-- user_background

create type app_public.gene_set_library_enrich_result as (
  gene_set_id uuid,
  overlap_gene_ids uuid[],
  n_user_gene_ids bigint,
  n_gs_gene_ids bigint,
  n_background bigint,
  odds_ratio double precision,
  pvalue double precision,
  adj_pvalue double precision
);

create or replace function app_public.gene_set_library_enrich_fixed_background_size(
  gene_set_library app_public.gene_set_library,
  genes varchar[],
  background_size bigint,
  overlap_greater_than bigint default 0,
  fdr double precision default 0.05,
  pvalue_less_than double precision default 0.05,
  adj_pvalue_less_than double precision default 0.05
) returns setof app_public.gene_set_library_enrich_result
as $$
  with overlap as (
    select *
    from internal.gene_set_library_overlap_fixed_background_size(
      gene_set_library, genes, background_size, overlap_greater_than
    )
  ), vectorized as (
    select
      array_agg(o.gene_set_id) as ids,
      array_agg(array_length(o.overlap_gene_ids, 1)::bigint) as a,
      array_agg(o.n_user_gene_ids - array_length(o.overlap_gene_ids, 1)) as b,
      array_agg(o.n_gs_gene_ids - array_length(o.overlap_gene_ids, 1)) as c,
      array_agg(o.n_background - o.n_user_gene_ids - n_gs_gene_ids + array_length(o.overlap_gene_ids, 1)) as d,
      (
        select count(id)
        from app_public.gene_set gs
        where gs.library_id = gene_set_library.id
      ) as n
    from overlap o
  )
  select
    r.id as gene_set_id,
    o.overlap_gene_ids,
    o.n_user_gene_ids,
    o.n_gs_gene_ids,
    o.n_background,
    (
      array_length(o.overlap_gene_ids, 1)::double precision
      / nullif(o.n_user_gene_ids, 0)::double precision
    ) / nullif(
      o.n_gs_gene_ids::double precision
      / nullif(o.n_background, 0)::double precision, 0) as odds_ratio,
    r.pvalue,
    r.adj_pvalue
  from
    overlap o
    inner join (
      select r.*
      from vectorized, internal.fishers_exact(vectorized.ids, vectorized.a, vectorized.b, vectorized.c, vectorized.d, vectorized.n, fdr, pvalue_less_than, adj_pvalue_less_than) r
    ) r on o.gene_set_id = r.id
  order by r.pvalue asc;
$$ language sql immutable strict parallel safe security definer;

grant execute on function app_public.gene_set_library_enrich_fixed_background_size to guest, authenticated;

create or replace function app_public.gene_set_library_enrich_library_background(
  gene_set_library app_public.gene_set_library,
  genes varchar[],
  overlap_greater_than bigint default 0,
  fdr double precision default 0.05,
  pvalue_less_than double precision default 0.05,
  adj_pvalue_less_than double precision default 0.05
) returns setof app_public.gene_set_library_enrich_result
as $$
  with overlap as (
    select *
    from internal.gene_set_library_overlap_library_background(
      gene_set_library, genes, overlap_greater_than
    )
  ), vectorized as (
    select
      array_agg(o.gene_set_id) as ids,
      array_agg(array_length(o.overlap_gene_ids, 1)::bigint) as a,
      array_agg(o.n_user_gene_ids - array_length(o.overlap_gene_ids, 1)) as b,
      array_agg(o.n_gs_gene_ids - array_length(o.overlap_gene_ids, 1)) as c,
      array_agg(o.n_background - o.n_user_gene_ids - n_gs_gene_ids + array_length(o.overlap_gene_ids, 1)) as d,
      (
        select count(id)
        from app_public.gene_set gs
        where gs.library_id = gene_set_library.id
      ) as n
    from overlap o
  )
  select
    r.id as gene_set_id,
    o.overlap_gene_ids,
    o.n_user_gene_ids,
    o.n_gs_gene_ids,
    o.n_background,
    (
      array_length(o.overlap_gene_ids, 1)::double precision
      / nullif(o.n_user_gene_ids, 0)::double precision
    ) / nullif(
      o.n_gs_gene_ids::double precision
      / nullif(o.n_background, 0)::double precision, 0) as odds_ratio,
    r.pvalue,
    r.adj_pvalue
  from
    overlap o
    inner join (
      select r.*
      from vectorized, internal.fishers_exact(vectorized.ids, vectorized.a, vectorized.b, vectorized.c, vectorized.d, vectorized.n, fdr, pvalue_less_than, adj_pvalue_less_than) r
    ) r on o.gene_set_id = r.id
  order by r.pvalue asc;
$$ language sql immutable strict parallel safe security definer;

grant execute on function app_public.gene_set_library_enrich_library_background to guest, authenticated;

create or replace function app_public.gene_set_library_enrich_user_background(
  gene_set_library app_public.gene_set_library,
  genes varchar[],
  background_genes varchar[],
  overlap_greater_than bigint default 0,
  fdr double precision default 0.05,
  pvalue_less_than double precision default 0.05,
  adj_pvalue_less_than double precision default 0.05
) returns setof app_public.gene_set_library_enrich_result
as $$
  with overlap as (
    select *
    from internal.gene_set_library_overlap_user_background(
      gene_set_library, genes, background_genes, overlap_greater_than
    )
  ), vectorized as (
    select
      array_agg(o.gene_set_id) as ids,
      array_agg(array_length(o.overlap_gene_ids, 1)::bigint) as a,
      array_agg(o.n_user_gene_ids - array_length(o.overlap_gene_ids, 1)) as b,
      array_agg(o.n_gs_gene_ids - array_length(o.overlap_gene_ids, 1)) as c,
      array_agg(o.n_background - o.n_user_gene_ids - n_gs_gene_ids + array_length(o.overlap_gene_ids, 1)) as d,
      (
        select count(id)
        from app_public.gene_set gs
        where gs.library_id = gene_set_library.id
      ) as n
    from overlap o
  )
  select
    r.id as gene_set_id,
    o.overlap_gene_ids,
    o.n_user_gene_ids,
    o.n_gs_gene_ids,
    o.n_background,
    (
      array_length(o.overlap_gene_ids, 1)::double precision
      / nullif(o.n_user_gene_ids, 0)::double precision
    ) / nullif(
      o.n_gs_gene_ids::double precision
      / nullif(o.n_background, 0)::double precision, 0) as odds_ratio,
    r.pvalue,
    r.adj_pvalue
  from
    overlap o
    inner join (
      select r.*
      from vectorized, internal.fishers_exact(vectorized.ids, vectorized.a, vectorized.b, vectorized.c, vectorized.d, vectorized.n, fdr, pvalue_less_than, adj_pvalue_less_than) r
    ) r on o.gene_set_id = r.id
  order by r.pvalue asc;
$$ language sql immutable strict parallel safe security definer;

grant execute on function app_public.gene_set_library_enrich_user_background to guest, authenticated;

--- This function can be used to get the gene_set out of the enrichment results type
create function app_public.gene_set_library_enrich_result_gene_set(
  gene_set_library_enrich_result app_public.gene_set_library_enrich_result
) returns app_public.gene_set
as $$
  select *
  from app_public.gene_set gs
  where gs.id = gene_set_library_enrich_result.gene_set_id;
$$ language sql immutable strict parallel safe;

grant execute on function app_public.gene_set_library_enrich_result_gene_set to guest, authenticated;

--- This function can be used to get the overlapping genes out of the enrichment results type
create function app_public.gene_set_library_enrich_result_overlap_genes(
  gene_set_library_enrich_result app_public.gene_set_library_enrich_result
) returns setof app_public.gene
as $$
  select g.*
  from unnest(gene_set_library_enrich_result.overlap_gene_ids) t(gene_id)
  inner join app_public.gene g on t.gene_id = g.id;
$$ language sql immutable strict parallel safe;

grant execute on function app_public.gene_set_library_enrich_result_overlap_genes to guest, authenticated;

create materialized view app_public.gene_set_pmc as
select gs.id, regexp_replace(gs.term, '^(^PMC\d+)(.*)$', '\1') as pmc
from app_public.gene_set gs;
comment on materialized view app_public.gene_set_pmc is E'@foreignKey (id) references app_public.gene_set (id)';

create unique index gene_set_pmc_id_pmc_idx on app_public.gene_set_pmc (id, pmc);
create index gene_set_pmc_id_idx on app_public.gene_set_pmc (id);
create index gene_set_pmc_pmc_idx on app_public.gene_set_pmc (pmc);

grant select on app_public.gene_set_pmc to guest;
grant all privileges on app_public.gene_set_pmc to authenticated;

create view app_public.pmc as select distinct pmc from app_public.gene_set_pmc;
comment on view app_public.pmc is E'@foreignKey (pmc) references app_public.gene_set_pmc (pmc)';

grant select on app_public.pmc to guest;
grant all privileges on app_public.pmc to authenticated;

-- migrate:down

drop schema app_public cascade;
drop schema internal cascade;
drop role guest;
drop role authenticated;
