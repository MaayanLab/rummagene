#%%
import json
import glasbey
import numpy as np
import pandas as pd
import pathlib
import matplotlib.pyplot as plt
from matplotlib.lines import Line2D

from common import data_dir

#%%
random_state = 42

#%%
fig_dir = pathlib.Path('figures/fig7')
fig_dir.mkdir(parents=True, exist_ok=True)

#%%
meta = pd.concat([
  pd.read_csv(data_dir / 'joint-umap.tsv', sep='\t', index_col=0),
  pd.read_csv(data_dir / 'joint-umap-cluster.tsv', sep='\t', index_col=0)[['cluster']],
], axis=1)

x = meta['UMAP-1']
y = meta['UMAP-2']
x_min, x_mu, x_std, x_max = np.min(x), np.mean(x), np.std(x), np.max(x)
x_lo, x_hi = max(x_min, x_mu - x_std*1.68), min(x_max, x_mu + x_std*1.68)
y_min, y_mu, y_std, y_max = np.min(y), np.mean(y), np.std(y), np.max(y)
y_lo, y_hi = max(y_min, y_mu - y_std*1.68), min(y_max, y_mu + y_std*1.68)
outlier = (x>=x_lo)&(x<=x_hi)&(y>=y_lo)&(y<=y_hi)

#%%
print('Categorizing terms...')
with (data_dir/'Enrichr'/'datasetStatistics.json').open('r') as fr:
  datasetStatistics = json.load(fr)

categories = {cat['categoryId']: cat['name'] for cat in datasetStatistics['categories']}
library_categories = {lib['libraryName']: categories[lib['categoryId']] for lib in datasetStatistics['statistics']}
library_categories['rummagene'] = 'Rummagene'
meta['category'] = meta['source'].apply(library_categories.get)

#%%
_ = meta[((meta['category'] != 'Rummagene') & ~meta['outlier'].astype(bool))]
cat = 'category'
cats = _[cat].unique()
color_pallete = dict(zip(cats, glasbey.create_palette(len(cats))))
for label, data in _.groupby(cat):
  plt.scatter(
    x=data['UMAP-1'],
    y=data['UMAP-2'],
    s=0.1,
    color=color_pallete[label],
    alpha=0.1,
    rasterized=True,
  )
ax = plt.gca()
box = ax.get_position()
ax.set_position([box.x0, box.y0, box.width * 0.8, box.height * 0.8])
plt.tight_layout()
lgd = plt.legend(handles=[
  Line2D([0], [0], marker='o', color='w', label=f"{label} ({int((_[cat] == label).sum()):,})",
        markerfacecolor=color_pallete[label], markersize=10)
  for label in cats
], loc='center left', bbox_to_anchor=(1, 0.5))
plt.xlabel('UMAP-1', fontdict=dict(size=24))
plt.ylabel('UMAP-2', fontdict=dict(size=24))
plt.xticks([])
plt.yticks([])
plt.savefig('7a.pdf', dpi=300, bbox_extra_artists=(lgd,), bbox_inches='tight')
plt.savefig('7a.png', dpi=300, bbox_extra_artists=(lgd,), bbox_inches='tight')
# plt.show()
plt.clf()

#%%
_ = meta[(~meta['outlier'].astype(bool))]
cat = 'category'
cats = _[cat].unique()
color_pallete = dict(zip(cats, glasbey.create_palette(len(cats))))
for label, data in _.groupby(cat):
  plt.scatter(
    x=data['UMAP-1'],
    y=data['UMAP-2'],
    s=0.1,
    color=color_pallete[label],
    alpha=0.1,
    rasterized=True,
  )
