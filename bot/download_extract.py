import re
import io
import os
import csv
import sys
import shutil
import tarfile
import tempfile
import traceback
import threading
import contextlib
import subprocess
import multiprocessing as mp
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path, PurePosixPath

import tqdm
import numpy as np
import pandas as pd

from docx import Document
from maayanlab_bioinformatics.harmonization.ncbi_genes import ncbi_genes_lookup

import tabula
java = shutil.which('java')
assert java, 'Missing java, necessary for tabula-py'

soffice = shutil.which('soffice', path=':'.join(filter(None, [os.environ.get('PATH'), '/Applications/LibreOffice.app/Contents/MacOS/'])))
assert soffice, 'Missing `soffice` binary for converting doc to docx'

class _DevNull:
  ''' File handle that does nothing
  '''
  def write(self, *args, **kwargs): pass
  def flush(self, *args, **kwargs): pass

def _timeout_thread(timeout: int, done: threading.Event):
  ''' Sleep for timeout seconds or until done is set
  if we finish before done is set, we set done and interrupt main
  '''
  import time
  for _ in range(timeout):
    time.sleep(1)
    if done.is_set():
      return
  if not done.is_set():
    done.set()
    import _thread
    _thread.interrupt_main()

@contextlib.contextmanager
def raise_on_timeout(timeout = 60):
  ''' A context manager for running code for at most timeout seconds
  '''
  done = threading.Event()
  thread = threading.Thread(target=_timeout_thread, args=(timeout, done,))
  thread.start()
  try:
    yield
  except KeyboardInterrupt:
    # if done is set, then the timeout thread finished and interrupted main
    #  we'll raise a timeout error
    if done.is_set():
      raise TimeoutError()
    else:
      # otherwise something else triggered this
      raise
  finally:
    # the code is done, set done so thread exits cleanly
    done.set()

ext_handlers = {}
def register_ext_handler(*exts):
  ''' We create a dictionary with functions capable of extracting tables for each extension type.
  Each function is a generator of (name, pandas data frame) tuples
  '''
  def decorator(func):
    for ext in exts:
      ext_handlers[ext] = func
    return func
  return decorator

def _read_docx_tab(tab):
  '''  This converts from a docx table object into a pandas dataframe
  '''
  vf = io.StringIO()
  writer = csv.writer(vf)
  for row in tab.rows:
    writer.writerow(cell.text for cell in row.cells)
  vf.seek(0)
  return pd.read_csv(vf)

def read_docx_tables(f):
  ''' This reads tables out of a docx file
  '''
  with contextlib.redirect_stderr(_DevNull()):
    doc = Document(f)
  for i, tab in enumerate(doc.tables):
    yield str(i), _read_docx_tab(tab)

@register_ext_handler('.docx')
def prepare_docx(fr):
  ''' This calls read_docx_tables, first copying the reader into a ByteIO since
  tarfile reader doesn't support seeks.
  '''
  fh = io.BytesIO()
  shutil.copyfileobj(fr, fh)
  fh.seek(0)
  yield from read_docx_tables(fh)

@register_ext_handler('.doc')
def read_doc_as_docx(fr):
  ''' For doc support, convert .doc to .docx in a temporary directory and call read_docx_tables
  '''
  with tempfile.TemporaryDirectory() as tmpdir:
    tmpdir = Path(tmpdir)
    with (tmpdir / 'table.doc').open('wb') as fw:
      shutil.copyfileobj(fr, fw)
    subprocess.call(
      [soffice, '--headless', '--convert-to', 'docx', str(tmpdir/'table.doc')],
      cwd=tmpdir,
      stderr=subprocess.DEVNULL,
      stdout=subprocess.DEVNULL,
      timeout=60,
    )
    yield from read_docx_tables(tmpdir/'table.docx')

@register_ext_handler('.xls', '.xlsb', '.xlsm','.odf','.ods','.odt')
def read_excel_tables(f, engine=None):
  ''' Use pandas read_excel function for these files, return all tables from all sheets
  '''
  for sheet, df in pd.read_excel(f, sheet_name=None, engine=engine).items():
    yield sheet, df

@register_ext_handler('.xlsx')
def read_xlsx_tables(f):
  yield from read_excel_tables(f, engine='openpyxl')

@register_ext_handler('.csv')
def read_csv_tables(f):
  yield '', pd.read_csv(f)

