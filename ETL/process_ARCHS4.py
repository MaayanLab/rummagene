# %%
import os
import json
import h5py as h5
import pandas as pd
import numpy as np
from tqdm import tqdm

import nltk
from nltk.corpus import stopwords
nltk.download('stopwords')
from sklearn.cluster import KMeans

os.makedirs('./ETL/out', exist_ok=True)
# %%
# get series meta data
species='human'
file= 'human_gene_v2.2.h5'

# %%

species = "human"
version = "2.2"
gsm4sig_version = 2
single_cell_prob_thresh = 0.5

f = h5.File(species+"_gene_v"+version+".h5", "r")
gse_scprob = np.array([
    f["meta"]["samples"]["series_id"], 
    f["meta"]["samples"]["geo_accession"],
    f["meta"]["samples"]["singlecellprobability"],
    f["meta"]["samples"]["title"],
    f["meta"]["samples"]["characteristics_ch1"],
    f["meta"]["samples"]["source_name_ch1"],
]).T
f.close()

# %%
samps_df = pd.DataFrame(gse_scprob, columns =['gse', 'gsm', 'scprob', 'title','characteristics_ch1', 'source_name_ch1'])
samps_df = samps_df[samps_df['scprob'] < .5]
samps_df['gse'] = samps_df['gse'].apply(lambda s: s.decode("utf-8"))
samps_df['gsm'] = samps_df['gsm'].apply(lambda s: s.decode("utf-8"))
samps_df['title'] = samps_df['title'].apply(lambda s: s.decode("utf-8"))
samps_df['characteristics_ch1'] = samps_df['characteristics_ch1'].apply(lambda s: s.decode("utf-8"))
samps_df['source_name_ch1'] = samps_df['source_name_ch1'].apply(lambda s: s.decode("utf-8"))

# %%
if not os.path.exists(f'valid_{species}.json'):
    valid = set()
    checked = set()
    for i, row in tqdm(samps_df.iterrows(), total=len(samps_df)):
        if row['gse'] in checked:
            continue
        samps = samps_df[samps_df['gse'] == row['gse']]
        n_samps = len(samps)
        if n_samps >= 6 and n_samps < 50:
            valid.add(row['gse'])
        checked.add(row['gse'])
    with open(f'valid_{species}.json', 'w') as fo:
        json.dump(list(valid), fo)
else:
    with open(f'valid_{species}.json') as fr:
        valid = json.load(fr)

# %%
from sentence_transformers import SentenceTransformer

sentence_bert_model = SentenceTransformer('all-mpnet-base-v2')

def get_embeddings(sentences):
    return sentence_bert_model.encode(sentences,
                                    batch_size=32, 
                                    show_progress_bar=False)

pd.options.mode.chained_assignment = None

# %%
words_to_remove = ['experiement', 'experiment', 'patient', 'batch', '1', '2', '3', '4', '5', '6', '7', '8', '9']
stopwords_plus = set(stopwords.words('english') + (words_to_remove))

gse_dict = {}

for gse in tqdm(valid):
    gse_table = samps_df[samps_df['gse'] == gse]
    meta_names = gse_table['title'] + ' _ ' +  gse_table['characteristics_ch1'] + ' _ ' +  gse_table['source_name_ch1']
    data = list(map(lambda s: s.lower(), meta_names.values))
    data_clean = []
    for d in data:
        data_clean.append(' '.join(list(filter(lambda w: w not in stopwords_plus, d.replace(',', ' ').split(' ')))))

    e = get_embeddings(data_clean)
    embedding_df = pd.DataFrame(e, index=gse_table['gsm'].values)

    kmeans = KMeans(n_clusters= (len(embedding_df) // 3), n_init=10).fit(embedding_df.values)
    gse_table['label'] = kmeans.labels_

    gse_table = gse_table[gse_table['label'].map(gse_table['label'].value_counts()) >= 3]
    if len(gse_table) < 6:
        continue
    
    grouped_gse_table = gse_table.groupby('label')
    gse_dict[gse] = {}
    for label in set(gse_table['label'].values):
        gse_dict[gse][str(label)] = list(grouped_gse_table.get_group(label)['gsm'].values)

with open(f'./ETL/out/gse_groupings_{species}_v2.json', 'w') as fw:
    json.dump(gse_dict, fw)
