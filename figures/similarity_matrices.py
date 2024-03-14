# %%
import pandas as pd
import numpy as np
import random
random.seed(123)
import pathlib
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

# %% [markdown]
# # Preprocessing

# %%
gmt = read_gmt(data_dir/'table-mining-clean.gmt') # Use the updated Rummagene gene sets GMT file

# %%
terms = list(gmt)
sample = 50000
print(len(terms))
df_gmt = pd.DataFrame({term: gmt[term] for term in random.sample(terms, k=sample)})

# %%
""" Gene sets that contain more than 2,000 genes are rejected on the basis that they are non-specific and may incur undue computational expense in subsequent analysis """
print(len(df_gmt.sum()[df_gmt.sum()>2000]))
df = df_gmt[df_gmt.columns[df_gmt.sum()<=2000]]

# %% [markdown]
# # Similarity matrix construction

# %%
# Co-occurrence matrix
df = df.fillna(0)
#df_coocc = df.dot(df.T)

# %%
df_coocc = pd.read_feather(data_dir/"random50k_co-occurrence.f")
df_coocc

# %%
# Sanity check diagonals
df.sum(axis=1) == np.diag(df_coocc)

# %%
# phi0 = total number of co-occurrences
phi0 = 0.5 * (df_coocc.sum().sum() - np.diag(df_coocc).sum())
phi0

# %% [markdown]
# ## PWMI and NMI

# %%
# Point-wise mutual information (PWMI)
coocc_prob = df_coocc/phi0 # co-occurrence probability
marg_prob = (df_coocc.sum() - np.diag(df_coocc))/phi0 # marginal probabilities
mult_prob = pd.DataFrame(marg_prob).dot(pd.DataFrame(marg_prob).T) # P(A)*P(B)

# %%
pwmi = np.log(coocc_prob.div(mult_prob)) # PWMI = max(0, log( P(A,B) / P(A)*P(B) ))
pwmi[pwmi < 0] = 0
pwmi

#%%
pwmi.to_feather(data_dir/'pwmi.f')

# %%
# Normalized PWMI
nmi = -pwmi.div(np.log(coocc_prob)) # NPMI = -PMI / log(P(A, B))
nmi

#%%
nmi.to_feather(data_dir/'nmi.f')

# %% [markdown]
# ## Jaccard index

# %%
sum_prob = pd.DataFrame([marg_prob + x for x in marg_prob], index=marg_prob.index) # P(A)+P(B)
union_prob = sum_prob-coocc_prob # P(A)+P(B)-P(A,B)
jacc = coocc_prob.div(union_prob) # Jaccard index = P(A,B) / P(A)+P(B)-P(A,B)
jacc

#%%
jacc.to_feather(data_dir/'jacc.f')

# %% [markdown]
# ## Cosine distance

# %%
cosine = coocc_prob.div(np.sqrt(mult_prob)) # cosine distance = P(A, B)/sqrt(P(A)*P(B))
cosine

#%%
cosine.to_feather(data_dir/'jacc.f')
