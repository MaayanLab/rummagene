-- migrate:up

-- This gives us uuid support
create extension if not exists "uuid-ossp";

-- This gives us access to python functions
create extension if not exists "plpython3u";

-- fixup defaults from postgres
alter default privileges revoke execute on functions from public;

-- Everything in this schema is exposed via postgraphile
create schema app_public;

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

-- migrate:down

drop schema app_public cascade;
drop role guest;
drop role authenticated;
