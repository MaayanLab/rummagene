-- migrate:up

-- This gives us uuid support
create extension if not exists "uuid-ossp";

-- This gives us access to python functions
create extension if not exists "plpython3u";

-- Everything in this schema is exposed via postgraphile
create schema app_public;

-- This table disambiguates genes by symbol and a set of synonyms
--  stored in a jsonb object (in the keys of the object, values don't matter)
create table app_public.gene (
  id uuid primary key default uuid_generate_v4(),
  symbol varchar not null,
  synonyms jsonb not null default '{}',
  check (jsonb_typeof(synonyms) = 'object')
);

-- This function can be used to produce a map from a the provided genes to the gene_id
create function app_public.gene_id_map_from_genes(genes varchar[]) returns jsonb
as $$
  select coalesce(jsonb_object_agg(t.gene, g.id), '{}'::jsonb)
  from unnest(genes) as t(gene)
  left join app_public.gene g
    on g.symbol = t.gene or g.synonyms ? t.gene
  where g.id is not null;
$$ language sql immutable;

-- This function can be used to produce a set of genes given genes
create function app_public.gene_record_from_genes(genes varchar[]) returns setof app_public.gene
as $$
  select distinct g.*
  from unnest(genes) as t(gene)
  inner join app_public.gene g
    on g.symbol = t.gene or g.synonyms ? t.gene;
$$ language sql immutable;

-- This table stores gene set libraries, containing a bunch of gene sets
create table app_public.gene_set_library (
  id uuid primary key default uuid_generate_v4(),
  name varchar not null,
  description varchar not null,
  background_gene_ids jsonb not null default '{}',
  created timestamp not null default now(),
  check (jsonb_typeof(background_gene_ids) = 'object')
);

-- This is a labeled gene set (effectively a row in a GMT) in a gene_set_library
create table app_public.gene_set (
  id uuid primary key default uuid_generate_v4(),
  library_id uuid not null references app_public.gene_set_library (id) on delete cascade,
  term varchar not null,
  description varchar not null default '',
  gene_ids jsonb not null default '{}',
  check (jsonb_typeof(gene_ids) = 'object')
);

-- This function can be used to get the gene records out of the gene_set
--  which are stored in the gene_ids field
create function app_public.gene_set_genes(gene app_public.gene_set) returns setof app_public.gene
as $$
  select distinct g.*
  from jsonb_each(gene.gene_ids) t(key, value)
  left join app_public.gene g on g.id = t.key::uuid
$$ language sql immutable;

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
$$ language sql immutable;

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
$$ language sql immutable;

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
$$ language sql immutable;

--- This function can be used to get the overlapping genes out of the enrichment results type
create function app_public.gene_set_library_enrichment_result_overlap_genes(
  gene_set_library_enrichment_result app_public.gene_set_library_enrichment_result
) returns setof app_public.gene
as $$
  select g.*
  from unnest(gene_set_library_enrichment_result.overlap_gene_ids) t(gene_id)
  inner join app_public.gene g on t.gene_id = g.id;
$$ language sql immutable;

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
  import json
  import fisher
  import numpy as np
  import statsmodels.stats.multitest

  # convert genes to gene_ids
  gene_ids, = plpy.cursor(
    plpy.prepare(
      'select array_agg(id) as gene_ids from app_public.gene_record_from_genes($1)',
      [
        'varchar[]',
      ]
    ),
    [genes]
  )
  gene_ids = gene_ids['gene_ids']

  s_gene_set_library_background = set(json.loads(gene_set_library['background_gene_ids']))
  if background_genes is None:
    background_gene_ids = gene_set_library['background_gene_ids']
    s_background = s_gene_set_library_background
  else:
    background_gene_ids, = plpy.cursor(
      plpy.prepare(
        'select array_agg(id) as background_gene_ids from app_public.gene_record_from_genes($1)',
        [
          'varchar[]',
        ]
      ),
      background_genes
    )
    background_gene_ids = background_gene_ids['background_gene_ids']
    s_background = set(background_gene_ids) & s_gene_set_library_background
  s_user_gene_set = set(gene_ids) & s_background

  result_gene_sets = []
  result_pvalues = []
  result_overlap_gene_ids = []
  a_values = []
  b_values = []
  c_values = []
  d_values = []
  for row in plpy.cursor(
    plpy.prepare(
      'select * from app_public.gene_set gs where gs.library_id = $1',
      ['uuid']
    ),
    [gene_set_library['id']]
  ):
    result_gene_sets.append(row['id'])
    s_row_gene_set = set(json.loads(row['gene_ids'])) & s_background
    s_overlap = s_user_gene_set & s_row_gene_set
    a = len(s_overlap)
      b = len(s_user_gene_set) - a
      c = len(s_row_gene_set) - a
      d = len(s_background) - len(s_user_gene_set) - len(s_row_gene_set) + a
    a_values.append(a)
    b_values.append(b)
    c_values.append(c)
    d_values.append(d)
    if return_overlap_gene_ids and a > overlap_greater_than:
      overlap_gene_ids = list(s_overlap)
    else:
      overlap_gene_ids = None
    result_overlap_gene_ids.append(overlap_gene_ids)
  _, result_pvalues, _ = fisher.pvalue_npy(
    np.array(a_values, dtype=np.uint), np.array(b_values, dtype=np.uint),
    np.array(c_values, dtype=np.uint), np.array(d_values, dtype=np.uint)
  )
  try:
    reject, result_adj_pvalues, alphacSidak, alphacBonf = statsmodels.stats.multitest.multipletests(
      result_pvalues,
      fdr,
      'fdr_bh',
    )
    result_adj_pvalues = np.nan_to_num(result_adj_pvalues, nan=1.0)
  except:
    result_adj_pvalues = np.ones(len(result_pvalues))
  result_pvalues = np.nan_to_num(result_pvalues, nan=1.0)

  # return the results in sorted order (lowest pvalue first)
  for i in np.argsort(result_pvalues)[::-1]:
    record = dict(
      gene_set_id=result_gene_sets[i],
      pvalue=result_pvalues[i],
      adj_pvalue=result_adj_pvalues[i],
      overlap=a_values[i],
      overlap_gene_ids=result_overlap_gene_ids[i],
    )
    if (
      record['pvalue'] <= pvalue_less_than
      and record['adj_pvalue'] <= adj_pvalue_less_than
      and record['overlap'] > overlap_greater_than
    ):
      yield record
$$ language plpython3u immutable;

-- This function helps you import a gene set library by url
create function app_public.import_gene_set_library(
  download_url varchar,
  name varchar,
  description varchar
) returns app_public.gene_set_library
as $$
  import uuid
  import json
  import fsspec
  import more_itertools as mit

  # fetch the gene_set, gather the background genes
  new_gene_sets = []
  background_genes = set()
  with fsspec.open(download_url, 'r') as fr:
    for line in filter(None, map(str.strip, fr)):
      term, description, *genes = line.split('\t')
      new_gene_sets.append((term, description, genes))
      background_genes.update(genes)

  # get a mapping from background_genes to background_gene_ids
  gene_id_map, = plpy.cursor(
    plpy.prepare(
      'select app_public.gene_id_map_from_genes($1) as gene_id_map',
      [
        'varchar[]'
      ]
    ),
    [list(background_genes)]
  )
  gene_id_map = json.loads(gene_id_map['gene_id_map'])

  # upsert any new genes not in the mapping & add them to the mapping
  new_genes = background_genes - gene_id_map.keys()
  if new_genes:
    for some_new_genes in mit.chunked(new_genes, 1000):
      gene_id_map.update({
        gene['symbol']: gene['id']
        for gene in plpy.cursor(
          plpy.prepare(
            'insert into app_public.gene (symbol) select * from unnest($1) returning *',
            [
              'varchar[]'
            ]
          ),
          [list(some_new_genes)]
        )
      })

  # create the gene_set_library
  gene_set_library, = plpy.cursor(
    plpy.prepare(
      'insert into app_public.gene_set_library (name, description, background_gene_ids) values ($1, $2, $3) returning *',
      ['varchar', 'varchar', 'jsonb']
    ),
    [name, description, json.dumps({ gene_id_map[gene]: None for gene in background_genes })],
  )

  # create the gene_sets
  for some_new_gene_sets in mit.chunked(new_gene_sets, 100):
    plpy.execute(
      plpy.prepare(
        'insert into app_public.gene_set (library_id, term, description, gene_ids) select * from jsonb_to_recordset($1) as t(library_id uuid, term varchar, description varchar, gene_ids jsonb)',
        ['jsonb']
      ),
      [json.dumps([
        dict(
          library_id=gene_set_library['id'],
          term=term,
          description=description,
          gene_ids={ gene_id_map[gene]: None for gene in gene_set },
        )
        for term, description, gene_set in some_new_gene_sets
      ])]
    )

  return gene_set_library
$$ language plpython3u;

-- migrate:down

drop schema app_public cascade;