@register_ext_handler('.tsv')
def read_tsv_tables(f):
  yield '', pd.read_csv(f, sep='\t')

@register_ext_handler('.txt')
def read_txt_tables(f):
  ''' Try to read txt as a table using pandas infer functionality
  '''
  yield '', pd.read_csv(f, sep=None, engine='python')

def _read_xml_text(node):
  ''' Read the text from an xml node (or the text from all it's children)
  '''
  return node.text or ''.join(filter(None, (
    el.text
    for el in node.findall('.//')
  )))

def _read_xml_table(tbl):
  ''' This reads a xml table as a pandas dataframe
  '''
  columns = [[_read_xml_text(td).replace('\t', '  ').replace('\n', ' ').strip() for td in tr.findall('./')] for tr in tbl.find('./thead').findall('./tr')]
  values = [[_read_xml_text(td).replace('\t', '  ').replace('\n', ' ').strip() for td in tr.findall('./')] for tr in tbl.find('./tbody').findall('./tr')]
  n_cols = max(map(len, columns + values))
  if n_cols > len(columns[0]):
    columns[0] += ['']*(n_cols - len(columns[0]))
  df = pd.read_csv(
    io.StringIO('\n'.join('\t'.join(el for el in row) for row in (columns + values))),
    sep='\t',
    on_bad_lines='warn',
  )
  return df

@register_ext_handler('.nxml', '.xml')
def read_xml_tables(f):
  ''' Tables are embedded in the xml files, they can be parsed 
  '''
  parsed = ET.parse(f)
  root = parsed.getroot()
  for tblWrap in root.findall('.//table-wrap'):
    label = tblWrap.find('./label')
    if label:
      label = _read_xml_text(label)
    else:
      label = ''
    tbl = tblWrap.find('./table')
    if tbl and tbl.find('./thead') and tbl.find('./tbody'):
      try:
        tbl = _read_xml_table(tbl)
      except KeyboardInterrupt:
        raise
      except:
        traceback.print_exc()
      else:
        yield label, tbl

@register_ext_handler('.pdf')
def read_pdf_tables(f):
  ''' pdf tables read by tabula library
  '''
  results = tabula.read_pdf(f, pages='all', multiple_tables=True, silent=True)
  if type(results) == list:
    for i, df in enumerate(results):
      yield f"{i}", df
  elif type(results) == dict:
    for key, df in results.items():
      yield key, df
  else:
    raise NotImplementedError()

def extract_tables_from_oa_package(oa_package):
  ''' Given a oa_package (open access bundle with paper & figures) extract all applicable tables
  '''
  with tarfile.open(oa_package) as tar:
    for member in tar.getmembers():
      if member.isfile():
        handler = ext_handlers.get(PurePosixPath(member.name).suffix.lower())
        if handler:
          try:
            with raise_on_timeout(60):
              for k, tbl in handler(tar.extractfile(member)):
                yield (member.name, k, tbl)
          except KeyboardInterrupt:
            raise
          except:
            traceback.print_exc()

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

def extract_geneset_columns(df):
  ''' Given a pandas dataframe, find columns containing mostly mappable genes
  '''
  for col in df.columns:
    if df[col].dtype != np.dtype('O'): continue
    unique_genes = pd.Series(df[col].dropna().unique())
    if unique_genes.shape[0] >= 5:
      unique_genes_mapped = unique_genes.apply(gene_lookup).dropna()
      ratio = unique_genes_mapped.shape[0] / unique_genes.shape[0]
      if ratio > 0.5:
        yield col, unique_genes.apply(lambda gene: re.sub(r'\s+', ' ', gene) if type(gene) == str else gene).tolist()

def slugify(s):
  ''' Replace non-characters/numbers with _
  '''
  return re.sub(r'[^\w\d-]+', '_', s).strip('_')

def extract_gmt_from_oa_package(oa_package):
  ''' Create a GMT from an oa_package archive
  '''
  genesets = {}
  for member_name, table, df in extract_tables_from_oa_package(oa_package):
    member_name_path = PurePosixPath(member_name)
    for col, geneset in extract_geneset_columns(df):
      genesets[f"{member_name_path.parent.name}-{member_name_path.name}-{slugify(table)}-{slugify(col)}"] = geneset
  return genesets

