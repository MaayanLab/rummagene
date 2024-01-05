import re
import io
import os
import csv
import sys
import queue
import shutil
import tarfile
import tempfile
import traceback
import contextlib
import subprocess
import multiprocessing as mp
from multiprocessing.pool import ThreadPool
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path, PurePosixPath

import tqdm
import numpy as np
import pandas as pd

java = shutil.which('java')
assert java, 'Missing java, necessary for tabula-py'

soffice = shutil.which('soffice', path=':'.join(filter(None, [os.environ.get('PATH'), '/Applications/LibreOffice.app/Contents/MacOS/'])))
assert soffice, 'Missing `soffice` binary for converting doc to docx'

class _DevNull:
  ''' File handle that does nothing
  '''
  def write(self, *args, **kwargs): pass
  def flush(self, *args, **kwargs): pass

def _run_with_timeout(send, fn, *args):
  try:
    send.put((None, fn(*args)))
  except Exception as e:
    send.put((e, None))

def run_with_timeout(fn, *args, timeout: int = 60):
  mp_spawn = mp.get_context('spawn')
  recv = mp_spawn.Queue()
  proc = mp_spawn.Process(target=_run_with_timeout, args=(recv, fn, *args))
  proc.start()
  try:
    err, res = recv.get(timeout=timeout)
  except queue.Empty:
    raise TimeoutError()
  else:
    if err is not None:
      raise err
    else:
      return res
  finally:
    proc.join(1)
    if proc.exitcode is None:
      import signal
      try: os.kill(proc.pid, signal.SIGINT)
      except ProcessLookupError: pass
      proc.join(1)
      if proc.exitcode is None:
        proc.terminate()
        proc.join(1)
        if proc.exitcode is None:
          proc.kill()
          proc.join(1)

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
    from docx import Document
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
  with tempfile.TemporaryDirectory(prefix='rummagene-') as tmpdir:
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
  return re.sub(r'\s+', ' ', ''.join(node.itertext()) if node is not None else '', 0, re.MULTILINE).strip()

def _read_xml_text_with_exclusion(node, exclude={'table-wrap', 'fig'}):
  ''' Read the text from an xml node (or the text from all it's children)
  '''
  import copy
  node = copy.deepcopy(node)
  for excl in exclude:
    for el in node.findall(f".//{excl}"):
      el.clear()
  return _read_xml_text(node)


def _read_xml_table(tbl):
  ''' This reads a xml table as a pandas dataframe
  '''
  columns = [[_read_xml_text(td) for td in tr.findall('./')] for tr in tbl.find('./thead').findall('./tr')]
  values = [[_read_xml_text(td) for td in tr.findall('./')] for tr in tbl.find('./tbody').findall('./tr')]
  n_cols = max(map(len, columns + values))
  if n_cols > len(columns[0]):
    columns[0] += ['']*(n_cols - len(columns[0]))
  df = pd.read_csv(
    io.StringIO('\n'.join('\t'.join(el for el in row) for row in (columns + values))),
    sep='\t',
    on_bad_lines='warn',
  )
  return df

def match_parens(text):
  ''' Because I hate mismatched parenthecies (: -- which can happen a lot given that
  references usually exist in parens but we only read text up to the reference
  '''
  # missing trailing paren
  if text.rfind('(') <= text.rfind('['):
    if text.rfind('(') > text.rfind(')'): text = text + ')'
    elif text.rfind('[') > text.rfind(']'): text = text + ']'
  else:
    if text.rfind('[') > text.rfind(']'): text = text + ']'
    elif text.rfind('(') > text.rfind(')'): text = text + ')'
  # missing leading paren
  openParen = text.find('(')
  if openParen == -1: openParen = len(text)
  closeParen = text.find(')')
  if closeParen >= 0 and closeParen < openParen:
    text = text[:closeParen] + text[closeParen+1:]
  #
  openParen = text.find('[')
  if openParen == -1: openParen = len(text)
  closeParen = text.find(']')
  if closeParen >= 0 and closeParen < openParen:
    text = text[:closeParen] + text[closeParen+1:]
  return text

