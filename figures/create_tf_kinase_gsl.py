
#%%
import re
import json
import os
import pathlib
from tqdm import tqdm
import pandas as pd
from maayanlab_bioinformatics.harmonization import ncbi_genes_lookup
from common import data_dir

def read_gmt(path):
  with pathlib.Path(path).open('r') as fr:
    return {
      term: {
        gene: 1
        for gene in geneset
      }
      for line in fr
      for term, _, *geneset in (line.strip().split('\t'),)
    }
  
def extract_term_counts(path):
  with pathlib.Path(path).open('r') as fr:
    return {
      term: [len(geneset)]
      for line in fr
      for term, _, *geneset in (line.strip().split('\t'),)
    }

lookup = ncbi_genes_lookup()

def is_valid(g):
    """Remove terms that are just numbers -- these are likely 
    dates/ids in the table name and not gene ids"""
    if g == 'TF' or len(g) < 2:
        return False
    try:
        return str(int(g)) != g
    except:
        try:
            # checking to see if it is a supplemental table name e.g. S4, S14 etc..
            return str(int(g.replace('S', ''))) != g.replace('S', '')
        except:
            return True

pattern = r'[-_.,:;]'
replacement = ' '
extensions = ['xls', 'txt', 'xlsx', 'xlsx', 'xlsm', 'doc', 'docx', 'pdf', 'csv', 'tsv', 'nxml', 'ods', 'odt']
extensions_pattern = r'\b(?:(?=\S)' + '|'.join(map(re.escape, extensions)) + r')\b'


terms = extract_term_counts(data_dir/'table-mining-clean.gmt')
df = pd.DataFrame.from_dict(terms).T.reset_index()
#%%

df['human_genes'] = df['term'].apply(lambda term: 
                                     list({lookup(g) for g in re.sub(pattern, replacement, re.split(extensions_pattern, term, flags=re.IGNORECASE)[1]).split(' ') 
                                           if lookup(g) and is_valid(g)}))

df['human_genes'] = df['human_genes'].apply(lambda l: [g for g in l if g != None])

with open(data_dir/'tf-kinases.json', 'r') as f:
    tfs_kinases = json.load(f)

tfs = tfs_kinases['tfs']
kinases = tfs_kinases['kinases']

df['tfs'] = df['human_genes'].apply(lambda l: [item.upper() for item in l if item.upper() in tfs])
df['kinases'] = df['human_genes'].apply(lambda l: [item.upper() for item in l if item.upper() in kinases])

df['tf_clean'] = df['tfs'].apply(lambda l: l[0] if len(l) == 1 else None)
df['kinase_clean'] = df['kinases'].apply(lambda l: l[0] if len(l) == 1 else None)

terms = read_gmt(data_dir/'table-mining-clean.gmt')


def make_consensus_gmt(column: str, vals_to_remove: list, percent_cutoff = 0.25, num_terms_cutoff = 5):
    consensus = {}
    for t in tqdm(df[column].unique(), len(df[column].unique()), desc=f'Creating {column} consensus gmt'):
        if (t) and t not in vals_to_remove:
            geneset_terms = df[df[column] == t]['term'].values
            if len(geneset_terms) < num_terms_cutoff:
                continue
            genes = []
            [genes.extend(list(terms[gt].keys())) for gt in geneset_terms]
            gene_counts = pd.Series(genes).value_counts()
            to_keep = gene_counts[gene_counts >= (len(geneset_terms) * percent_cutoff)].index.values
            if len(to_keep) >= 5:
                consensus[t] = to_keep

    with open(data_dir/f'consensus_{column}.gmt', 'w') as fw:
        for term, geneset in consensus.items():
            gs_str= '\t'.join(geneset)
            fw.write(f"{term}\t\t{gs_str}\n")


make_consensus_gmt('tf_clean', [], .01, 5)
make_consensus_gmt('kinase_clean', [], .01, 5)

def make_terms_gmt(column: str, vals_to_remove: list, num_genes_cutoff = 10):
    gmt_dict = {}
    for _, t in tqdm(df[['term', column]].dropna().iterrows(), len(df[['term', column]].dropna()), desc=f'Creating {column} terms gmt'):
        term, tf = t['term'], t[column]
        if tf not in vals_to_remove:
            genes = list(terms[term].keys())
            if len(genes) >= num_genes_cutoff and len(genes) <= 3000 :
                gmt_dict[f'{term}_{tf}'] = genes
            

    with open(data_dir/f'{column}_{num_genes_cutoff}.gmt', 'w') as fw:
        for term, geneset in gmt_dict.items():
            gs_str= '\t'.join(geneset)
            fw.write(f"{term}\t\t{gs_str}\n")


make_terms_gmt('tf_clean', [], 10)
make_terms_gmt('kinase_clean', [], 10)