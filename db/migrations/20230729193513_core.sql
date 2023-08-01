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
  symbol varchar not null,
  synonyms jsonb not null default '{}',
  check (jsonb_typeof(synonyms) = 'object')
);

create index on app_public.gene using btree (symbol);
create index on app_public.gene using gin (synonyms);

grant select on table app_public.gene to guest;
grant all privileges on table app_public.gene to authenticated;

-- This function can be used to produce a map from a the provided genes to the gene_id
create function app_public.gene_id_map_from_genes(genes varchar[]) returns jsonb
as $$
  select coalesce(jsonb_object_agg(t.gene, g.id), '{}'::jsonb)
  from unnest(genes) as t(gene)
  inner join app_public.gene g
    on g.symbol = t.gene or g.synonyms ? t.gene;
$$ language sql immutable strict parallel safe;

grant execute on function app_public.gene_id_map_from_genes(genes varchar[]) to guest, authenticated;

-- This function can be used to produce a set of genes given genes
create function app_public.gene_record_from_genes(genes varchar[]) returns setof app_public.gene
as $$
  select distinct g.*
  from unnest(genes) as t(gene)
  inner join app_public.gene g
    on g.symbol = t.gene or g.synonyms ? t.gene;
$$ language sql immutable strict parallel safe;

grant execute on function app_public.gene_record_from_genes(genes varchar[]) to guest, authenticated;

-- This table stores gene set libraries, containing a bunch of gene sets
create table app_public.gene_set_library (
  id uuid primary key default uuid_generate_v4(),
  name varchar not null,
  description varchar not null,
  background_gene_ids jsonb not null default '{}',
  created timestamp not null default now(),
  check (jsonb_typeof(background_gene_ids) = 'object')
);

create index on app_public.gene_set_library using btree (name);

grant select on table app_public.gene_set_library to guest;
grant all privileges on table app_public.gene_set_library to authenticated;

-- This is a labeled gene set (effectively a row in a GMT) in a gene_set_library
create table app_public.gene_set (
  id uuid primary key default uuid_generate_v4(),
  library_id uuid not null references app_public.gene_set_library (id) on delete cascade,
  term varchar not null,
  description varchar not null default '',
  gene_ids jsonb not null default '{}',
  check (jsonb_typeof(gene_ids) = 'object')
);

create index on app_public.gene_set using hash (library_id);
create index on app_public.gene_set using btree (term);
create index on app_public.gene_set using gin (gene_ids);

grant select on table app_public.gene_set to guest;
grant all privileges on table app_public.gene_set to authenticated;

-- This function can be used to get the gene records out of the gene_set
--  which are stored in the gene_ids field
create function app_public.gene_set_genes(gene app_public.gene_set) returns setof app_public.gene
as $$
  select distinct g.*
  from jsonb_each(gene.gene_ids) t(key, value)
  left join app_public.gene g on g.id = t.key::uuid
$$ language sql immutable strict parallel safe;

grant execute on function app_public.gene_set_genes(gene app_public.gene_set) to guest, authenticated;

-- This function can be used to return all gene sets with some set of terms present
create function app_public.gene_set_term_search(terms varchar[]) returns setof app_public.gene_set
as $$
  select gs.*
  from app_public.gene_set gs
  where exists (
    select 1
    from unnest(terms) q(term)
    where gs.term ilike ('%' || q.term || '%')
  );
$$ language sql immutable strict parallel safe;

grant execute on function app_public.gene_set_term_search(terms varchar[]) to guest, authenticated;

-- This function can be used to return all gene sets containing some set of genes
create function app_public.gene_set_gene_search(genes varchar[]) returns setof app_public.gene_set
as $$
  with query as (
    select jsonb_object_agg(gene_record.id, null) as gene_ids
    from app_public.gene_record_from_genes(genes) gene_record
  )
  select gs.*
  from app_public.gene_set gs, query q
  where gs.gene_ids @> q.gene_ids;
$$ language sql immutable strict parallel safe;

grant execute on function app_public.gene_set_gene_search(genes varchar[]) to guest, authenticated;

-- Enrichment results for a given gene_set
create type app_public.gene_set_library_enrichment_result as (
  gene_set_id uuid,-- references app_public.gene_set (id),
  pvalue double precision,
  adj_pvalue double precision,
  overlap integer,
  overlap_gene_ids uuid[]
);

--- This function can be used to get the gene_set out of the enrichment results type
create function app_public.gene_set_library_enrichment_result_gene_set(
  gene_set_library_enrichment_result app_public.gene_set_library_enrichment_result
) returns app_public.gene_set
as $$
  select *
  from app_public.gene_set gs
  where gs.id = gene_set_library_enrichment_result.gene_set_id;
$$ language sql immutable strict parallel safe;

grant execute on function app_public.gene_set_library_enrichment_result_gene_set(
  gene_set_library_enrichment_result app_public.gene_set_library_enrichment_result
) to guest, authenticated;

