''' Some common variables used in multiple scripts
'''
import re
import io
import pathlib
import contextlib
import typing
from dataclasses import dataclass

data_dir = pathlib.Path('data')
data_dir.mkdir(exist_ok=True, parents=True)

def cached_urlretrieve(url, filename):
  ''' Download the file if it hasn't already been downloaded
  '''
  import urllib.request
  if pathlib.Path(filename).exists(): return
  pathlib.Path(filename).parent.mkdir(exist_ok=True, parents=True)
  print(f"Fetching {filename} from {url}...")
  urllib.request.urlretrieve(url, filename)

def maybe_tqdm(iterable, **kwargs):
  ''' Optional tqdm (omitted if tqdm is not installed)
  '''
  try:
    from tqdm.auto import tqdm
    return tqdm(iterable, **kwargs)
  except ImportError:
    return iterable

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
    with open(data_dir/'lookup.json', 'r') as fr:
      lookup = json.load(fr).get
  return lookup(value)

@contextlib.contextmanager
def ensure_io(arg: io.TextIOBase | str | pathlib.Path):
  ''' ensure we have a file handle open for reading, open if we have a str/Path
  '''
  if isinstance(arg, io.TextIOBase):
    yield arg
  elif isinstance(arg, str) or isinstance(arg, pathlib.Path):
    with open(arg, 'r') as fr:
      yield fr
  else:
    raise NotImplementedError(arg)

@dataclass
class GMT:
  ''' a data structure for GMTs in memory
  '''
  # the unique set of genes across all gene lists
  background: list[str]
  # first two columns of the GMT
  terms: list[(str, str)]
  # variable gene lists of the GMT
  gene_lists: list[list[str]]

  @staticmethod
  def reader(gmtfile: io.TextIOBase | str | pathlib.Path) -> typing.Iterator[tuple[tuple[str, str], list[str]]]:
    ''' read the .gmt format, a tab separated file with variable columns
    '''
    gene_expr = re.compile(r'^([^:;,]+?)([:;,].+)?$')
    with ensure_io(gmtfile) as fr:
      for line in fr:
        line_split = [cell.strip() for cell in line.strip().split('\t')]
        if len(line_split) < 3: continue
        term, desc, *genes = line_split
        genes = [
          m.group(1)
          for gene in genes
          if gene
          for m in (gene_expr.match(gene),)
          if m
        ]
        yield (term, desc), genes

  @staticmethod
  def from_iter(it: typing.Iterator[tuple[tuple[str, str], list[str]]]):
    ''' initialize a GMT from Iterator[(term, desc), gene_list] (i.e. read_gmt)
    '''
    background = set()
    terms = []
    gene_lists = []
    for (term, desc), genes in maybe_tqdm(it, desc='Reading gmt...'):
      background.update(genes)
      terms.append((term, desc))
      gene_lists.append(genes)
    return GMT(list(background), terms, gene_lists)

  @staticmethod
  def concat(*gmts):
    background = set()
    terms = []
    gene_lists = []
    for gmt in gmts:
      background.update(gmt.background)
      terms += gmt.terms
      gene_lists += gmt.gene_lists
    return GMT(list(background), terms, gene_lists)

  @staticmethod
  def from_file(gmtfile: io.TextIOBase | str | pathlib.Path):
    ''' initialze a GMT from a file
    '''
    return GMT.from_iter(GMT.reader(gmtfile))

  def to_spmatrix(self):
    ''' create a sparse matrix from this GMT
    '''
    import scipy.sparse
    import numpy as np
    spmatrix = scipy.sparse.dok_matrix((len(self.gene_lists), len(self.background)), dtype=np.int8)
    gene_index = { gene: index for index, gene in enumerate(self.background) }
    for i, gene_list in enumerate(maybe_tqdm(self.gene_lists, desc='Building spmatrix...')):
      spmatrix[i, [gene_index[g] for g in gene_list]] = 1
    return spmatrix

  def to_df(self):
    ''' create a sparse pandas dataframe from this GMT
    '''
    import pandas as pd
    return pd.DataFrame.sparse.from_spmatrix(
      self.to_spmatrix(),
      columns=self.background,
      index=self.terms,
    )
