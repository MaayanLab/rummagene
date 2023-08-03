def fishers_exact(
  ids: list[str],
  a: list[int],
  b: list[int],
  c: list[int],
  d: list[int],
  n: int,
  fdr: float = 0.05,
  pvalue_less_than: float = 0.05,
  adj_pvalue_less_than: float = 0.05,
):
  import fisher
  import numpy as np
  import statsmodels.stats.multitest

  _left_side, pvalues, _two_sided = fisher.pvalue_npy(
    np.array(a, dtype=np.uint), np.array(b, dtype=np.uint),
    np.array(c, dtype=np.uint), np.array(d, dtype=np.uint),
  )
  if len(pvalues) < n:
    # we do not have all values, assume the rest are insignificant
    #  so we have the right number of p-values for multiple hypothesis testing correction
    pvalues = np.concatenate([pvalues, np.ones(n - len(pvalues))])
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
  for i in np.argsort(pvalues):
    if pvalues[i] <= pvalue_less_than and adj_pvalues[i] <= adj_pvalue_less_than and i < len(ids):
      yield dict(
        id=ids[i],
        pvalue=pvalues[i],
        adj_pvalue=adj_pvalues[i],
      )

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
        re.split(r'[;,:\s]', raw_gene)[0]
        for raw_gene in map(str.strip, raw_genes)
        if raw_gene
      ]
      new_gene_sets.append((term, description, genes))
      background_genes.update(genes)

  # get a mapping from background_genes to background_gene_ids
  gene_id_map, = plpy.cursor(
    plpy.prepare(
      'select internal.gene_id_map_from_genes($1) as gene_id_map',
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
        'insert into app_public.gene_set (id, library_id, term, description) select * from jsonb_to_recordset($1) as t(id uuid, library_id uuid, term varchar, description varchar)',
        ['jsonb']
      ),
      [json.dumps([
        dict(
          id=id,
          library_id=gene_set_library['id'],
          term=term,
          description=description,
        )
        for id, term, description, _gene_set in some_new_gene_sets
        if len(term) < 200
      ])]
    )
    plpy.execute(
      plpy.prepare(
        'insert into app_public.gene_set_gene (gene_set_id, gene_id) select * from jsonb_to_recordset($1) as t(gene_set_id uuid, gene_id uuid)',
        ['jsonb']
      ),
      [json.dumps([
        dict(
          gene_set_id=id,
          gene_id=gene_id,
        )
        for id, term, _description, gene_set in some_new_gene_sets
        for gene_id in set(
          gene_id_map[gene]
          for gene in gene_set
        )
        if len(term) < 200
      ])]
    )

  return gene_set_library
