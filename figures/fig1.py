#%%
import re
import pathlib
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from tqdm.auto import tqdm
from matplotlib.lines import Line2D
from common import data_dir, GMT

#%%
fig_dir = pathlib.Path('figures/fig1')
fig_dir.mkdir(parents=True, exist_ok=True)

#%%
print('Loading Rummagene GMT...')
gmt = GMT.from_file(data_dir/'table-mining-clean.gmt')
df = gmt.to_df()

#%%
print('Computing set sizes...')
set_sizes = pd.Series(
  df.values.sum(axis=1, dtype=np.int64).astype(np.int64),
  index=df.index,
)

#%%
keep = set_sizes>=5

#%%
pubmedrif = pd.read_csv(data_dir/'pubmed_rif.tsv', sep='\t', index_col=None, header=None, names=['symbol', 'pmid'])
unique, counts = np.unique(pubmedrif['symbol'].dropna().to_numpy(), return_counts=True)
gene_pubs = dict(zip(unique, counts))
avg_citations = np.array([
  np.mean([
     gene_pubs.get(gene, 0)
     for gene in gene_list
  ])
  for gene_list in tqdm(gmt.gene_lists, desc='Computing avg citations...')
])

#%%
median_citations = np.array([
  np.median([
     gene_pubs.get(gene, 0)
     for gene in gene_list
  ])
  for gene_list in tqdm(gmt.gene_lists, desc='Computing median citations...')
])

#%%
fig = plt.figure(figsize=(3,2))
pd.Series(
  df.values[keep].sum(axis=0, dtype=np.int64),
  index=df.columns,
).hist(bins=50, color='black')
plt.grid(False)
plt.ylabel('genes')
plt.xlabel('gene sets containing gene')
plt.tight_layout()
plt.savefig(fig_dir/'1a.pdf', dpi=300)
plt.savefig(fig_dir/'1a.png', dpi=300)
# plt.show()
plt.clf()

#%%
fig = plt.figure(figsize=(3,2))
set_sizes[keep].hist(bins=50, log='y', color='black')
plt.grid(False)
plt.ylabel('gene sets')
plt.xlabel('gene set length')
plt.tight_layout()
plt.savefig(fig_dir/'1b.pdf', dpi=300)
plt.savefig(fig_dir/'1b.png', dpi=300)
# plt.show()
plt.clf()

#%%
papers = df.index[keep].map(lambda i: i[0].partition('-')[0])
fig = plt.figure(figsize=(3,2))
pd.Series(papers).value_counts().hist(bins=50, log='y', color='black')
plt.grid(False)
plt.ylabel('papers')
plt.xlabel('gene sets in paper')
plt.tight_layout()
plt.savefig(fig_dir/'1c.pdf', dpi=300)
plt.savefig(fig_dir/'1c.png', dpi=300)
# plt.show()
plt.clf()

#%%
# TODO: 1d

#%%
# TODO: 1e

#%%
df_umap = pd.read_csv(data_dir/'rummagene-umap.tsv', sep='\t', index_col=0)
df_umap['keep'] = keep.values
df_umap['set_size'] = set_sizes.values
df_umap['avg_citations'] = avg_citations
df_umap['median_citations'] = median_citations
df_umap = df_umap[(df_umap['outlier'] == 0) & df_umap['keep']]

#%%
plt.rcParams['font.size'] = 12
fig = plt.figure(figsize=(6,5), dpi=300)
plt.scatter(
  x=df_umap['UMAP-1'],
  y=df_umap['UMAP-2'],
  c=np.log(df_umap['set_size']),
  s=0.1,
  alpha=0.05,
  rasterized=True,
  cmap='viridis',
)
cbar = plt.colorbar(label='log(set_length)')
cbar.solids.set(alpha=1)
plt.xlabel('UMAP-1')
plt.ylabel('UMAP-2')
plt.xticks([])
plt.yticks([])
plt.tight_layout()
plt.savefig(fig_dir/'1f.pdf', dpi=300)
plt.savefig(fig_dir/'1f.png', dpi=300)
# plt.show()
plt.clf()

