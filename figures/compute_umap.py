#%%
import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.decomposition import TruncatedSVD
from umap import UMAP

from common import data_dir, GMT

#%%
random_state = 42

#%%
print('Loading Rummagene GMT...')
gmt = GMT.from_file(data_dir/'table-mining-clean.gmt')

#%%
print('Computing IDF...')
vectorizer = TfidfVectorizer(analyzer=lambda gs: gs)
vectors = vectorizer.fit_transform(gmt.gene_lists)

#%%
print('Computing SVD...')
svd = TruncatedSVD(n_components=50, random_state=random_state)
svs = svd.fit_transform(vectors)

# %%
print('Computing UMAP...')
umap = UMAP(random_state=random_state)
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
print('Saving umap...')
df_umap = pd.DataFrame(embedding, columns=['UMAP-1', 'UMAP-2'], index=gmt.terms)
df_umap['outlier'] = (~outlier).astype(int)
df_umap

#%%
df_umap.to_csv(data_dir / 'rummagene-umap.tsv', sep='\t')
