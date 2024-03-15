import pathlib
import os
import pandas as pd
import plotly.graph_objects as go
import matplotlib
from matplotlib import pyplot as plt
from maayanlab_bioinformatics.harmonization import ncbi_genes_lookup
from common import data_dir, add_p_value_annotation, maybe_tqdm

fig_dir = pathlib.Path('figures')/'fig2'
os.makedirs('figures/fig2', exist_ok=True)

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

lookup = ncbi_genes_lookup()

  
def extract_term_counts(path):
  with pathlib.Path(path).open('r') as fr:
    return {
      term: [len(geneset)]
      for line in fr
      for term, _, *geneset in (line.strip().split('\t'),)
    }
  
savefigs = True
font = {'size' : 10}
matplotlib.rc('font', **font)

terms = extract_term_counts(data_dir/'table-mining-clean.gmt')
df = pd.DataFrame.from_dict(terms).T.reset_index()
df.columns = ['term', 'count']
df['pmc'] = df['term'].apply(lambda x: x.split('-')[0])


import re
import json

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

pattern = r'[-_.]'
replacement = ' '
extensions = ['xls', 'txt', 'xlsx', 'xlsx', 'xlsm', 'doc', 'docx', 'pdf', 'csv', 'tsv', 'nxml', 'ods', 'odt']
extensions_pattern = r'\b(?:(?=\S)' + '|'.join(map(re.escape, extensions)) + r')\b'

df['human_genes'] = df['term'].apply(lambda term: 
                                     list({lookup(g) for g in re.sub(pattern, replacement, re.split(extensions_pattern, term, flags=re.IGNORECASE)[1]).split(' ') 
                                           if lookup(g) and is_valid(g)}))

df['human_genes'] = df['human_genes'].apply(lambda l: [g for g in l if g != None])
num_terms_human = len(df[df['human_genes'].str.len() != 0])
df[df['human_genes'].str.len() != 0]

human_genes = []
[human_genes.extend(gs) for gs in df[df['human_genes'].str.len() != 0]['human_genes'].values]
human_genes_unique = len(set(human_genes))

## Load in list of all the Kinases and TFs present in KEA3/ChEA3

with open(data_dir/'tf-kinases.json', 'rb') as f:
    tfs_kinases = json.load(f)
tfs = tfs_kinases['tfs']
kinases = tfs_kinases['kinases']

print('Checking for', len(tfs), 'TFs and', len(kinases), 'kinases')

df['tfs'] = df['human_genes'].apply(lambda l: [item.upper() for item in l if item.upper() in tfs])
df['kinases'] = df['human_genes'].apply(lambda l: [item.upper() for item in l if item.upper() in kinases])

num_terms_tfs = len(df[df['tfs'].str.len() != 0])
num_terms_kinases = len(df[df['kinases'].str.len() != 0])

df['tf_clean'] = df['tfs'].apply(lambda l: l[0] if len(l) == 1 else None)
df['kinase_clean'] = df['kinases'].apply(lambda l: l[0] if len(l) == 1 else None)

num_unqiue_tfs = len(df['tf_clean'].dropna().unique())
num_unqiue_kinases = len(df['kinase_clean'].dropna().unique())

num_unqiue_tfs_100 = len(df[df['count'] >= 100]['tf_clean'].dropna().unique())
num_unqiue_kinases_100 = len(df[df['count'] >= 100]['kinase_clean'].dropna().unique())

num_terms_tfs = len(df['tf_clean'].dropna())
num_terms_kinases = len(df['kinase_clean'].dropna())

num_terms_tfs_100 = len(df[df['count'] >= 100]['tf_clean'].dropna())
num_terms_kinases_100 = len(df[df['count'] >= 100]['kinase_clean'].dropna())

fig, ax = plt.subplots()
bars = ax.barh(['terms containing TF(s)','terms containing kinase(s)', 'unique TFs', 'unique kinases'], 
               [num_terms_tfs, num_terms_kinases, num_unqiue_tfs, num_unqiue_kinases], color='black')

ax.bar_label(bars, fmt='{:,.0f}')
ax.set_xlim(0, 12000)
plt.tight_layout
plt.savefig(fig_dir/'2a.png', dpi=300)
plt.savefig(fig_dir/'2a.pdf', dpi=300)
plt.clf()

def check_sigs(t):
    split_term = re.sub(pattern, replacement, 
                        re.split(extensions_pattern, t, flags=re.IGNORECASE)[1]).lower().split(' ')
    if 'up' in split_term or 'down' in split_term:
        return True
    return False

def find_dir(t):
    split_term = re.sub(pattern, replacement, 
                        re.split(extensions_pattern, t, flags=re.IGNORECASE)[1]).lower().split(' ')
    if 'up' in split_term:
        return 'up'
    elif 'down' in split_term or 'dn' in split_term:
        return 'down'
    return None

