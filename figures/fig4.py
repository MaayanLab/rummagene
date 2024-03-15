# %%
import re
import pathlib
from pprint import pprint
import os

from pathlib import Path
import pandas as pd
import numpy as np
from matplotlib import pyplot as plt

from sklearn.feature_extraction.text import CountVectorizer, TfidfTransformer

import pyLDAvis
import pyLDAvis.gensim

import gensim
import gensim.corpora as corpora

from maayanlab_bioinformatics.harmonization import ncbi_genes_lookup
from sklearn.manifold import TSNE
from bokeh.plotting import figure

import nltk
from nltk.tokenize import word_tokenize
from nltk.corpus import stopwords
from nltk.corpus import wordnet
nltk.download('wordnet')
from nltk.stem import WordNetLemmatizer

lookup = ncbi_genes_lookup()

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
  
def extract_terms(path):
  with pathlib.Path(path).open('r') as fr:
    return [line.strip().split('\t')[0] for line in fr]

# %%
terms = extract_terms(data_dir/'table-mining-clean.gmt')
len(terms)

# %%
df = pd.DataFrame(data=[terms], index=['terms']).T
df['pmc'] = df['terms'].apply(lambda t: t.split('-')[0])
print('GMT contains gene sets from', len(set(df['pmc'])), 'articles')

# %%
papers_value_counts = df['pmc'].value_counts()
relevant_papers = papers_value_counts[papers_value_counts < 200].index

# %%
df_filtered = df[df['pmc'].isin(relevant_papers)]
df_filtered.shape

# %%
def fetch_oa_file_list(data_dir = Path()):
  ''' Fetch the PMCID, PMID, oa_file listing; we sort it newest first.
  ['File'] has the oa_package which is a relative path to a tar.gz archive containing
   the paper and all figures.
  '''
  oa_file_list = data_dir / 'oa_file_list.csv'
  if not oa_file_list.exists():
    df = pd.read_csv('https://ftp.ncbi.nlm.nih.gov/pub/pmc/oa_file_list.csv')
    ts_col = df.columns[-3]
    df[ts_col] = pd.to_datetime(df[ts_col])
    df.sort_values(ts_col, ascending=False, inplace=True)
    df.to_csv(oa_file_list, index=None)
  else:
    df = pd.read_csv(oa_file_list)
  return df

oa_file_list = fetch_oa_file_list()
X_embed_more = pd.merge(left=df_filtered, left_on='pmc', right=oa_file_list, right_on='Accession ID')

# %%
df_pmcids = pd.read_csv('https://ftp.ncbi.nlm.nih.gov/pub/pmc/PMC-ids.csv.gz')
X_embed_more = pd.merge(left=X_embed_more, left_on='pmc', right=df_pmcids, right_on='PMCID')

# %%
data = []
with open(data_dir/'doi-info.tsv') as f:
    lines = f.readlines()
    for l in lines:
        l_data = []
        l_data.append(l.split('\t')[0])
        l_data.append(l.split('\t')[1].strip())
        l_data.append(l.split('\t')[2].strip().replace('\n', ''))
        data.append(l_data)

doi_abs_titles = pd.DataFrame(data=data[1:], columns=data[0])
os.makedirs('out', exist_ok=True)
doi_abs_titles.to_csv('out/doi_info.csv')

# %%
doi_abs_titles['description'] = doi_abs_titles['title'] + doi_abs_titles['abstract']
abstracts_raw = doi_abs_titles[['DOI', 'description']].dropna()['description']

# %%
abstracts = abstracts_raw.fillna('')
abstracts = abstracts.apply(lambda abstract: word_tokenize(re.sub("[^A-Za-z']+", ' ', abstract)))

# %%
stopwords_en = set(stopwords.words('english'))
abstracts = abstracts.apply(lambda abstract: [w for w in abstract if w.lower() not in stopwords_en and len(w) > 2])
lemmatizer = WordNetLemmatizer()
abstracts = abstracts.apply(lambda abstract: [lemmatizer.lemmatize(w) for w in abstract])

# %%
count_vectorizer = CountVectorizer()
counts = count_vectorizer.fit_transform(abstracts_raw.fillna(''))
tfidf_vectorizer = TfidfTransformer().fit(counts)
tfidf_abstracts = tfidf_vectorizer.transform(counts)
tfidf_abstracts.shape

# %%
def run_affinity_prop():
    from sklearn.cluster import AffinityPropagation
    X = tfidf_abstracts
    clustering = AffinityPropagation().fit(X)
    clustering
    abstract_affinity_clusters = list(clustering.labels_)
    num_topics = len(set(abstract_affinity_clusters))
    print('Predicted Number of Topics:', num_topics)

# %%
dictionary = corpora.Dictionary(abstracts.values)
texts = abstracts_raw
corpus = [dictionary.doc2bow(abstract) for abstract in list(abstracts.values)]

# %%
doi_abs_titles

# %%
abstracts

# %%
lda_model = gensim.models.ldamodel.LdaModel(corpus=corpus,
                                           id2word=dictionary,
                                           num_topics=10, 
                                           random_state=100,
                                           update_every=1,
                                           chunksize=100,
                                           passes=10,
                                           alpha='auto',
                                           per_word_topics=True)

