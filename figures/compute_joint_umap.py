#%%
import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.decomposition import TruncatedSVD
from hdbscan import HDBSCAN
from umap import UMAP

from common import data_dir, GMT

#%%
random_state = 42

#%%
print('Loading Enrichr GMT...')
enrichr_gmt = GMT.from_file(data_dir/'enrichr-clean.gmt')

#%%
print('Loading Rummagene GMT...')
rummagene_gmt = GMT.from_file(data_dir/'table-mining-clean.gmt')

#%%
print('Collecting metadata...')
meta = pd.DataFrame(
  [
    { 'source': library, 'term': term }
    for library, term in enrichr_gmt.terms
  ] + [
    { 'source': 'rummagene', 'term': term }
    for term, _ in rummagene_gmt.terms
  ]
)

#%%
print('Computing IDF...')
vectorizer = TfidfVectorizer(analyzer=lambda gs: gs)
vectors = vectorizer.fit_transform(enrichr_gmt.gene_lists + rummagene_gmt.gene_lists)

#%%
print('Computing SVD...')
svd = TruncatedSVD(n_components=50, random_state=random_state)
svs = svd.fit_transform(vectors)

# %%
print('Computing UMAP...')
umap = UMAP(random_state=random_state, low_memory=True)
# umap = UMAP(n_neighbors=200, random_state=random_state, low_memory=True)
embedding = umap.fit_transform(svs)

#%%
print('Computing outliers...')
x = embedding[:, 0]
y = embedding[:, 1]
x_min, x_mu, x_std, x_max = np.min(x), np.mean(x), np.std(x), np.max(x)
x_lo, x_hi = max(x_min, x_mu - x_std*1.68), min(x_max, x_mu + x_std*1.68)
y_min, y_mu, y_std, y_max = np.min(y), np.mean(y), np.std(y), np.max(y)
y_lo, y_hi = max(y_min, y_mu - y_std*1.68), min(y_max, y_mu + y_std*1.68)
outlier = (x>=x_lo)&(x<=x_hi)&(y>=y_lo)&(y<=y_hi)

#%%
print('Saving joint-umap...')
meta['UMAP-1'] = x
meta['UMAP-2'] = y
meta['outlier'] = (~outlier).astype(int)
meta.to_csv(data_dir / 'joint-umap.tsv', sep='\t')

# %%
print('Computing Cluster UMAP...')
cluster_umap = UMAP(
  n_neighbors=30,
  min_dist=0.0,
  n_components=2,
  random_state=random_state,
  low_memory=True,
)
cluster_embedding = cluster_umap.fit_transform(svs)

# %%
print('Computing Clusters...')
labels = HDBSCAN(
    min_samples=10,
    min_cluster_size=500,
).fit_predict(cluster_embedding)

#%%
x = cluster_embedding[:, 0]
y = cluster_embedding[:, 1]
meta['UMAP-1'] = x
meta['UMAP-2'] = y
meta['cluster'] = labels
meta.to_csv(data_dir / 'joint-umap-cluster.tsv', sep='\t')