def _read_xml_mentions(root, ref: str):
  if not ref:
    return ''
  try:
    # get the first parent paragraph mentioning the reference
    xrefParentNode, mention = next(iter(
      (xrefParentNode, mention)
      # for xrefParentNode in root.findall(f".//xref[@rid='{ref}']/..")
      for xrefParentNode in root.findall(f".//xref[@rid]/..")
      if any(xref.attrib['rid'] == ref for xref in xrefParentNode.findall('xref'))
      for mention in (_read_xml_text_with_exclusion(xrefParentNode),)
      if mention
    ))
    # get the reference text
    xrefNode = next(iter(xrefNode for xrefNode in xrefParentNode.findall('xref') if xrefNode.attrib['rid'] == ref))
    xrefNodeText = _read_xml_text(xrefNode)
    # read up to the reference (encased in parens/brackets)
    indexOfRef = mention.index(xrefNodeText)
    # get at most 20 words before the reference
    return match_parens(' '.join(re.split(r'\s+', mention[:indexOfRef])[-15:]) + '**'+' '.join(re.split(r'\s+', xrefNodeText))+'**')
  except StopIteration:
    return ''

def _read_xml_tables(root, member_path: PurePosixPath):
  ''' Tables are embedded in the xml files, they can be parsed 
  '''
  for tblWrap in root.findall('.//table-wrap'):
    gene_sets = []
    # read the wrapped table
    tbl = tblWrap.find('./table')
    if tbl and tbl.find('./thead') and tbl.find('./tbody'):
      try:
        df = _read_xml_table(tbl)
        # extract any gene set columns
        gene_sets.extend(extract_gene_set_columns(df))
      except KeyboardInterrupt:
        raise
      except:
        traceback.print_exc()
    #
    if gene_sets:
      # given that we have genesets, assemble description and yield them
      label = _read_xml_text(tblWrap.find('./label'))
      caption = _read_xml_text(tblWrap.find('./caption')).rstrip('.')
      mention = _read_xml_mentions(root, tblWrap.attrib.get('id')).rstrip('.')
      description = '  '.join(filter(None, (mention, caption,)))
      for column, gene_set in gene_sets:
        yield f"{member_path.parent.name}-{member_path.name}-{slugify(label)}-{slugify(column)}", description, gene_set

def _read_xml_supplement(tar: tarfile.TarFile, root: ET.Element):
  members = {member_name.name: (member_name, member) for member in tar.getmembers() for member_name in (PurePosixPath(member.name),)}
  for supplementary_material in root.findall('.//supplementary-material'):
    gene_sets = []
    for media in supplementary_material.findall('./media'):
      # find gene sets from the different media attachements
      href = media.attrib['{http://www.w3.org/1999/xlink}href']
      if href not in members: continue
      member_name, member = members[href]
      handler = ext_handlers.get(member_name.suffix.lower())
      if not handler: continue
      media_gene_sets = []
      for sheet, df in handler(tar.extractfile(member)):
        for column, gene_set in extract_gene_set_columns(df):
          media_gene_sets.append((f"{slugify(sheet)}-{slugify(column)}", gene_set))
      #
      if media_gene_sets:
        caption = _read_xml_text(media.find('./caption')).rstrip('.')
        gene_sets += [(term, caption, gene_set) for term, gene_set in media_gene_sets]
    #
    if gene_sets:
      # given that we have genesets, assemble description and yield them
      mention = _read_xml_mentions(root, supplementary_material.attrib.get('id')).rstrip('.')
      for term, caption, gene_set in gene_sets:
        description = '  '.join(filter(None, (mention, caption,)))
        yield f"{member_name.parent.name}-{member_name.name}-{term}", description, gene_set

def extract_tables_from_xml(tar: tarfile.TarFile, member_path: PurePosixPath, f):
  parsed = ET.parse(f)
  root = parsed.getroot()
  yield from _read_xml_tables(root, member_path)
  yield from _read_xml_supplement(tar, root)

@register_ext_handler('.pdf')
def read_pdf_tables(f):
  ''' pdf tables read by tabula library
  '''
  import tabula
  results = tabula.read_pdf(f, pages='all', multiple_tables=True, silent=True)
  if type(results) == list:
    for i, df in enumerate(results):
      yield f"{i}", df
  elif type(results) == dict:
    for key, df in results.items():
      yield key, df
  else:
    raise NotImplementedError()

