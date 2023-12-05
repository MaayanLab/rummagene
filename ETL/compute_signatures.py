# %%
import pandas as pd
import h5py as h5
import json
import numpy as np
from tqdm import tqdm
import matplotlib.pyplot as plt
import rpy2
from maayanlab_bioinformatics.dge import limma_voom_differential_expression
import os
import re
from tqdm import tqdm
import sys
import contextlib

pd.options.mode.chained_assignment = None
import nltk
from nltk.corpus import stopwords
nltk.download('stopwords')
words_to_remove = ['experiement', 'tissue:', 'type:', 'batch:', 'treatment:', 'experiment', 'patient', 'batch', '1', '2', '3', '4', '5', '6', '7', '8', '9']
stopwords_plus = set(stopwords.words('english') + (words_to_remove))

@contextlib.contextmanager
def suppress_output(stdout=True, stderr=True, dest='/dev/null'):
    ''' Usage:
    with suppress_output():
        print('hi')
    '''
    dev_null = open(dest, 'a')
    if stdout:
        _stdout = sys.stdout
        sys.stdout = dev_null
    if stderr:
        _stderr = sys.stderr
        sys.stderr = dev_null
    try:
        yield
    finally:
        if stdout:
            sys.stdout = _stdout
        if stderr:
            sys.stderr = _stderr

# %%
species = "human"
version = "2.2"
gsm4sig_version = 2
single_cell_prob_thresh = 0.5
print('reading h5')
f = h5.File(species+"_gene_v"+version+".h5", "r")
gse_scprob = np.array([
    f["meta"]["samples"]["series_id"], 
    f["meta"]["samples"]["geo_accession"],
    f["meta"]["samples"]["singlecellprobability"],
    f["meta"]["samples"]["title"],
    f["meta"]["samples"]["characteristics_ch1"],
    f["meta"]["samples"]["source_name_ch1"],
]).T

expression = f['data/expression']
genes = [x.decode('UTF-8') for x in f['meta/genes/symbol']]
samples = [x.decode('UTF-8') for x in f['meta/samples/geo_accession']] #GSMs

# %%
samps_df = pd.DataFrame(gse_scprob, columns =['gse', 'gsm', 'scprob', 'title','characteristics_ch1', 'source_name_ch1'])
samps_df = samps_df[samps_df['scprob'] < .5]
samps_df['gse'] = samps_df['gse'].apply(lambda s: s.decode("utf-8"))
samps_df['gsm'] = samps_df['gsm'].apply(lambda s: s.decode("utf-8"))
samps_df['title'] = samps_df['title'].apply(lambda s: s.decode("utf-8"))
samps_df['characteristics_ch1'] = samps_df['characteristics_ch1'].apply(lambda s: s.decode("utf-8"))
samps_df['source_name_ch1'] = samps_df['source_name_ch1'].apply(lambda s: s.decode("utf-8"))
samps_df

print('done reading h5')

# %%
pattern = r'[-,_.:]'

def compute_sigs(expr_df, groupings, species, gse):
    # Compute label of condition from common terms across samples
    gse_table = samps_df[samps_df['gse'] == gse]
    gse_table['combined'] = gse_table['title'] + ' _ ' +  gse_table['characteristics_ch1'] + ' _ ' +  gse_table['source_name_ch1']

    og_labels = {}

    labled_groupings = {}
    for label in groupings:
        samps = groupings[label]
        data = list(map(lambda s: s.lower(), gse_table[gse_table['gsm'].isin(samps)]['combined'].values))
        data_clean = []
        for d in data:
            data_clean.append(set(filter(lambda w: w not in stopwords_plus, re.sub(pattern, ' ', d).split())))
        condition = set(data_clean[0])
        for s in data_clean[1:]:
            condition.intersection_update(s)
        condition = ' '.join(list(condition))
        labled_groupings[condition] = samps
        og_labels[condition] = label


    ctrl_conditions = []
    conditions = list(labled_groupings.keys())
    # identify control conditions or use first condition as default
    ctrl_keywords = set(['wt', 'wildtype', 'control', 'cntrl', 'ctrl', 'uninfected', 'normal', 'untreated', 'unstimulated', 'shctrl', 'ctl', 'healthy', 'sictrl', 'sicontrol', 'ctr', 'wild'])
    for condition in labled_groupings:
        split_conditions = condition.lower().split()
        if len(set(split_conditions).intersection(ctrl_keywords)) > 0:
            ctrl_conditions.append(condition)

    # put any control conditions in the front of list so they are compared first agaisnt all other conditions
    if len(ctrl_conditions) > 0:
        for ctrl_c in ctrl_conditions:
            conditions.insert(0, conditions.pop(conditions.index(ctrl_c)))

    seen = []
    for condition in conditions:
        for condition2 in conditions:
            if condition != condition2 and {og_labels[condition], og_labels[condition2]} not in seen:
                seen.append({og_labels[condition], og_labels[condition2]})

                sig_name = f"{gse}-{og_labels[condition]}-vs-{og_labels[condition2]}-{species}"

                if not os.path.exists(f'datanew/{species.lower()}/{sig_name}.tsv.gz'):
                    try:
                        with suppress_output():
                            dge = limma_voom_differential_expression(
                                expr_df[labled_groupings[condition]], expr_df[labled_groupings[condition2]],
                                voom_design=True,
                            )
                        if not dge.empty:
                            dge['logFC'] = dge['logFC'].round(2)
                            dge['AveExpr'] = dge['AveExpr'].round(2)
                            dge['t'] = dge['t'].round(2)
                            dge['B'] = dge['B'].round(2)
                            dge.to_csv(f'datanew/{species.lower()}/{sig_name}.tsv.gz', sep='\t', compression='gzip')
                        else:
                            print('Empty dge returned for', sig_name)
                    except Exception as e:
                        print(e)
                        print('Error computing:', sig_name)


# %%
with open(f'gse_groupings_{species}.json') as fr:
    gse_groupings = json.load(fr)

# %%
gses = list(gse_groupings.keys())

for gse in tqdm(gses):
    study_gsms_lists = list(gse_groupings[gse].values())
    study_gsms = []
    [study_gsms.extend(el) for el in study_gsms_lists] 
    samples_idx = sorted([(i, x) for i, x in enumerate(samples) if x in study_gsms])
    ordered_gsms = list(map(lambda t: t[1], samples_idx))
    ordered_idx = list(map(lambda t: t[0], samples_idx))
    try:
        expression_data = f['data/expression'][:, ordered_idx]  
        expr_df = pd.DataFrame(data=expression_data, index=genes, columns=ordered_gsms, dtype=int).dropna()
        groupings = gse_groupings[gse]
        compute_sigs(expr_df, gse_groupings[gse], species, gse)
    except:
        print("error extracting counts from ARCHS4")


