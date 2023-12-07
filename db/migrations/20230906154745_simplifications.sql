-- migrate:up

-- simplification 1: gene_synonym collapsed into jsonb field of gene {gene_id: null, ...}
-- simplification 2: gene_set_gene collapsed into jsonb field of gene_set {gene_id: null, ...}
-- simplification 3: gene_set_library removed, replaced with background
-- improvement: overlap query optimized
-- improvement: fisher testing implemented in rust
-- improvement: enrichment query uses overlap => fisher testing

-- create extension if not exists "plrust";
create extension if not exists "uuid-ossp";
-- This gives us access to python functions
create extension if not exists "plpython3u";
-- fixup defaults from postgres
alter default privileges revoke execute on functions from public;

create role guest nologin;
create role authenticated nologin;

create extension if not exists "pg_trgm";
create schema app_public_v2;
create schema app_private_v2;
grant usage on schema app_public_v2 to guest, authenticated;

create table app_public_v2.gene (
  id uuid primary key default uuid_generate_v4(),
  symbol varchar not null unique,
  synonyms jsonb default '{}'::jsonb
);
create index on app_public_v2.gene using gin (synonyms);
grant select on table app_public_v2.gene to guest;
grant all privileges on table app_public_v2.gene to authenticated;

create table app_public_v2.gene_set (
  id uuid primary key default uuid_generate_v4(),
  term varchar not null unique,
  gene_ids jsonb not null,
  n_gene_ids int not null,
  species varchar not null
);
create index on app_public_v2.gene_set using gin (gene_ids);
create index on app_public_v2.gene_set using gin (term gin_trgm_ops);
create index idx_gene_set_species ON app_public_v2.gene_set (species);
grant select on table app_public_v2.gene_set to guest;
grant all privileges on table app_public_v2.gene_set to authenticated;

create or replace function app_public_v2.gene_map(genes varchar[])
returns table (
  gene_id uuid,
  gene varchar
) as $$
  select g.id as gene_id, ug.gene as gene
  from unnest(gene_map.genes) ug(gene)
  inner join app_public_v2.gene g on g.symbol = ug.gene or g.synonyms ? ug.gene;
$$ language sql immutable strict parallel safe;
grant execute on function app_public_v2.gene_map to guest, authenticated;

create table app_public_v2.background (
  id uuid primary key default uuid_generate_v4(),
  gene_ids jsonb not null,
  n_gene_ids int not null,
  species varchar not null
);
create index on app_public_v2.background using gin (gene_ids);
grant select on table app_public_v2.background to guest;
grant all privileges on table app_public_v2.background to authenticated;

-- create or replace function app_private_v2.fisher_testing(
--   gene_set_ids uuid[],
--   n_overlap_gene_ids int[],
--   n_gs_gene_ids int[],
--   n_user_gene_id int,
--   n_background int,
--   n_gene_set int,
--   pvalue_less_than double precision default 0.05,
--   adj_pvalue_less_than double precision default 0.05
-- ) returns table (
--   gene_set_id uuid,
--   pvalue double precision,
--   adj_pvalue double precision
-- ) as $$
--   import fisher
--   import numpy as np
--   import statsmodels.stats.multitest

--   a = np.array(n_overlap_gene_ids, dtype=np.uint)
--   b = np.uint(n_user_gene_id) - a
--   c = np.array(n_gs_gene_ids, dtype=np.uint) - a
--   d = np.uint(n_background) - b - c + a
--   # vectorized computation of contingency tables
--   # fisher testing on the contingency tables passing the overlap_greater_than criterion, otherwise 1
--   m = np.arange(n_gene_set) < len(gene_set_ids)
--   pvalues = np.ones(shape=m.shape[0])
--   _left_side, pvalues[m], _two_sided = fisher.pvalue_npy(a, b, c, d)
--   # we perform multiple hypothesis testing on the pvalues
--   _reject, adj_pvalues, _alphacSidak, _alphacBonf = statsmodels.stats.multitest.multipletests(pvalues, 0.05, 'fdr_bh')
--   pvalues = pvalues[m]
--   adj_pvalues = adj_pvalues[m]
--   # filter results by provided cutoffs
--   return_index, = np.where((pvalues <= pvalue_less_than) & (adj_pvalues <= adj_pvalue_less_than))
--   # sort by pvalue
--   return_sorted_index = return_index#[np.argsort(pvalues[return_index])]
--   # return relevant results
--   for i in return_sorted_index:
--     yield dict(
--       gene_set_id=gene_set_ids[i],
--       pvalue=pvalues[i],
--       adj_pvalue=adj_pvalues[i],
--     )
-- $$ language plpython3u immutable strict;
-- grant execute on function app_private_v2.fisher_testing to guest, authenticated;