ax = plt.gca()
box = ax.get_position()
ax.set_position([box.x0, box.y0, box.width * 0.8, box.height * 0.8])
plt.tight_layout()
lgd = plt.legend(handles=[
  Line2D([0], [0], marker='o', color='w', label=f"{label} ({int((_[cat] == label).sum()):,})",
        markerfacecolor=color_pallete[label], markersize=10)
  for label in cats
], loc='center left', bbox_to_anchor=(1, 0.5))
plt.xlabel('UMAP-1', fontdict=dict(size=24))
plt.ylabel('UMAP-2', fontdict=dict(size=24))
plt.xticks([])
plt.yticks([])
plt.savefig('7b.pdf', dpi=300, bbox_extra_artists=(lgd,), bbox_inches='tight')
plt.savefig('7b.png', dpi=300, bbox_extra_artists=(lgd,), bbox_inches='tight')
# plt.show()
plt.clf()


#%%
m = meta[outlier&(meta['source']!='rummagene')]
cats = m['source'].unique()
color_pallete = dict(zip(cats, glasbey.create_palette(len(cats))))
plt.scatter(m['UMAP-1'], m['UMAP-2'],
            s=0.1, c=m['source'].apply(color_pallete.get), alpha=0.1)
plt.show()

# %%
cats = np.unique(m['cluster'])
color_pallete = dict(zip(cats, glasbey.create_palette(len(cats))))
plt.scatter(m['UMAP-1'], m['UMAP-2'],
            s=0.1, c=m['cluster'].apply(color_pallete.get))
plt.show()

#%%
C = pd.DataFrame(m[['cluster', 'source']].groupby('cluster')['source'].agg(Counter).to_dict())

m['annot'] = 'unknown'
for clust in C.columns:
  c = C[clust].dropna()
  c = c / c.sum()
  m.loc[m['cluster'] == clust, 'annot'] = '\n'.join(c[c > 0.25].index) or 'unknown'

m1 = m[m['annot']=='unknown']
m2 = m[m['annot']!='unknown']
cats = np.unique(m2['annot'])
color_pallete = dict(zip(cats, glasbey.create_palette(len(cats))))
plt.scatter(m1['UMAP-1'], m1['UMAP-2'],
            s=0.1, c='grey', alpha=0.1)
plt.scatter(m2['UMAP-1'], m2['UMAP-2'],
            s=0.1, c=m2['annot'].apply(color_pallete.get))
plt.xlabel('UMAP-1')
plt.ylabel('UMAP-2')
plt.xticks([])
plt.yticks([])
plt.tight_layout()
lgd = plt.legend(handles=[
  Line2D([0], [0], marker='o', color='w', label=label,
        markerfacecolor=color_pallete[label], markersize=10)
  for label in cats
], bbox_to_anchor=(0.5, -0.1), loc='upper center', borderaxespad=0)
plt.show()

#%%
top = set(m.groupby('cluster')['term'].count().sort_values().iloc[-26:-1].index)

cluster_labels = m.groupby('cluster')['annot'].first().to_dict()
def make_cluster_label(c):
  if c not in top: return ''
  if cluster_labels.get(c, 'unknown').startswith('unknown'):
    return f"Unknown Cluster {c}"
  else:
    return cluster_labels[c]
m3 = meta[outlier&(meta['source']=='rummagene')]
m3['annot'] = m3['cluster'].apply(make_cluster_label)
m4 = m3[m3['annot'] != '']
m5 = m3[m3['annot'] == '']
cats = m4['annot'].unique()
color_pallete = dict(zip(cats, glasbey.create_palette(len(cats))))
plt.scatter(m5['UMAP-1'], m5['UMAP-2'],
            s=0.1, c='grey', alpha=0.1)
plt.scatter(m4['UMAP-1'], m4['UMAP-2'],
            s=0.1, c=m4['annot'].apply(color_pallete.get), alpha=0.1)
lgd = plt.legend(handles=[
  Line2D([0], [0], marker='o', color='w', label=label,
        markerfacecolor=color_pallete[label], markersize=10)
  for label in cats
], bbox_to_anchor=(0.5, -0.1), loc='upper center', borderaxespad=0)
plt.show()