--- This function can be used to get the overlapping genes out of the enrichment results type
create function app_public.gene_set_library_enrichment_result_overlap_genes(
  gene_set_library_enrichment_result app_public.gene_set_library_enrichment_result
) returns setof app_public.gene
as $$
  select g.*
  from unnest(gene_set_library_enrichment_result.overlap_gene_ids) t(gene_id)
  inner join app_public.gene g on t.gene_id = g.id;
$$ language sql immutable strict parallel safe;

grant execute on function app_public.gene_set_library_enrichment_result_overlap_genes(
  gene_set_library_enrichment_result app_public.gene_set_library_enrichment_result
) to guest, authenticated;

-- This function lets you do enrichment analysis on a gene_set, for a given
--  gene_set_library. It supports providing background genes, and specifying
--  fpr/pvalue/adj pvalue cutoffs
create function app_public.gene_set_library_enrich(
  gene_set_library app_public.gene_set_library,
  genes varchar[],
  background_genes varchar[] default null,
  fdr double precision default 0.05,
  pvalue_less_than double precision default 0.05,
  adj_pvalue_less_than double precision default 0.05,
  return_overlap_gene_ids boolean default false,
  overlap_greater_than integer default 0
) returns setof app_public.gene_set_library_enrichment_result
as $$
  import sigcomlite
  yield from sigcomlite.gene_set_library_enrich(
    plpy,
    gene_set_library,
    genes,
    background_genes,
    fdr,
    pvalue_less_than,
    adj_pvalue_less_than,
    return_overlap_gene_ids,
    overlap_greater_than,
  )
$$ language plpython3u immutable parallel safe cost 1000 rows 1000;

grant execute on function app_public.gene_set_library_enrich(
  gene_set_library app_public.gene_set_library,
  genes varchar[],
  background_genes varchar[],
  fdr double precision,
  pvalue_less_than double precision,
  adj_pvalue_less_than double precision,
  return_overlap_gene_ids boolean,
  overlap_greater_than integer
) to guest, authenticated;

-- This function helps you import a gene set library by url
create function app_public.import_gene_set_library(
  download_url varchar,
  name varchar,
  description varchar
) returns app_public.gene_set_library
as $$
  import sigcomlite
  return sigcomlite.import_gene_set_library(
    plpy,
    download_url,
    name,
    description,
  )
$$ language plpython3u strict;

grant execute on function app_public.import_gene_set_library(
  download_url varchar,
  name varchar,
  description varchar
) to authenticated;

create function internal.jsonb_set_length(a jsonb) returns bigint
as $$
  select count(*)
  from jsonb_object_keys(a);
$$ language sql strict immutable parallel safe;
create function internal.jsonb_set_intersection(a jsonb, b jsonb) returns jsonb
as $$
  select coalesce(jsonb_object_agg(A.k, null), '{}'::jsonb)
  from jsonb_each(a) A(k)
  inner join jsonb_each(b) B(k) on A.k = B.k;
$$ language sql strict immutable parallel safe;

create function internal.jsonb_set_diff(a jsonb, b jsonb) returns jsonb
as $$
  select a #- array_agg(B.k)
  from jsonb_object_keys(b) B(k);
$$ language sql strict immutable parallel safe;

create type internal.gene_set_library_overlap_stats_result as (
  gene_set_id uuid,-- references app_public.gene_set (id),
  pvalue double precision,
  adj_pvalue double precision
);

create function internal.gene_set_library_overlap_stats(
  gene_set_ids uuid[],
  a double precision[],
  b double precision[],
  c double precision[],
  d double precision[],
  fdr double precision default 0.05, 
  pvalue_less_than double precision default 0.05,
  adj_pvalue_less_than double precision default 0.05
) returns internal.gene_set_library_overlap_stats_result
as $$
  import fisher
  import numpy as np

  _left_side, pvalues, _two_sided = fisher.pvalue_npy(
    np.array(a_values, dtype=np.uint), np.array(b_values, dtype=np.uint),
    np.array(c_values, dtype=np.uint), np.array(d_values, dtype=np.uint)
  )
  try:
    _reject, adj_pvalues, _alphacSidak, _alphacBonf = statsmodels.stats.multitest.multipletests(
      pvalues,
      fdr,
      'fdr_bh',
    )
    adj_pvalues = np.nan_to_num(adj_pvalues, nan=1.0)
  except:
    adj_pvalues = np.ones(len(pvalues))
  pvalues = np.nan_to_num(pvalues, nan=1.0)
  for i in np.argsort(pvalues)[::-1]:
    if pvalues[i] <= pvalue_less_than and adj_pvalues[i] < adj_pvalue_less_than:
      yield dict(
        gene_set_id=gene_set_ids[i],
        pvalue=pvalues[i],
        adj_pvalue=adj_pvalues[i],
      )
$$ language plpython3u strict immutable parallel safe;