-- create or replace function app_private_v2.fisher_testing(
--   gene_set_ids uuid[],
--   n_overlap_gene_ids int[],
--   n_gs_gene_ids int[],
--   n_user_gene_id int,
--   n_background int,
--   n_gene_set int,
--   pvalue_less_than double precision default 0.05,
--   adj_pvalue_less_than double precision default 0.05
-- ) returns table (
--   gene_set_id uuid,
--   pvalue double precision,
--   adj_pvalue double precision
-- ) as $$
-- [dependencies]
-- itertools = "0.8"
-- fishers_exact = "1.0.1"
-- adjustp = "0.1.4"

-- [code]
-- use itertools::izip;
-- use fishers_exact::fishers_exact;
-- use adjustp::{adjust, Procedure};

-- let mut pvalues: Vec<f64> = Vec::with_capacity(n_gene_set as usize);
-- for row in izip!(n_overlap_gene_ids, n_gs_gene_ids) {
--   if let (Some(n_overlap_gene_id), Some(n_gs_gene_id)) = row {
--     let a = n_overlap_gene_id as u32;
--     let b = (n_user_gene_id as u32) - a;
--     let c = (n_gs_gene_id as u32) - a;
--     let d = (n_background as u32) - b - c + a;
--     let table = [a, b, c, d];
--     let result = fishers_exact(&table).unwrap();
--     pvalues.push(result.greater_pvalue);
--   } else {
--     pvalues.push(1.0);
--   }
-- }
-- for _i in pvalues.len()..(n_gene_set as usize) {
--   pvalues.push(1.0);
-- }
-- let adjpvalues = adjust(&pvalues, Procedure::BenjaminiHochberg);
-- let as_tuples = TableIterator::new(
--   izip!(
--     gene_set_ids,
--     pvalues,
--     adjpvalues
--   ).into_iter()
--     .filter(move |(gene_set_id, pvalue, adjpvalue)| gene_set_id.is_some() && *pvalue < pvalue_less_than && *adjpvalue < adj_pvalue_less_than)
--     .map(|(gene_set_id, pvalue, adjpvalue)| (gene_set_id, Some(pvalue), Some(adjpvalue)))
-- );
-- Ok(Some(as_tuples))
-- $$ language plrust immutable strict;
-- grant execute on function app_private_v2.fisher_testing to guest, authenticated;

create or replace function app_public_v2.background_overlap(
  background app_public_v2.background,
  genes varchar[],
  overlap_greater_than int default 0
) returns table (
  gene_set_id uuid,
  n_overlap_gene_ids int,
  n_gs_gene_ids int
)
as $$
  select
    gs.id as gene_set_id,
    count(ig.gene_id) as n_overlap_gene_ids,
    gs.n_gene_ids as n_gs_gene_ids
  from
    (
      select distinct g.gene_id::text
      from app_public_v2.gene_map(background_overlap.genes) g
    ) ig
    inner join app_public_v2.gene_set gs on gs.gene_ids ? ig.gene_id
  group by gs.id
  having count(ig.gene_id) > background_overlap.overlap_greater_than;
$$ language sql immutable strict;
grant execute on function app_public_v2.background_overlap to guest, authenticated;

create type app_public_v2.enrich_result as (
  gene_set_id uuid,
  n_overlap int,
  odds_ratio double precision,
  pvalue double precision,
  adj_pvalue double precision
);
comment on type app_public_v2.enrich_result is E'@foreign key (gene_set_id) references app_public_v2.gene_set (id)';

create or replace function app_public_v2.enrich_result_gene_set(enrich_result app_public_v2.enrich_result) returns app_public_v2.gene_set
as $$
  select gs.*
  from app_public_v2.gene_set gs
  where gs.id = enrich_result.gene_set_id;
$$ language sql immutable strict;
grant execute on function app_public_v2.enrich_result_gene_set to guest, authenticated;

create or replace function app_public_v2.gene_set_genes(gene_set app_public_v2.gene_set)
returns setof app_public_v2.gene as
$$
  select g.*
  from app_public_v2.gene g
  where gene_set_genes.gene_set.gene_ids ? g.id::text;
$$ language sql immutable strict parallel safe;
grant execute on function app_public_v2.gene_set_genes to guest, authenticated;