#%%
C = pd.DataFrame(meta[outlier][['cluster', 'source']].groupby('cluster')['source'].agg(Counter).to_dict())
enrichr_members = C[C > 100].drop('rummagene').dropna(how='all', axis=1).columns
uniquely_rummagene = set(C[C>100].dropna(how='all', axis=1).columns) - set(enrichr_members)

c = C[C>100].loc['rummagene', uniquely_rummagene]
top_uniquely_rummagene_clust = c[c > 2500].index

c = C[C>100].drop('rummagene')[enrichr_members].sum(axis=0)
top_enrichr_clust = c[c > 1000].index

c = C[C>100].loc['rummagene', enrichr_members]
uniquely_enrichr_clust = c[pd.isna(c)].index

pd.Series([C.loc['rummagene', c] / C[c].sum() for c in uniquely_rummagene]).hist()
pd.Series([C.loc['rummagene', c] / C[c].sum() for c in uniquely_enrichr_clust]).hist()

meta['annot'] = ''
for c in uniquely_enrichr_clust:
  meta.loc[meta['cluster'] == c, 'annot'] = 'Uniquely Enrichr'
for c in uniquely_rummagene:
  meta.loc[meta['cluster'] == c, 'annot'] = 'Uniquely Rummagene'
# for c in top_enrichr_clust:
#   meta.loc[meta['cluster'] == c, 'annot'] = 'Shared'

heterogeneous = set(meta['cluster'].unique()) - {-1} - set(uniquely_enrichr_clust) - set(uniquely_rummagene)

a = meta[outlier&(meta['annot'] != '')]
b = meta[outlier&(meta['annot'] == '')]
cats = a['annot'].unique()
color_pallete = dict(zip(cats, glasbey.create_palette(len(cats))))
plt.rcParams['font.size'] = 9
fig = plt.figure(figsize=(6,5))
plt.scatter(b['UMAP-1'], b['UMAP-2'],
            s=0.1, c='grey', alpha=0.01, rasterized=True)
plt.scatter(a['UMAP-1'], a['UMAP-2'],
            s=0.1, c=a['annot'].apply(color_pallete.get), alpha=0.1, rasterized=True)
plt.tight_layout()
ax = plt.gca()
box = ax.get_position()
ax.set_position([box.x0, box.y0, box.width * 0.8, box.height * 0.8])
lgd = plt.legend(handles=[
  Line2D([0], [0], marker='o', color='w', label={
    'Uniquely Rummagene': f"Mostly Rummagene ({meta[meta['annot'] == 'Uniquely Rummagene'].shape[0]:,})",
    'Uniquely Enrichr': f"Mostly Enrichr ({meta[meta['annot'] == 'Uniquely Enrichr'].shape[0]:,})",
  }[label], markerfacecolor=color_pallete[label], markersize=10)
  for label in cats
] + [
  Line2D([0], [0], marker='o', color='w', label=f"Heterogenous Enrichr ({((meta['source'] != 'rummagene') & meta['cluster'].isin(list(heterogeneous))).sum():,})", markerfacecolor='gray', markersize=10),
  Line2D([0], [0], marker='o', color='w', label=f"Heterogenous Rummagene ({((meta['source'] == 'rummagene') & meta['cluster'].isin(list(heterogeneous))).sum():,})", markerfacecolor='gray', markersize=10),
  Line2D([0], [0], marker='o', color='w', label=f"Unclustered Enrichr ({meta[(meta['source'] != 'rummagene') & (meta['cluster'] == -1)].shape[0]:,})", markerfacecolor='gray', markersize=10),
  Line2D([0], [0], marker='o', color='w', label=f"Unclustered Rummagene ({meta[(meta['source'] == 'rummagene') & (meta['cluster'] == -1)].shape[0]:,})", markerfacecolor='gray', markersize=10),
], loc='center left', bbox_to_anchor=(1, 0.5))
plt.xticks([])
plt.yticks([])
plt.xlabel('UMAP-1', fontsize=14)
plt.ylabel('UMAP-2', fontsize=14)
plt.savefig(fig_dir/'7c.pdf', dpi=300, bbox_extra_artists=(lgd,), bbox_inches='tight')
plt.savefig(fig_dir/'7c.png', dpi=300, bbox_extra_artists=(lgd,), bbox_inches='tight')
# plt.show()
plt.clf()