create type internal.enrich_result as (
  library_id uuid,
  gene_set_id uuid,
  pvalue double precision,
  adj_pvalue double precision,
  overlap_gene_ids uuid[]
);

create function internal.enrich(
  gene_set_library_ids uuid[],
  gene_ids uuid[],
  background_gene_ids uuid[],
  fdr double precision default 0.05, 
  pvalue_less_than double precision default 0.05,
  adj_pvalue_less_than double precision default 0.05
) returns internal.enrich_result
as $$
  with user_input as (
    -- convert array to jsonb_sets
    select
      (select jsonb_object_agg(t.gene_id, null) from unnest(gene_ids) t(gene_id)) as gene_ids,
      (select jsonb_object_agg(t.background_gene_id, null) from unnest(enrich.background_gene_ids) t(background_gene_id)) as background_gene_ids
  ), prep as (
    -- prepare relevant sets (user gene set, gene set from library) & n_background_genes
    select
      gs.id as gene_set_id,
      gs.library_id as library_id,
      internal.jsonb_set_intersection(
        user_input.gene_ids,
        internal.jsonb_set_intersection(
          user_input.background_gene_ids, gsl.background_gene_ids
        )
      ) as user_gene_ids,
      internal.jsonb_set_intersection(
        gs.gene_ids,
        internal.jsonb_set_intersection(
          user_input.background_gene_ids, gsl.background_gene_ids
        )
      ) as gs_gene_ids,
      internal.jsonb_set_intersection(
        user_input.gene_ids,
        internal.jsonb_set_intersection(
          gs.gene_ids,
          internal.jsonb_set_intersection(user_input.background_gene_ids, gsl.background_gene_ids)
        )
      ) as overlap_gene_ids,
      internal.jsonb_set_length(internal.jsonb_set_intersection(user_input.background_gene_ids, gsl.background_gene_ids)) as n_background_gene_ids
    from
      user_input,
      app_public.gene_set_library gsl
      left join app_public.gene_set gs on gs.library_id = gsl.id
    where gsl.id = any(gene_set_library_ids)
  ), agg as (
    -- for each library, prepare a, b, c, d vectors ready for fisher testing
    select
      prep.library_id,
      count(prep.gene_set_id)
      array_agg(prep.gene_set_id) as gene_set_ids,
      array_agg(internal.jsonb_set_length(prep.overlap_gene_ids)) as a,
      array_agg(internal.jsonb_set_length(prep.user_gene_ids) - internal.jsonb_set_length(prep.overlap_gene_ids)) as b,
      array_agg(internal.jsonb_set_length(prep.gs_gene_ids) - internal.jsonb_set_length(prep.overlap_gene_ids)) as c,
      array_agg(prep.n_background_gene_ids - internal.jsonb_set_length(prep.user_gene_ids) - internal.jsonb_set_length(prep.gs_gene_ids) + internal.jsonb_set_length(prep.overlap_gene_ids)) as d
    from prep
    group by prep.library_id
  )
  -- after computing the overlap_stats for each library, construct the final results
  select
    agg.library_id,
    s.gene_set_id,
    s.pvalue,
    s.adj_pvalue,
    jsonb_object_keys(prep.overlap_gene_ids)::uuid[]
  from
    agg,
    internal.gene_set_library_overlap_stats(
      agg.gene_set_ids, agg.a, agg.b, agg.c, agg.d,
      fdr, pvalue_less_than, adj_pvalue_less_than
    ) s
    inner join prep on s.gene_set_id = prep.gene_set_id;
$$ language sql strict immutable parallel safe;

create or replace function app_public.gene_set_library_test(
  gene_set_library app_public.gene_set_library,
  genes varchar[],
  background_genes varchar[] default null,
  fdr double precision default 0.05,
  pvalue_less_than double precision default 0.05,
  adj_pvalue_less_than double precision default 0.05,
  return_overlap_gene_ids boolean default false,
  overlap_greater_than integer default 0
) returns setof app_public.gene_set_library_enrichment_result
as $$
  select
    r.gene_set_id,
    r.pvalue,
    r.adj_pvalue,
    array_length(r.overlap_gene_ids, 1) as overlap,
    r.overlap_gene_ids
  from internal.enrich(
    array[gene_set_library.id],
    (select array_agg(id) from app_public.gene_record_from_genes(genes)),
    (select array_agg(id) from app_public.gene_record_from_genes(background_genes))
  ) r;
$$ language sql immutable parallel safe security definer;

grant execute on function app_public.gene_set_library_test(
  gene_set_library app_public.gene_set_library,
  genes varchar[],
  background_genes varchar[],
  fdr double precision,
  pvalue_less_than double precision,
  adj_pvalue_less_than double precision,
  return_overlap_gene_ids boolean,
  overlap_greater_than integer
) to guest, authenticated;

-- migrate:down

drop schema app_public cascade;
drop schema internal cascade;
drop role guest;
drop role authenticated;
