#%%
import re
import pandas as pd

from common import data_dir, GMT, cached_urlretrieve, maybe_tqdm

#%%
organism = 'Mammalia/Homo_sapiens'

def maybe_split(record):
  ''' NCBI Stores Nulls as '-' and lists '|' delimited
  '''
  if record in {'', '-'}:
    return set()
  return set(record.split('|'))

def supplement_dbXref_prefix_omitted(ids):
  ''' NCBI Stores external IDS with Foreign:ID while most datasets just use the ID
  '''
  for id in ids:
    # add original id
    yield id
    # also add id *without* prefix
    if ':' in id:
      yield id.split(':', maxsplit=1)[1]

cached_urlretrieve(
  f"ftp://ftp.ncbi.nih.gov/gene/DATA/GENE_INFO/{organism}.gene_info.gz",
  data_dir/f"{organism}.gene_info.gz"
)
ncbi_genes = pd.read_csv(data_dir/f"{organism}.gene_info.gz", sep='\t', compression='gzip')
ncbi_genes['All_synonyms'] = [
  set.union(
    maybe_split(gene_info['Symbol']),
    maybe_split(gene_info['Symbol_from_nomenclature_authority']),
    maybe_split(str(gene_info['GeneID'])),
    maybe_split(gene_info['Synonyms']),
    maybe_split(gene_info['Other_designations']),
    maybe_split(gene_info['LocusTag']),
    set(supplement_dbXref_prefix_omitted(maybe_split(gene_info['dbXrefs']))),
  )
  for _, gene_info in ncbi_genes.iterrows()
]
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
ncbi_lookup = ncbi_lookup_disambiguated.to_dict()

def gene_lookup(value):
  ''' Don't allow pure numbers or spaces--numbers can typically match entrez ids
  '''
  if type(value) != str: return None
  if re.search(r'\s', value): return None
  if re.match(r'\d+(\.\d+)?', value): return None
  return ncbi_lookup.get(value)

#%%
with (data_dir/'enrichr.gmt').open('w') as fw:
  for gene_set_library in maybe_tqdm((data_dir/'Enrichr').glob('*.gmt'), desc='Processing enrichr libraries...'):
    for (term, _desc), genes in maybe_tqdm(GMT.reader(gene_set_library), desc=f"Processing {gene_set_library}..."):
      print(
        gene_set_library.stem,
        term,
        *genes,
        sep='\t',
        file=fw,
      )
