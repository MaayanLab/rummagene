import click
from pathlib import Path
from tqdm import tqdm
from helper.cli import cli
from helper.utils import copy_from_records

def import_gene_set_library(
  plpy,
  library: Path | str,
  prefix='',
  postfix='',
):
  import re
  import json
  import uuid

  # fetch the gene_set, gather the background genes
  new_gene_sets = []
  background_genes = set()
  n_geneset_genes = 0
  with Path(library).open('r') as fr:
    for line in tqdm(fr, desc='Loading gmt...'):
      line_split = line.strip().split('\t')
      if len(line_split) < 3: continue
      term, description, *raw_genes = line_split
      genes = [
        cleaned_gene
        for raw_gene in map(str.strip, raw_genes)
        if raw_gene
        for cleaned_gene in (re.split(r'[;,:\s]', raw_gene)[0],)
        if cleaned_gene
      ]
      new_gene_sets.append(dict(
        term=prefix+term+postfix,
        description=description,
        genes=genes,
        hash=uuid.uuid5(uuid.UUID('00000000-0000-0000-0000-000000000000'), '\t'.join(sorted(set(genes)))),
      ))
      background_genes.update(genes)
      n_geneset_genes += len(genes)

  # get a mapping from background_genes to background_gene_ids
  gene_map, = plpy.cursor(
    plpy.prepare(
      '''
        select coalesce(jsonb_object_agg(g.gene, g.gene_id), '{}') as gene_map
        from app_public_v2.gene_map($1) as g
      ''',
      ['varchar[]']
    ),
    [list(background_genes)]
  )
  gene_map = json.loads(gene_map['gene_map'])

  # upsert any new genes not in the mapping & add them to the mapping
  new_genes = {
    id: dict(id=id, symbol=gene)
    for gene in tqdm(background_genes - gene_map.keys(), desc='Preparing new genes...')
    for id in (str(uuid.uuid4()),)
  }
  if new_genes:
    copy_from_records(
      plpy.conn, 'app_public_v2.gene', ('id', 'symbol',),
      tqdm(new_genes.values(), desc='Inserting new genes...'))
    gene_map.update({
      new_gene['symbol']: new_gene['id']
      for new_gene in new_genes.values()
    })

  existing = {
    (row['term'], row['description'], row['hash'])
    for row in plpy.cursor('select term, description, hash from app_public_v2.gene_set', tuple())
  }

  copy_from_records(
    plpy.conn, 'app_public_v2.gene_set', ('term', 'description', 'hash', 'gene_ids', 'n_gene_ids'),
    tqdm((
      dict(
        term=gene_set['term'],
        description=gene_set['description'],
        hash=gene_set['hash'],
        gene_ids=json.dumps({gene_map[gene]: None for gene in gene_set['genes']}),
        n_gene_ids=len(gene_set['genes']),
      )
      for gene_set in new_gene_sets
      if (gene_set['term'], gene_set['description'], gene_set['hash']) not in existing
    ),
    total=len(new_gene_sets) - len(existing),
    desc='Inserting new genesets...'),
  )

  plpy.execute('refresh materialized view concurrently app_public_v2.gene_set_pmc', [])

@cli.command()
@click.option('-i', '--input', type=click.Path(exists=True, file_okay=True, path_type=Path), help='GMT file to ingest')
@click.option('--prefix', type=str, default='', help='Prefix to add to terms')
@click.option('--postfix', type=str, default='', help='Postfix to add to terms')
def ingest(input, prefix, postfix):
  from helper.plpy import plpy
  try:
    import_gene_set_library(plpy, input, prefix=prefix, postfix=postfix)
  except:
    plpy.conn.rollback()
    raise
  else:
    plpy.conn.commit()
