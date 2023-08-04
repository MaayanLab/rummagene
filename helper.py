import typing as t
import click
import psycopg2
from pathlib import Path
from tqdm import tqdm

FileDescriptor = t.Union[int, str]

def copy_from_tsv(conn: 'psycopg2.connection', table: str, columns: list[str], r: FileDescriptor):
  ''' Copy from a file descriptor into a postgres database table through as psycopg2 connection object
  :param con: The psycopg2.connect object
  :param r: An file descriptor to be opened in read mode
  :param table: The table top copy into
  :param columns: The columns being copied
  '''
  import os
  with conn.cursor() as cur:
    with os.fdopen(r, 'rb', buffering=0, closefd=True) as fr:
      columns = fr.readline().strip().split(b'\t')
      cur.copy_expert(
        sql=f'''
        COPY {table} ({",".join(f'"{c.decode()}"' for c in columns)})
        FROM STDIN WITH CSV DELIMITER E'\\t'
        ''',
        file=fr,
      )
    conn.commit()

def copy_from_records(conn: 'psycopg2.connection', table: str, columns: list[str], records: t.Iterable[dict]):
  ''' Copy from records into a postgres database table through as psycopg2 connection object.
  This is done by constructing a unix pipe, writing the records with csv writer
   into the pipe while loading from the pipe into postgres at the same time.
  :param con: The psycopg2.connect object
  :param table: The table to write the pandas dataframe into
  :param columns: The columns being written into the table
  :param records: An iterable of records to write
  '''
  import os, csv, threading
  r, w = os.pipe()
  # we copy_from_tsv with the read end of this pipe in
  #  another thread
  rt = threading.Thread(
    target=copy_from_tsv,
    args=(conn, table, columns, r,),
  )
  rt.start()
  try:
    # we write to the write end of this pipe in this thread
    with os.fdopen(w, 'w', closefd=True) as fw:
      writer = csv.DictWriter(fw, fieldnames=columns, delimiter='\t')
      writer.writeheader()
      writer.writerows(records)
  finally:
    # we wait for the copy_from_tsv thread to finish
    rt.join()

def import_gene_set_library(
  plpy,
  library: Path | str,
  name: str,
  description: str,
  append = False,
):
  import re
  import json
  import uuid

  # create the gene_set_library
  gene_set_library, = plpy.cursor(
    plpy.prepare(
      (
        'insert into app_public.gene_set_library (name, description) values ($1, $2) on conflict (name) do update set description = EXCLUDED.description returning *'
        if append else
        'insert into app_public.gene_set_library (name, description) values ($1, $2) returning *'
      ),
      ['varchar', 'varchar']
    ),
    [name, description],
  )

  # fetch the gene_set, gather the background genes
  new_gene_sets = []
  background_genes = set()
  n_geneset_genes = 0
  with Path(library).open('r') as fr:
    for line in tqdm(filter(None, map(str.strip, fr)), desc='Loading gmt...'):
      term, description, *raw_genes = line.split('\t')
      genes = [
        cleaned_gene
        for raw_gene in map(str.strip, raw_genes)
        if raw_gene
        for cleaned_gene in (re.split(r'[;,:\s]', raw_gene)[0],)
        if cleaned_gene
      ]
      new_gene_sets.append(dict(
        id=str(uuid.uuid4()),
        term=term,
        genes=genes,
      ))
      background_genes.update(genes)
      n_geneset_genes += len(genes)

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
  new_genes = {
    id: dict(id=id, symbol=gene)
    for gene in tqdm(background_genes - gene_id_map.keys(), desc='Preparing new genes...')
    for id in (str(uuid.uuid4()),)
  }
  if new_genes:
    copy_from_records(
      plpy.conn, 'app_public.gene', ('id', 'symbol',),
      tqdm(new_genes.values(), desc='Inserting new genes...'))
    gene_id_map.update({
      new_gene['symbol']: new_gene['id']
      for new_gene in new_genes.values()
    })

  if append:
    existing_terms = {
      row['term']
      for row in plpy.cursor(
        plpy.prepare('select term from app_public.gene_set where library_id = $1', ['uuid']),
        [gene_set_library['id']]
      )
    }
  else:
    existing_terms = set()

  copy_from_records(
    plpy.conn, 'app_public.gene_set', ('id', 'library_id', 'term',),
    tqdm((
      dict(
        id=gene_set['id'],
        library_id=gene_set_library['id'],
        term=gene_set['term'],
      )
      for gene_set in new_gene_sets
      if gene_set['term'] not in existing_terms
    ),
    total=len(new_gene_sets),
    desc='Inserting new genesets...'),
  )
  copy_from_records(
    plpy.conn, 'app_public.gene_set_gene', ('gene_set_id', 'gene_id',),
    tqdm((
      dict(
        gene_set_id=gene_set['id'],
        gene_id=gene_id,
      )
      for gene_set in new_gene_sets
      if gene_set['term'] not in existing_terms
      for gene_id in set(
        gene_id_map[gene]
        for gene in gene_set['genes']
      )
    ),
    total=n_geneset_genes,
    desc='Inserting geneset genes...'),
  )

  plpy.execute('refresh materialized view concurrently app_public.gene_set_library_gene', [])
  plpy.execute('refresh materialized view concurrently app_public.gene_set_pmc', [])

  return gene_set_library

@click.group()
def cli(): pass

@cli.command()
@click.option('-i', '--input', type=click.Path(exists=True, file_okay=True, path_type=Path), help='GMT file to clean')
@click.option('-o', '--output', type=click.Path(path_type=Path), help='Output location')
def clean(input, output):
  import re
  from maayanlab_bioinformatics.harmonization.ncbi_genes import ncbi_genes_lookup

  lookup = None
  def gene_lookup(value):
    ''' Don't allow pure numbers or spaces--numbers can typically match entrez ids
    '''
    if type(value) != str: return None
    if re.search(r'\s', value): return None
    if re.match(r'\d+(\.\d+)?', value): return None
    global lookup
    if lookup is None:
      lookup = ncbi_genes_lookup(filters=lambda ncbi: ncbi)
    return lookup(value)

  terms = set()
  with input.open('r') as fr:
    with output.open('w') as fw:
      for line in filter(None, map(str.strip, fr)):
        term, _, *geneset = line.split('\t')
        geneset_mapped = [gene_mapped for gene in geneset for gene_mapped in (gene_lookup(gene),) if gene_mapped]
        if (
          len(geneset_mapped) >= 5
          and len(geneset_mapped) < 2500
          and len(term) < 200
          and term not in terms
        ):
          terms.add(term)
          print(
            term, '',
            *geneset_mapped,
            sep='\t',
            file=fw,
          )

@cli.command()
@click.option('-i', '--input', type=click.Path(exists=True, file_okay=True, path_type=Path), help='GMT file to ingest')
@click.option('-n', '--name', type=str, required=True, help='Name of the library')
@click.option('-d', '--description', type=str, default='', help='Description of the library')
@click.option('-a', '--append', type=bool, is_flag=True, help='Append to the existing library')
def ingest(input, name, description, append):
  from plpy import plpy
  try:
    import_gene_set_library(plpy, input, name, description, append)
  except:
    plpy.conn.rollback()
    raise
  else:
    plpy.conn.commit()

if __name__ == '__main__':
  cli()