df['signature'] = df['term'].apply(check_sigs)
df['dir'] = df['term'].apply(find_dir)
num_terms_sigs = len(df[df['signature']])
num_terms_sigs_up = len(df[df['dir'] == 'up'])
num_terms_sigs_down = len(df[df['dir'] == 'down'])
df[df['signature']]

fig, ax = plt.subplots()
bars = ax.barh(['containing gene(s)', 'unique genes', 
     'signatures', "signatures 'up'", "signatures 'down'"], 
     [num_terms_human ,human_genes_unique, num_terms_sigs, num_terms_sigs_up, num_terms_sigs_down], color='black')

ax.bar_label(bars, fmt='{:,.0f}')
ax.set_xlim(0, 125000)
plt.tight_layout()
plt.savefig(fig_dir/'2b.png', dpi=300)
plt.savefig(fig_dir/'2b.pdf', dpi=300)
plt.clf()

import xml.etree.ElementTree as ET
tree = ET.parse(data_dir/'bto.owl')
root = tree.getroot()

tissues_cell_types = {}
cell_lines = {}
synomn_mapper = {}

map_synomns = True

patterns_to_remove = [r'\b(cell|line)\b', r'[-/]+']
regex_patterns = re.compile('|'.join(patterns_to_remove), re.IGNORECASE)

for child in root.iter('{http://www.w3.org/2002/07/owl#}Class'):
    try:
        bto = list(child.attrib.values())[0].split('/')[-1]
        name = child.find('{http://www.w3.org/2000/01/rdf-schema#}label').text.strip()
        synomns = []

        if map_synomns:
            for syn in child.iter('{http://www.geneontology.org/formats/oboInOwl#}hasRelatedSynonym'):
                synomns.append(re.sub(r'[-_.]', ' ', syn.text.strip()))

        desc = child.find('{http://purl.obolibrary.org/obo/}IAO_0000115').text
        str_to_check = f"{desc} {name} {' '.join(synomns)}"

        if 'cell line' in str_to_check or 'cell lines' in str_to_check:
            stripped_name = re.sub(regex_patterns, '', name).strip()
            cell_lines[stripped_name] = bto
            if map_synomns:
                for s in synomns:
                    synomn_mapper[s] = stripped_name
                    cell_lines[s] = bto
                synomn_mapper[stripped_name] = stripped_name
        else:
            tissues_cell_types[re.sub(r'[-_.]', ' ', name).lower()] = bto
            if map_synomns:
                for s in synomns:
                    synomn_mapper[s.lower()] = re.sub(r'[-_.]', ' ', name).lower()
                    tissues_cell_types[s.lower()] = bto
                synomn_mapper[re.sub(r'[-_.]', ' ', name).lower()] = re.sub(r'[-_.]', ' ', name).lower()
    except:
        continue

tissues_cell_types
num_tissue_names = len(tissues_cell_types.keys())
num_cell_line_names = len(cell_lines.keys())
print('Extracted', num_tissue_names, 'tissue and cell type names and', num_cell_line_names, 'cell line names')

df['term-description'] = df['term'].apply(lambda t: re.split(extensions_pattern, t, flags=re.IGNORECASE)[1])


tissue_list = []
for i in maybe_tqdm(range(len(df))):
    term = re.sub(r'[-_.]', ' ', df.iloc[i]['term-description'])
    tissue_list.append(re.findall(r'\b(?:(?=\S)' + '|'.join(map(re.escape, tissues_cell_types)) + r')\b', term))
df['tissue_cell_type'] = tissue_list

cell_line_list = []
for i in maybe_tqdm(range(len(df))):
    term = re.sub(r'[-_.]', ' ', df.iloc[i]['term-description'])
    cell_line_list.append(re.findall(r'\b(?:(?=\S)' + '|'.join(map(re.escape, cell_lines)) + r')\b', term))
df['cell_line'] = cell_line_list

def remove_dups(seq):
    seen = set()
    seen_add = seen.add
    return [x for x in seq if not (x in seen or seen_add(x))]

def clean_names(l):
    clean_lst = []
    for item in l:
        if len(item.strip()) > 2:
            clean_lst.append(synomn_mapper[item.strip()])
    clean_lst = remove_dups(clean_lst)
    if len(clean_lst) > 0:
        return '-'.join(clean_lst)
    return None

df['tissue_cell_type_clean'] = df['tissue_cell_type'].apply(clean_names)
df['cell_line_clean'] = df['cell_line'].apply(clean_names)

num_pmc_cell_line = len(df[['cell_line_clean']].dropna())
num_cell_lines = len(df[['cell_line_clean']].drop_duplicates().dropna())

num_pmc_tissue = len(df[['tissue_cell_type_clean']].dropna())
num_tissue= len(df[['tissue_cell_type_clean']].drop_duplicates().dropna())

fig, ax = plt.subplots()
bars = ax.barh(['terms containing tissues/cell types','terms containing cell lines', 'unique tissues/cell types', 'unique cell lines'], 
               [num_pmc_tissue, num_pmc_cell_line, num_tissue, num_cell_lines], color='black')

ax.bar_label(bars, fmt='{:,.0f}')
ax.set_xlim(0, 10000)