def fetch_oa_file_list(data_dir = Path()):
  ''' Fetch the PMCID, PMID, oa_file listing; we sort it newest first.
  ['File'] has the oa_package which is a relative path to a tar.gz archive containing
   the paper and all figures.
  '''
  oa_file_list = data_dir / 'oa_file_list.csv'
  if not oa_file_list.exists():
    df = pd.read_csv('https://ftp.ncbi.nlm.nih.gov/pub/pmc/oa_file_list.csv')
    ts_col = df.columns[-3]
    df[ts_col] = pd.to_datetime(df[ts_col])
    df.sort_values(ts_col, ascending=False, inplace=True)
    df.to_csv(oa_file_list, index=None)
  else:
    df = pd.read_csv(oa_file_list)
  return df

def find_pmc_ids(term):
  ''' Given a term, return all PMC ids matching that term
  '''
  import os, itertools
  from Bio import Entrez
  Entrez.email = os.environ['EMAIL']
  batch = 1000000
  for i in itertools.count():
    try:
      handle = Entrez.esearch(db="pmc", term=term, api_key=os.environ['API_KEY'], retstart=i*batch, retmax=batch)
      records = Entrez.read(handle)
      if not records['IdList']:
        break
      for id in records['IdList']:
        yield f"PMC{id}"
    except KeyboardInterrupt:
      raise
    except:
      import traceback
      traceback.print_exc()
      break

def filter_oa_file_list_by(oa_file_list, pmc_ids):
  ''' Filter oa_file_list by PMC IDs
  '''
  return oa_file_list[oa_file_list['Accession ID'].isin(list(pmc_ids))]

def fetch_extract_gmt_from_oa_package(oa_package):
  ''' Given the oa_package name from the oa_file_list, we'll download it temporarily and then extract a gmt out of it
  '''
  with tempfile.NamedTemporaryFile(suffix=''.join(PurePosixPath(oa_package).suffixes)) as tmp:
    with urllib.request.urlopen(f"https://ftp.ncbi.nlm.nih.gov/pub/pmc/{oa_package}") as fr:
      shutil.copyfileobj(fr, tmp)
    tmp.flush()
    return extract_gmt_from_oa_package(tmp.name)

def try_except_as_option(fn, *args, **kwargs):
  ''' Run a function in a try except and return an error, result tuple
  '''
  try:
    return None, fn(*args, **kwargs)
  except KeyboardInterrupt:
    raise
  except:
    return traceback.format_exc(), None

def task(record):
  return (record, *try_except_as_option(fetch_extract_gmt_from_oa_package, record['File']))

def main(data_dir = Path(), oa_file_list = None):
  '''
  Work through oa_file_list (see: fetch_oa_file_list)
    -- you can filter it and provide it to this function
  Track progress by storing oa_packages already processed in done.txt
  Write all results to output.gmt
  '''
  data_dir.mkdir(parents=True, exist_ok=True)
  done_file = data_dir / 'done.txt'
  output = data_dir / 'output.gmt'

  # find out what we've already processed
  if done_file.exists():
    with done_file.open('r') as fr:
      done = set(filter(None, map(str.strip, fr)))
  else:
    done = set()

  # find out what there remains to process
  if oa_file_list is None:
    oa_file_list = fetch_oa_file_list(data_dir)

  oa_file_list_size = oa_file_list.shape[0]
  oa_file_list = oa_file_list[~oa_file_list['File'].isin(list(done))]

  # fetch and extract gmts from oa_packages using a process pool
  #  append gmt term, genesets as they are ready into one gmt file
  with done_file.open('a') as done_file_fh:
    with output.open('a') as output_fh:
      with mp.Pool() as pool:
        for record, err, res in tqdm.tqdm(
          pool.imap_unordered(
            task,
            (row for _, row in oa_file_list.iterrows())
          ),
          initial=oa_file_list_size - oa_file_list.shape[0],
          total=oa_file_list_size
        ):
          if err is None:
            for term, geneset in res.items():
              print(
                term,
                '',
                *geneset,
                sep='\t',
                file=output_fh,
              )
          else:
            print(err, file=sys.stderr)
          print(record['File'], file=done_file_fh)
          output_fh.flush()
          done_file_fh.flush()

if __name__ == '__main__':
  import os
  from dotenv import load_dotenv; load_dotenv()
  data_dir = Path(os.environ.get('PTH', 'data'))
  main(data_dir)
