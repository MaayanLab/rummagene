import json
import h5py as h5
import numpy as np
import pandas as pd
import os
from tqdm import tqdm

import nltk
from nltk.corpus import stopwords
nltk.download('stopwords')

import re

def remove_words(text, words_to_remove):
    # Create a regular expression pattern using the words to remove
    remove = '|'.join(words_to_remove)
    pattern = re.compile(r'\b('+remove+r')\b', flags=re.IGNORECASE)
    
    # Use sub() method to replace matched words with an empty string
    result = pattern.sub('', text)
    
    return result

def remove_extra_spaces(input_string):
    # Replace multiple spaces with a single space
    result = re.sub(r'\s+', ' ', input_string)
    
    # Remove leading and trailing spaces
    result = result.strip()
    
    return result

def remove_duplicate_words(input_string):
    # Use a regular expression to find duplicated words and keep only the first occurrence
    return ' '.join(dict.fromkeys(input_string.split()))

def clean_str(input_string, words_to_remove):
    return remove_duplicate_words(remove_extra_spaces(remove_words(input_string, words_to_remove)))

def common_words_across_strings(string_list):
    # Split the first string into a list of words
    first_words = string_list[0].split()

    # Create a set to keep track of word order
    word_set = set(first_words)
    ordered_common_words = []

    # Iterate through the words in the first string and check if they appear in all strings
    for word in first_words:
        if word in word_set and all(word in s.split() for s in string_list[1:]):
            ordered_common_words.append(word)
            word_set.remove(word)  # Remove the word to maintain order

    # Join the common words into a single string
    result = ' '.join(ordered_common_words)

    return result

words_to_remove = ['experiement', 'experiment', 'patient', 'batch', 'tissue', 'cell type', 'cel type:', 'treatment', 'genotype', 'time point', 'animal', 'datatype']


stopwords_plus = list(set(stopwords.words('english') + (words_to_remove)))
species = "mouse"
base_path="/Users/giacomomarino/"

if not os.path.exists(f'gse_gsm_meta_{species}.csv'):
    version = "2.2"
    gsm4sig_version = 2
    single_cell_prob_thresh = 0.5
    print('reading h5')
    f = h5.File(base_path+species+"_gene_v"+version+".h5", "r")
    gse_scprob = np.array([
        f["meta"]["samples"]["series_id"], 
        f["meta"]["samples"]["geo_accession"],
        f["meta"]["samples"]["singlecellprobability"],
        f["meta"]["samples"]["title"],
        f["meta"]["samples"]["characteristics_ch1"],
        f["meta"]["samples"]["source_name_ch1"],
    ]).T


    samps_df = pd.DataFrame(gse_scprob, columns =['gse', 'gsm', 'scprob', 'title','characteristics_ch1', 'source_name_ch1'])
    samps_df = samps_df[samps_df['scprob'] < .5]
    samps_df['gse'] = samps_df['gse'].apply(lambda s: s.decode("utf-8"))
    samps_df['gsm'] = samps_df['gsm'].apply(lambda s: s.decode("utf-8"))
    samps_df['title'] = samps_df['title'].apply(lambda s: s.decode("utf-8"))
    samps_df['characteristics_ch1'] = samps_df['characteristics_ch1'].apply(lambda s: s.decode("utf-8"))
    samps_df['source_name_ch1'] = samps_df['source_name_ch1'].apply(lambda s: s.decode("utf-8"))
    samps_df.to_csv(f'gse_gsm_meta_{species}.csv')
else:
    samps_df = pd.read_csv(f'gse_gsm_meta_{species}.csv', index_col=0)

with open('gse_groupings_mouse.json') as f:
    gse_groupings = json.load(f)

gse_processed_meta = {}
for gse in tqdm(list(gse_groupings)):
    gse_table = samps_df[samps_df['gse'] == gse]
    meta_names = gse_table['title'] + ' ' +  gse_table['characteristics_ch1'] + ' ' +  gse_table['source_name_ch1']
    data = list(map(lambda s: ' '.join(re.split(r',|-|:|;|_', str(s).lower())), meta_names.values))
    data_clean = []
    for d in data:
        data_clean.append(clean_str(d, stopwords_plus))
    gsm_title_dict = {}

    for i, d in enumerate(data_clean):
        gsm_title_dict[gse_table['gsm'].values[i]] = d

    gse_processed_meta[gse] = {'titles': {}}

    for cond in gse_groupings[gse]:
        gsms = gse_groupings[gse][cond]
        gsm_strs = [gsm_title_dict[gsm] for gsm in gsms]
        gse_processed_meta[gse]['titles'][cond] = common_words_across_strings(gsm_strs)
    gse_processed_meta[gse]['samples'] = gse_groupings[gse]


with open(f'gse_processed_meta_{species}.json', 'w') as f:
    json.dump(gse_processed_meta, f)

    
