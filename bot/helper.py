import click
import psycopg2
import traceback
import typing as t
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
  species: str = 'human',
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
      term, _description, *raw_genes = line_split
      genes = [
        cleaned_gene
        for raw_gene in map(str.strip, raw_genes)
        if raw_gene
        for cleaned_gene in (re.split(r'[;,:\s]', raw_gene)[0],)
        if cleaned_gene
      ]
      new_gene_sets.append(dict(
        term=prefix+term+postfix,
        genes=genes,
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

  existing_terms = {
    row['term']
    for row in plpy.cursor('select term from app_public_v2.gene_set', tuple())
  }

  copy_from_records(
    plpy.conn, 'app_public_v2.gene_set', ('term', 'gene_ids', 'n_gene_ids', 'species',),
    tqdm((
      dict(
        term=gene_set['term'],
        gene_ids=json.dumps({gene_map[gene]: None for gene in gene_set['genes']}),
        n_gene_ids=len(gene_set['genes']),
        species=species,
      )
      for gene_set in new_gene_sets
      if gene_set['term'] not in existing_terms
    ),
    total=len(new_gene_sets) - len(existing_terms),
    desc='Inserting new genesets...'),
  )


def import_gse_info(plpy):
  import pandas as pd
  import requests
  import re

  # find subset to add info to
  to_ingest = [
    r['gse']
    for r in plpy.cursor(
      '''
        select gse
        from app_public_v2.gse
        where gse not in (
          select gse
          from app_public_v2.gse_info
        )
      '''
    )
  ]

  # use information from bulk download metadata table (https://ftp.ncbi.nlm.nih.gov/pub/pmc/)
  pmc_meta = pd.read_csv('https://ftp.ncbi.nlm.nih.gov/pub/pmc/PMC-ids.csv.gz', usecols=['PMCID', 'Year', 'DOI'], index_col='PMCID', compression='gzip')
  pmc_meta = pmc_meta[pmc_meta.index.isin(to_ingest)]
  if pmc_meta.shape[0] == 0:
    return

  title_dict = {}
  for i in tqdm(range(0, len(to_ingest), 250), 'Pulling titles...'):
    while True:
      j = 0
      try:
        ids_string = ",".join([re.sub(r"^PMC(\d+)$", r"\1", id) for id in to_ingest[i:i+250]])
        res = requests.get(f'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pmc&retmode=json&id={ids_string}')
        ids_info = res.json()
        for id in ids_info['result']['uids']:
          try:
            title_dict[f"PMC{id}"] = ids_info['result'][id]['title']
          except KeyError:
            pass
        break
      except KeyboardInterrupt:
        raise
      except Exception as e:
        traceback.print_exc()
        print('Error resolving info. Retrying...')
        j += 1
        if j >= 10:
          raise RuntimeError(f'Error connecting to E-utilites api...')

  if title_dict:
    copy_from_records(
      plpy.conn, 'app_public_v2.pmc_info', ('pmcid', 'yr', 'doi', 'title'),
      tqdm((
        dict(
          pmcid=pmc,
          yr=int(pmc_meta.at[pmc, 'Year']),
          doi=pmc_meta.at[pmc, 'DOI'],
          title=title_dict[pmc],
        )
        for pmc in pmc_meta.index.values
        if pmc in title_dict
      ),
      total=len(title_dict),
      desc='Inserting PMC info..')
    )

  plpy.execute('refresh materialized view concurrently app_public_v2.gene_set_pmid', [])

@click.group()
def cli(): pass


@cli.command()
@click.option('-i', '--input', type=click.Path(exists=True, file_okay=True, path_type=Path), help='GMT file to ingest')
@click.option('--prefix', type=str, default='', help='Prefix to add to terms')
@click.option('--postfix', type=str, default='', help='Postfix to add to terms')
@click.option('--species', type=str, default='human', help='Terms species')
def ingest(input, prefix, postfix, species):
  from plpy import plpy
  print(f'Ingesting {input}...')
  print(f'species: {species}')
  try:
    import_gene_set_library(plpy, input, prefix=prefix, postfix=postfix, species=species)
  except:
    plpy.conn.rollback()
    raise
  else:
    plpy.conn.commit()

@cli.command()
def ingest_gse_info():
  from plpy import plpy
  try:
    import_gse_info(plpy)
  except:
    plpy.conn.rollback()
    raise
  else:
    plpy.conn.commit()

@cli.command()
@click.argument('publications', type=int)
def create_release(publications):
  from plpy import plpy
  plpy.execute(
    plpy.prepare('insert into app_public_v2.release (n_publications_processed) values ($1);', ['bigint']),
    [publications],
  )
  plpy.execute('refresh materialized view app_private_v2.pmc_stats;')
  plpy.conn.commit()

@cli.command()
@click.option('--enrich-url', envvar='ENRICH_URL', default='http://127.0.0.1:8000')
@click.option('--species', type=str, default='human')
def update_background(enrich_url, species):
  ''' A background is tied to a complete set of genes across all gene sets of a given species
  but also to a computed index in the enrich API. This function creates a
  new one, and drops the old one after ensuring the index is ready.
  '''
  import requests
  from plpy import plpy
  # record current backgrounds
  current_backgrounds = [row['id'] for row in plpy.cursor(f"select id, species from app_public_v2.background where species = '{species}'")]  # create updated background
  new_background, = plpy.cursor(f'''
    insert into app_public_v2.background (gene_ids, n_gene_ids, species)
    select
      jsonb_object_agg(distinct gsg.gene_id, null) as gene_ids,
      count(distinct gsg.gene_id) as n_gene_ids,
      '{species}' as species
    from app_public_v2.gene_set gs, jsonb_each(gs.gene_ids) gsg(gene_id, nil)
    where gs.species = '{species}'
    returning id;
  ''')
  plpy.conn.commit()
  # trigger index creation for the new background
  assert requests.get(f"{enrich_url}/{new_background['id']}").ok
  # remove old backgrounds
  plpy.execute(
    plpy.prepare('delete from app_public_v2.background where id = any($1::uuid[])', ['text[]']),
    [current_backgrounds]
  )
  plpy.conn.commit()
  # remove index for the old background
  for current_background in current_backgrounds:
    requests.delete(f"{enrich_url}/{current_background}")

if __name__ == '__main__':
  cli()