#%%
plt.rcParams['font.size'] = 12
fig = plt.figure(figsize=(6,5), dpi=300)
plt.scatter(
  x=df_umap['UMAP-1'],
  y=df_umap['UMAP-2'],
  c=np.log(df_umap['avg_citations']),
  s=0.1,
  alpha=0.05,
  rasterized=True,
  cmap='viridis',
)
cbar = plt.colorbar(label='log(avg_citations)')
cbar.solids.set(alpha=1)
plt.xlabel('UMAP-1')
plt.ylabel('UMAP-2')
plt.xticks([])
plt.yticks([])
plt.tight_layout()
plt.savefig(fig_dir/'1g.pdf', dpi=300)
plt.savefig(fig_dir/'1g.png', dpi=300)
# plt.show()
plt.clf()


#%%
plt.rcParams['font.size'] = 12
fig = plt.figure(figsize=(6,5), dpi=300)
plt.scatter(
  x=df_umap['set_size'],
  y=df_umap['median_citations'],
  s=0.2,
  alpha=0.5,
  rasterized=True,
)
plt.xlabel('genes in set')
plt.ylabel('median gene citations')
plt.loglog()
plt.tight_layout()
plt.savefig(fig_dir/'1h.pdf', dpi=300)
plt.savefig(fig_dir/'1h.png', dpi=300)
plt.show()
plt.clf()

#%%
random_median_citations = np.array([
  np.median([
     gene_pubs.get(gene, 0)
     for gene in np.random.choice(unique, size=set_size)
  ])
  for set_size in df_umap['set_size']
])
random_median_citations[np.isnan(random_median_citations)]=0

# %%
plt.rcParams['font.size'] = 12
color_pallete = {
  'Rummagene': plt.rcParams['axes.prop_cycle'].by_key()['color'][0],
  'Random': plt.rcParams['axes.prop_cycle'].by_key()['color'][1],
  'Rummagene Understudied': plt.rcParams['axes.prop_cycle'].by_key()['color'][2],
}
fig = plt.figure(figsize=(6,5), dpi=300)
plt.scatter(
  x=df_umap['set_size'],
  y=df_umap['median_citations'],
  s=0.2,
  alpha=0.5,
  rasterized=True,
  label='Rummagene',
  c=color_pallete['Rummagene'],
)
plt.scatter(
  x=df_umap['set_size'],
  y=random_median_citations,
  s=0.2,
  alpha=0.1,
  rasterized=True,
  label='Random',
  c=color_pallete['Random'],
)

d = pd.DataFrame(dict(
  x=df_umap['set_size'],
  y=random_median_citations,
))
dd = d.groupby(pd.cut(np.log10(d['x']+1), 10))['y']
dd_lo = (dd.mean() - 3*dd.std())
dd_lo.index = list(dd_lo.index.map(lambda r: (10**r.right)-1))
dd_lo = dd_lo.to_frame('y')
dd_lo['x2'] = [0, *dd_lo.index[:-1]]
plt.hlines(dd_lo['y'], xmin=dd_lo.index, xmax=dd_lo['x2'], colors='black')
dd_hi = (dd.mean() + 3*dd.std())
dd_hi.index = list(dd_hi.index.map(lambda r: (10**r.right)-1))
dd_hi = dd_hi.to_frame('y')
dd_hi['x2'] = [0, *dd_lo.index[:-1]]
plt.hlines(dd_hi['y'], xmin=dd_hi.index, xmax=dd_hi['x2'], colors='black')

selected = []
for x,r in dd_lo.iterrows():
  selected.append(df_umap.loc[(df_umap['set_size'] > r['x2']) & (df_umap['set_size'] <= x), 'median_citations'] < r['y'])
# selected = pd.concat(selected)

plt.scatter(
  x=df_umap.loc[df_umap.index.isin(selected.index)].loc[selected, 'set_size'],
  y=df_umap.loc[df_umap.index.isin(selected.index)].loc[selected, 'median_citations'],
  s=0.2,
  alpha=0.5,
  rasterized=True,
  label='Rummagene Understudied',
  c=color_pallete['Rummagene Understudied'],
)