plt.tight_layout()
plt.savefig(fig_dir/'2c.png', dpi=300)
plt.savefig(fig_dir/'2c.pdf', dpi=300)
plt.clf()

df_100 = df[(df['count'] >= 100)]

tf_terms_clean = df_100[~df_100['tf_clean'].isna()][['term', 'pmc', 'tf_clean']]
kinase_terms_clean = df_100[~df_100['kinase_clean'].isna()][['term', 'pmc', 'kinase_clean']]

gmt = read_gmt(data_dir/'table-mining-clean.gmt')

sig_tfs = []
seen = set()
for i, row in maybe_tqdm(tf_terms_clean.iterrows()):
    tf_genesets = {}
    tf = row['tf_clean']
    if tf in seen:
        continue
    seen.add(tf)
    pmc = row['pmc']
    tf_tab = tf_terms_clean[(tf_terms_clean['tf_clean'] == tf) & (tf_terms_clean['pmc'] != pmc)] 
    for i, row in tf_tab.iterrows():
        tf_genesets[row['term']] = set(gmt[row['term']].keys())
    if len(tf_genesets) > 1:
        tf_term_list = list(tf_genesets.keys())
        for i, t in enumerate(tf_term_list):
            # compare overlap with all other tf containing terms, until all comparisons are done
            for tf_term in tf_term_list[i+1:]:
                jaccard = len(tf_genesets[t].intersection(tf_genesets[tf_term])) / len(tf_genesets[t].union(tf_genesets[tf_term]))
                sig_tfs.append(jaccard)

sig_tfs_shuffle = []
seen = set()
for i, row in maybe_tqdm(tf_terms_clean.iterrows(), total=len(tf_terms_clean)):
    gs = gmt[row['term']]
    pmc = row['pmc']
    tf = row['tf_clean']
    tab = tf_terms_clean[(tf_terms_clean['pmc'] != pmc) & (tf_terms_clean['tf_clean'] != tf)]
    for j, row2 in tab.iterrows():
        combo = frozenset({row['term'], row2['term']})
        if combo in seen:
            continue
        gs2 = gmt[row2['term']]
        jaccard = len(set(gs).intersection(gs2)) / len(set(gs).union(gs2))
        sig_tfs_shuffle.append(jaccard)
        seen.add(combo)

sig_kinases = []
seen = set()
for i, row in maybe_tqdm(kinase_terms_clean.iterrows()):
    kinase_genesets = {}
    pmc = row['pmc']
    kinase = row['kinase_clean']
    if kinase in seen:
        continue
    seen.add(kinase)
    kinase_tab = kinase_terms_clean[(kinase_terms_clean['pmc'] != pmc) & (kinase_terms_clean['kinase_clean'] != kinase)]
    for i, row in kinase_tab.iterrows():
        kinase_genesets[row['term']] = set(gmt[row['term']].keys())
    if len(kinase_genesets) > 1:
        kinase_term_list = list(kinase_genesets.keys())
        for i, k in enumerate(kinase_term_list):
            # compare overlap with all other tf containing terms, until all comparisons are done
            for kinase_term in kinase_term_list[i+1:]:
                jaccard = len(kinase_genesets[k].intersection(kinase_genesets[kinase_term])) / len(kinase_genesets[k].union(kinase_genesets[kinase_term]))
                sig_kinases.append(jaccard)

sig_kinases_shuffle = []
seen = set()
for i, row in maybe_tqdm(kinase_terms_clean.iterrows(), total=len(kinase_terms_clean)):
    gs = gmt[row['term']]
    pmc = row['pmc']
    kinase = row['kinase_clean']
    tab = kinase_terms_clean[(kinase_terms_clean['pmc'] != pmc) & (kinase_terms_clean['kinase_clean'] != kinase)]
    for j, row2 in tab.iterrows():
        combo = frozenset({row['term'], row2['term']})
        if combo in seen:
            continue
        gs2 = gmt[row2['term']]
        jaccard = len(set(gs).intersection(gs2)) / len(set(gs).union(gs2))
        sig_kinases_shuffle.append(jaccard)
        seen.add(combo)


fig = go.Figure()
for (gs, vec) in [['Same TF in Column Name', sig_tfs], ['Different TF + PMC', sig_tfs_shuffle], ['Same Kinase in Column Name', sig_kinases], ['Different Kinase + PMC', sig_kinases_shuffle]]:
        fig.add_trace(
            go.Violin(
                y=vec,
                name=gs.split('_')[0].replace('single', 'GEO'),
                box_visible=True, 
                line_color='black',
                meanline_visible=True,
                points=False
            )
        )

fig.update_layout(yaxis_title='Mean Jaccard', plot_bgcolor='white', yaxis_gridcolor='gray', width=1000, height=800, showlegend=False, font=dict(size=18), yaxis_range=[-.02, 0.2])

fig = add_p_value_annotation(fig, [[0, 1], [2, 3]])
fig.write_image(fig_dir/'2d.png')