create or replace function app_public_v2.gene_set_overlap(
  gene_set app_public_v2.gene_set,
  genes varchar[]
) returns setof app_public_v2.gene
as $$
  select distinct g.*
  from app_public_v2.gene_map(gene_set_overlap.genes) gm
  inner join app_public_v2.gene g on g.id = gm.gene_id
  where gene_set.gene_ids ? gm.gene_id::text;
$$ language sql immutable strict;
grant execute on function app_public_v2.gene_set_overlap to guest, authenticated;


-- unchanged

create table app_public_v2.user_gene_set (
  id uuid primary key default uuid_generate_v4(),
  genes varchar[],
  description varchar default '',
  created timestamp not null default now()
);
grant select on table app_public_v2.user_gene_set to guest;
grant all privileges on table app_public_v2.user_gene_set to authenticated;
create or replace function app_public_v2.add_user_gene_set(
  genes varchar[],
  description varchar default ''
) returns app_public_v2.user_gene_set
as $$
  insert into app_public_v2.user_gene_set (genes, description)
  select
    (
      select array_agg(ug.gene order by ug.gene)
      from unnest(add_user_gene_set.genes) ug(gene)
    ) as genes,
    add_user_gene_set.description
  returning *;
$$ language sql security definer;
grant execute on function app_public_v2.add_user_gene_set to guest, authenticated;

create or replace function app_public_v2.gene_set_term_search(terms varchar[]) returns setof app_public_v2.gene_set
as $$
  select distinct gs.*
  from app_public_v2.gene_set gs
  inner join unnest(terms) ut(term) on gs.term ilike ('%' || ut.term || '%');
$$ language sql immutable strict parallel safe;
grant execute on function app_public_v2.gene_set_term_search to guest, authenticated;

create or replace function app_public_v2.gene_set_gene_search(genes varchar[]) returns setof app_public_v2.gene_set
as $$
  select distinct gs.*
  from
    app_public_v2.gene_map(genes) g
    inner join app_public_v2.gene_set gs on gs.gene_ids ? g.gene_id::text;
$$ language sql immutable strict parallel safe;
grant execute on function app_public_v2.gene_set_gene_search to guest, authenticated;

create materialized view app_public_v2.gene_set_pmc as
select gs.id, regexp_replace(gs.term, '^(^PMC\d+)(.*)$', '\1') as pmc
from app_public_v2.gene_set gs;
comment on materialized view app_public_v2.gene_set_pmc is E'@foreignKey (id) references app_public_v2.gene_set (id)';

create unique index gene_set_pmc_id_pmc_idx on app_public_v2.gene_set_pmc (id, pmc);
create index gene_set_pmc_id_idx on app_public_v2.gene_set_pmc (id);
create index gene_set_pmc_pmc_idx on app_public_v2.gene_set_pmc (pmc);

grant select on app_public_v2.gene_set_pmc to guest;
grant all privileges on app_public_v2.gene_set_pmc to authenticated;

create view app_public_v2.pmc as select distinct pmc from app_public_v2.gene_set_pmc;
comment on view app_public_v2.pmc is E'@foreignKey (pmc) references app_public_v2.gene_set_pmc (pmc)';

grant select on app_public_v2.pmc to guest;
grant all privileges on app_public_v2.pmc to authenticated;

create table app_public_v2.pmc_info (
  id uuid primary key default uuid_generate_v4(),
  pmcid varchar not null unique,
  title varchar,
  yr int,
  doi varchar
);
comment on table app_public_v2.pmc_info is E'@foreignKey (pmcid) references app_public_v2.gene_set_pmc (pmc)';
grant select on table app_public_v2.pmc_info to guest;
grant all privileges on table app_public_v2.pmc_info to authenticated;

create or replace function app_public_v2.get_pmc_info_by_ids(pmcids varchar[])
returns setof app_public_v2.pmc_info as
$$
  select *
  from app_public_v2.pmc_info
  where pmcid = ANY (pmcIds);
$$ language sql immutable strict parallel safe;
grant execute on function app_public_v2.get_pmc_info_by_ids to guest, authenticated;

create or replace function app_public_v2.terms_pmcs_count(pmcids varchar[])
returns table (pmc varchar, term varchar, id uuid, count int) as
$$
  select gsp.pmc, gs.term, gs.id, gs.n_gene_ids as count
  from 
    app_public_v2.gene_set_pmc as gsp
    inner join app_public_v2.gene_set as gs on gs.id = gsp.id
  where gsp.pmc = ANY (pmcids);
$$ language sql immutable strict parallel safe;
grant execute on function app_public_v2.terms_pmcs_count to guest, authenticated;


-- migrate:down
drop schema app_public_v2 cascade;
drop schema app_private_v2 cascade;