def extract_gmt_from_oa_package(oa_package):
  ''' Given a oa_package (open access bundle with paper & figures) extract all applicable gene sets
   from all applicable tables
  '''
  with tarfile.open(oa_package) as tar:
    for member in tar.getmembers():
      if not member.isfile(): continue
      member_path = PurePosixPath(member.name)
      if member_path.suffix.lower() not in ('.nxml', '.xml'): continue
      yield from extract_tables_from_xml(tar, member_path, tar.extractfile(member))

lookup = None
def gene_lookup(value):
  ''' Don't allow pure numbers or spaces--numbers can typically match entrez ids
  '''
  if type(value) != str: return None
  if re.search(r'\s', value): return None
  if re.match(r'\d+(\.\d+)?', value): return None
  global lookup
  if lookup is None:
    import json
    with open('lookup.json', 'r') as fr:
      lookup = json.load(fr).get
  return lookup(value)

def extract_gene_set_columns(df):
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
  with tempfile.NamedTemporaryFile(prefix='rummagene-', suffix=''.join(PurePosixPath(oa_package).suffixes)) as tmp:
    with urllib.request.urlopen(f"https://ftp.ncbi.nlm.nih.gov/pub/pmc/{oa_package}") as fr:
      shutil.copyfileobj(fr, tmp)
    tmp.flush()
    return list(extract_gmt_from_oa_package(tmp.name))

def task(record):
  try:
    return record, None, run_with_timeout(fetch_extract_gmt_from_oa_package, record['File'], timeout=60*5)
  except KeyboardInterrupt:
    raise
  except:
    return record, traceback.format_exc(), None

def main(data_dir = Path(), oa_file_list = None, progress = 'done.txt', progress_output = 'done.new.txt', output = 'output.gmt'):
  '''
  Work through oa_file_list (see: fetch_oa_file_list)
    -- you can filter it and provide it to this function
  Track progress by storing oa_packages already processed in done.txt
  Write all results to output.gmt
  '''
  data_dir.mkdir(parents=True, exist_ok=True)
  done_file = data_dir / progress
  new_done_file = data_dir / progress_output
  output_file = data_dir / output

  # prepare gene symbol lookup, since this preparation is somewhat slow
  #  doing this before hand speeds up the sub-tasks (which run in new processes) substantially
  gene_lookup_file = Path('lookup.json')
  if not gene_lookup_file.exists():
    import json
    from maayanlab_bioinformatics.harmonization.ncbi_genes import ncbi_genes_fetch
    ncbi_genes = ncbi_genes_fetch(organism='Mammalia/Homo_sapiens')
    synonyms, symbols = zip(*{
      (synonym, gene_info['Symbol'])
      for _, gene_info in ncbi_genes.iterrows()
      for synonym in gene_info['All_synonyms']
    })
    ncbi_lookup = pd.Series(symbols, index=synonyms)
    index_values = ncbi_lookup.index.value_counts()
    ambiguous = index_values[index_values > 1].index
    ncbi_lookup_disambiguated = ncbi_lookup[(
      (ncbi_lookup.index == ncbi_lookup) | (~ncbi_lookup.index.isin(ambiguous))
    )]
    lookup_dict = ncbi_lookup_disambiguated.to_dict()
    with gene_lookup_file.open('w') as fw:
      json.dump(lookup_dict, fw)

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
  #  append gmt term, gene sets as they are ready into one gmt file
  with new_done_file.open('a') as done_file_fh:
    with output_file.open('a') as output_fh:
      with ThreadPool() as pool:
        for record, err, res in tqdm.tqdm(
          pool.imap_unordered(
            task,
            (
              { 'File': row['File'] }
              for _, row in oa_file_list.iterrows()
            )
          ),
          initial=oa_file_list_size - oa_file_list.shape[0],
          total=oa_file_list_size
        ):
          if err is None:
            for term, description, gene_set in res:
              print(
                term,
                description,
                *gene_set,
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
