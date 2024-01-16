import urllib.request
from tqdm import tqdm
from pathlib import Path
from helper.cli import cli
from helper.utils import copy_from_records

def ensure_gene_info(organism='Mammalia/Homo_sapiens'):
  gene_info_path = Path(f"{organism}.gene_info.gz")
  if not gene_info_path.exists():
    gene_info_path.parent.mkdir(exist_ok=True, parents=True)
    urllib.request.urlretrieve(f"https://ftp.ncbi.nlm.nih.gov/gene/DATA/GENE_INFO/{organism}.gene_info.gz", gene_info_path)
  return gene_info_path

def try_fetch_json(url, tries=1):
  import time
  import json
  import traceback
  time.sleep(0.5)
  for _ in range(tries):
    try:
      with urllib.request.urlopen(url) as fr:
        return json.load(fr)
    except KeyboardInterrupt:
      raise
    except:
      traceback.print_exc()
      time.sleep(5)

def ensure_gene_summary(chunk_size=100):
  # Primary credit to https://www.biostars.org/p/2144/
  # I modified it to:
  #  1. work with python3
  #  2. use the ncbi ftp gene_info file as input
  #  3. try again if API returns an error
  import numpy as np
  import pandas as pd

  gene_summary_path = Path('data/Homo_sapiens.gene_summary.tsv')
  gene_info = pd.read_csv(ensure_gene_info(), sep='\t', compression='gzip')
  gene_ids = gene_info['GeneID'].unique()
  if gene_summary_path.exists():
    results = pd.read_csv(gene_summary_path, sep='\t')
    gene_ids = np.setdiff1d(gene_ids, results['GeneID'].unique())
  #
  for i in tqdm(range(0, len(gene_ids), chunk_size), desc='Fetching gene summaries...'):
    chunk_genes = gene_ids[i:min(i+chunk_size, len(gene_ids))]
    gids = ','.join([str(s) for s in chunk_genes])
    url = f'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=gene&id={gids}&retmode=json';
    data = try_fetch_json(url, 3)
    result = []
    for g in chunk_genes:
      result.append([g, data['result'][str(g)]['summary'] if str(g) in data['result'] else ''])
    pd.DataFrame(result, columns=['GeneID', 'summary']).to_csv(gene_summary_path, index=False, mode='a', sep='\t', header=(i==0))
  return gene_summary_path

def ensure_gene_info_complete():
  gene_info_complete_path = Path('data/Homo_sapiens.gene_info.complete.tsv')
  if not gene_info_complete_path.exists():
    import pandas as pd
    #
    df = pd.read_csv(ensure_gene_info(), sep='\t', compression='gzip')
    df_summary = pd.read_csv(ensure_gene_summary(), sep='\t')
    #
    df = df.dropna(subset=['GeneID'])
    df['GeneID'] = df['GeneID'].astype(str)
    df_summary = df_summary.dropna(subset=['GeneID'])
    df_summary['GeneID'] = df_summary['GeneID'].astype(str)
    #
    df_out = pd.merge(
      left=df,
      left_on='GeneID',
      right=df_summary,
      right_on='GeneID',
      how='left',
    )
    df_out.to_csv(gene_info_complete_path, sep='\t')
  #
  return gene_info_complete_path

def import_gene_info(plpy):
  import pandas as pd
  df = pd.read_csv(ensure_gene_info_complete(), sep='\t')
  symbols = set(df['Symbol'].unique())
  genes_without_info = [
    row['symbol']
    for row in plpy.cursor('''
      select symbol
      from app_public_v2.gene
      where description is null or summary is null
    ''', tuple())
    if row['symbol'] in symbols
  ]
  df = df.drop_duplicates(subset='Symbol').set_index('Symbol').loc[genes_without_info, ['GeneID', 'description', 'summary']]

  if df.shape[0] > 0:
    copy_from_records(
      plpy.conn, 'app_public_v2.gene', ('symbol', 'ncbi_gene_id', 'description', 'summary'),
      tqdm((
        dict(
          symbol=symbol,
          ncbi_gene_id=row['GeneID'],
          description=row['description'],
          summary=row['summary'],
        )
        for symbol, row in df.iterrows()
      ),
      total=df.shape[0],
      desc='Inserting gene info'),
      on_conflict_update=('symbol',),
    )

@cli.command()
def ingest_gene_info():
  from helper.plpy import plpy
  try:
    import_gene_info(plpy)
  except:
    plpy.conn.rollback()
    raise
  else:
    plpy.conn.commit()