plt.xlabel('genes in set')
plt.ylabel('median gene citations')
plt.loglog()
plt.legend(handles=[
  Line2D([0], [0], marker='o', markerfacecolor=color_pallete[label], color='w', label=label.replace(' ', '\n'), markersize=10)
  for label in ['Rummagene', 'Rummagene Understudied', 'Random']
] + [
  Line2D([0], [0], markerfacecolor='black', color='black', label='$\mu_{r} \pm 3\sigma$', markersize=10)
], loc='lower left')

plt.tight_layout()
plt.savefig(fig_dir/'1i.pdf', dpi=300)
plt.savefig(fig_dir/'1i.png', dpi=300)
# plt.show()
plt.clf()


#%%
# dump the understudied subset to a new file understudied.gmt
from ast import literal_eval
selected_terms = set(selected[selected].index.map(lambda i: literal_eval(i)[0]))

with open('data/table-mining-clean.gmt', 'r') as fr:
  with open('data/understudied.gmt', 'w') as fw:
    for line in fr:
      term, desc, *gene_set = line.strip().split('\t')
      if term not in selected_terms: continue
      print(term, desc, *gene_set, sep='\t', file=fw)


#%%
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
    with open('data/lookup.json', 'r') as fr:
      lookup = json.load(fr).get
  return lookup(value)

def sha256(s):
  import hashlib
  return hashlib.sha256(s.encode()).hexdigest()

def insert(T, *PV):
  *P, V = PV
  for p in P[:-1]:
    if p not in T: T[p] = {}
    T = T[p]
  T[P[-1]] = V

#%%
expr = re.compile(r'^(?P<paper>\w+)-(?P<filename>.+?\.[^-]+)-((?P<wildcard>\*)|(?P<label>.*?)-(?P<column>[^-]*))$')
genesets = {}
G = {}
oob = []

with open('data/table-mining-clean.gmt', 'r') as fr:
  for line in tqdm(fr):
    line_split = line.strip().split('\t')
    if len(line_split) < 2: continue
    term, desc, *geneset = line_split
    geneset_mapped = [gene_mapped for gene in geneset for gene_mapped in (gene_lookup(gene),) if gene_mapped]
    if len(geneset_mapped) < 5 or len(geneset_mapped) > 2000:
      oob.append(len(geneset_mapped))
      continue
    geneset_hash = sha256('\t'.join(sorted(set(geneset_mapped))))
    genesets[geneset_hash] = set(geneset_mapped)
    m = expr.match(term)
    insert(G, geneset_hash, m.group('paper'), term, None)

#%%
pd.Series(oob).hist()

#%%
fig = plt.figure(figsize=(3,2))
d = pd.DataFrame([dict(paper=p, duplicates=len(t) - 1) for g, P in G.items() if len(P) == 1 for p, t in P.items() if len(t) > 1]).groupby('paper')['duplicates'].sum().sort_values()
# d=d[d<500]
d.hist(bins=2000, color='black', label=f"{d.shape[0]:,} papers\n{d.sum():,} gene sets")
plt.legend(handlelength=0, handletextpad=0)
plt.grid(False)
plt.yscale('log')
plt.xscale('log')
plt.xlabel('redundant gene sets')
plt.ylabel('same paper')
plt.tight_layout()
plt.savefig(fig_dir/'1j.png', dpi=300, bbox_inches='tight')
plt.savefig(fig_dir/'1j.pdf', dpi=300, bbox_inches='tight')
# plt.show()
plt.clf()

#%%
fig = plt.figure(figsize=(3,2))
d=pd.Series([len(P)-1 for g, P in G.items() if len(P) > 1])
d.hist(bins=200, color='black', label=f"{d.shape[0]:,} papers\n{d.sum():,} gene sets")
plt.legend(handlelength=0, handletextpad=0)
plt.grid(False)
plt.yscale('log')
plt.xscale('log')
plt.xlabel('redundant gene sets')
plt.ylabel('different papers')
plt.tight_layout()
plt.savefig(fig_dir/'1k.png', dpi=300, bbox_inches='tight')
plt.savefig(fig_dir/'1k.pdf', dpi=300, bbox_inches='tight')
# plt.show()
plt.clf()