# %%
pprint(lda_model.print_topics())
doc_lda = lda_model[corpus]

# %%
paper_topics = lda_model.get_document_topics(corpus)


# %%
def format_topics_sentences(ldamodel=None, corpus=corpus, texts=data):

    sent_topics = []

    # Get main topic in each document
    for i, row_list in enumerate(ldamodel[corpus]):
        row = row_list[0] if ldamodel.per_word_topics else row_list            

        row = sorted(row, key=lambda x: (x[1]), reverse=True)
        # Get the Dominant topic, Perc Contribution and Keywords for each document
        for j, (topic_num, prop_topic) in enumerate(row):
            if j == 0:  # => dominant topic
                wp = ldamodel.show_topic(topic_num)
                topic_keywords = ", ".join([word for word, prop in wp])
                sent_topics.append([int(topic_num), round(prop_topic,4), topic_keywords])
            else:
                break
    sent_topics_df = pd.DataFrame(data=sent_topics, columns=['Topic', 'Topic % Contribution', 'Keywords'])

    contents = pd.Series(texts)
    sent_topics_df = pd.concat([sent_topics_df, contents], axis=1)
    return(sent_topics_df)

df_topic_sents_keywords = format_topics_sentences(ldamodel=lda_model, corpus=corpus, texts=abstracts)

# Format
df_dominant_topic = df_topic_sents_keywords.reset_index()
df_dominant_topic.columns = ['Document_No', 'Dominant_Topic', 'Topic_Perc_Contrib', 'Keywords', 'Text']
df_dominant_topic.head(10)

# %%
doc_lens = [len(d) for d in df_dominant_topic.Text]

# %%
# 1. Wordcloud of Top N words in each topic
import matplotlib.colors as mcolors

cols = [color for name, color in mcolors.TABLEAU_COLORS.items()]  # more colors: 'mcolors.XKCD_COLORS'

# %%
from collections import Counter
topics = lda_model.show_topics(formatted=False)
data_flat = [w for w_list in abstracts for w in w_list]
counter = Counter(data_flat)

out = []
for i, topic in topics:
    for word, weight in topic:
        out.append([word, i , weight, counter[word]])

df = pd.DataFrame(out, columns=['word', 'topic_id', 'importance', 'word_count'])    

df['log_word_count'] = df['word_count'].apply(lambda x: x/100000)
df = df.drop(columns='word_count')

# Plot Word Count and Weights of Topic Keywords
fig, axes = plt.subplots(5, 2, figsize=(16,14), sharey=True, dpi=160)
cols = [color for name, color in mcolors.TABLEAU_COLORS.items()]
for i, ax in enumerate(axes.flatten()):
    ax.bar(x='word', height="log_word_count", data=df.loc[df.topic_id==i, :], color=cols[i], width=0.5, alpha=0.3, label='Word Count')
    ax_twin = ax.twinx()
    ax_twin.bar(x='word', height="importance", data=df.loc[df.topic_id==i, :], color=cols[i], width=0.2, label='Weights')
    ax.set_ylabel('Word Count / 10^3', color=cols[i])
    #ax_twin.set_ylim(0, 0.8);
    ax.set_title('Topic: ' + str(i + 1), color=cols[i], fontsize=16)
    ax.tick_params(axis='y', left=False)
    ax.set_xticklabels(df.loc[df.topic_id==i, 'word'], rotation=30, horizontalalignment= 'right')
    ax.legend(loc='upper center'); ax_twin.legend(loc='upper right')

fig.tight_layout(w_pad=2)    
fig.suptitle('Word Count and Importance of Topic Keywords', fontsize=22, y=1.05)    
os.makedirs('figures/fig4', exist_ok=True)
plt.savefig('figures/4a.png')

# %%
# Get topic weights and dominant topics ------------


# Get topic weights
topic_weights = []
for i, row_list in enumerate(lda_model[corpus]):
    topic_weights.append([w for i, w in row_list])

# Array of topic weights    
arr = pd.DataFrame(topic_weights).fillna(0).values

# Keep the well separated points (optional)
arr = arr[np.amax(arr, axis=1) > 0.35]

# Dominant topic number in each doc
topic_num = np.argmax(arr, axis=1)

# tSNE Dimension Reduction
tsne_model = TSNE(n_components=2, verbose=1, random_state=0, angle=.99, init='pca')
tsne_lda = tsne_model.fit_transform(arr)

# Plot the Topic Clusters using Bokeh
n_topics = 10

new_colors = np.array(['#75b8e7', '#ffa85c', '#54d654', '#fc5d5e', '#c792f7','#9e7972', '#f7b2e2', '#bdbdbd', '#feff52','#52efff'])
mycolors = np.array([color for name, color in mcolors.TABLEAU_COLORS.items()])
plot = figure( plot_width=900, plot_height=700)
plot.scatter(x=tsne_lda[:,0], y=tsne_lda[:,1], color=new_colors[topic_num])
plot.savefig('figures/fig4/4b.png')