#%%
enrichr_members = C[C > 100].drop('rummagene').dropna(how='all', axis=1).columns
uniquely_rummagene = set(C[C>100].dropna(how='all', axis=1).columns) - set(enrichr_members)

c = C[C>100].loc['rummagene', uniquely_rummagene]
top_uniquely_rummagene_clust = c[c > 2500].index

c = C[C>100].drop('rummagene')[enrichr_members].sum(axis=0)
top_enrichr_clust = c[c > 1000].index

c = C[C>100].loc['rummagene', enrichr_members]
uniquely_enrichr_clust = c[pd.isna(c)].index

uniquely_enrichr_annot = uniquely_enrichr_clust.map(cluster_labels.get).to_series().str.split('|').explode().unique()

meta['annot'] = ''
for c in uniquely_enrichr_clust:
  meta.loc[meta['cluster'] == c, 'annot'] = cluster_labels.get(c)
for c in top_uniquely_rummagene_clust:
  meta.loc[meta['cluster'] == c, 'annot'] = f"Rummagene Cluster {c}"
# for c in top_enrichr_clust:
#   meta.loc[meta['cluster'] == c, 'annot'] = 'Shared'

for annot, records in meta.groupby('annot'):
  if annot == '': continue
  if annot.startswith('Rummagene'):
    meta.loc[meta['annot'] == annot, 'annot'] = f"{annot} ({records.shape[0]:,})"
  else:
    meta.loc[meta['annot'] == annot, 'annot'] = '\n'.join(sorted(
      f"{source} ({r.shape[0]:,})"
      for source, r in records.groupby('source')
      if source in annot.split('\n')
    ))

a = meta[outlier&(meta['annot'] != '')]
b = meta[outlier&(meta['annot'] == '')]
cats = sorted(a['annot'].unique(), reverse=True)
color_pallete = dict(zip(cats, glasbey.create_palette(len(cats))))
plt.rcParams['font.size'] = 9
fig = plt.figure(figsize=(6,5))
plt.scatter(b['UMAP-1'], b['UMAP-2'],
            s=0.1, c='grey', alpha=0.01, rasterized=True)
plt.scatter(a['UMAP-1'], a['UMAP-2'],
            s=0.1, c=a['annot'].apply(color_pallete.get), alpha=1, rasterized=True)
plt.tight_layout()
ax = plt.gca()
box = ax.get_position()
ax.set_position([box.x0, box.y0, box.width * 0.8, box.height * 0.8])
lgd = plt.legend(handles=[
  Line2D([0], [0], marker='o', color='w', label=label,
        markerfacecolor=color_pallete[label], markersize=10)
  for label in cats
], loc='center left', bbox_to_anchor=(1, 0.5))
plt.xticks([])
plt.yticks([])
plt.xlabel('UMAP-1', fontsize=14)
plt.ylabel('UMAP-2', fontsize=14)
plt.savefig(fig_dir/'7d.pdf', dpi=300, bbox_extra_artists=(lgd,), bbox_inches='tight')
plt.savefig(fig_dir/'7d.png', dpi=300, bbox_extra_artists=(lgd,), bbox_inches='tight')
# plt.show()
plt.clf()

#%%
unique_rummagene_terms = meta[(meta['cluster'].isin(top_uniquely_rummagene_clust) & (meta['source'] == 'rummagene'))][['term', 'cluster']]
unique_rummagene_terms.sort_values('cluster', inplace=True)
unique_rummagene_terms.to_csv('data/unique_rummagene_cluster_terms.tsv', sep='\t', index=None)
