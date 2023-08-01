def gene_set_library_enrich(
  plpy,
  gene_set_library,
  genes: list[str],
  background_genes: list[str] = None,
  fdr = 0.05,
  pvalue_less_than = 0.05,
  adj_pvalue_less_than = 0.05,
  return_overlap_gene_ids = False,
  overlap_greater_than = 0,
):
  import json
  import fisher
  import numpy as np
  import statsmodels.stats.multitest

  # convert genes to gene_ids
  gene_ids, = plpy.cursor(
    plpy.prepare(
      'select array_agg(id) as gene_ids from app_public.gene_record_from_genes($1)',
      ['varchar[]']
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
        ['varchar[]']
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
      'select id, jsonb_object_keys(gs.gene_ids) as gene_ids from app_public.gene_set gs where gs.library_id = $1',
      ['uuid']
    ),
    [gene_set_library['id']]
  ):
    result_gene_sets.append(row['id'])
    s_row_gene_set = set(row['gene_ids']) & s_background
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
  _left_side, result_pvalues, _two_sided = fisher.pvalue_npy(
    np.array(a_values, dtype=np.uint), np.array(b_values, dtype=np.uint),
    np.array(c_values, dtype=np.uint), np.array(d_values, dtype=np.uint)
  )
  try:
    _reject, result_adj_pvalues, _alphacSidak, _alphacBonf = statsmodels.stats.multitest.multipletests(
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

def import_gene_set_library(
  plpy,
  download_url: str,
  name: str,
  description: str,
):
  import re
  import json
  import fsspec
  import more_itertools as mit

  # fetch the gene_set, gather the background genes
  new_gene_sets = []
  background_genes = set()
  with fsspec.open(download_url, 'r') as fr:
    for line in filter(None, map(str.strip, fr)):
      term, description, *raw_genes = line.split('\t')
      genes = [
        re.split(r'[,:\s]', raw_gene)[0]
        for raw_gene in map(str.strip, raw_genes)
        if raw_gene
      ]
      new_gene_sets.append((term, description, genes))
      background_genes.update(genes)

  # get a mapping from background_genes to background_gene_ids
  gene_id_map, = plpy.cursor(
    plpy.prepare(
      'select app_public.gene_id_map_from_genes($1) as gene_id_map',
      ['varchar[]']
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
            'insert into app_public.gene (symbol) select * from unnest($1) returning id, symbol',
            ['varchar[]']
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
