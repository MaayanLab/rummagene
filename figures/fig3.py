import os
import pathlib
import random
import pandas as pd
import numpy as np
from matplotlib import pyplot as plt
from maayanlab_bioinformatics.enrichment import enrich_crisp
from sklearn.metrics import roc_curve, auc
import plotly.graph_objects as go

from common import data_dir, maybe_tqdm

fig_dir = pathlib.Path('figures/fig3')
fig_dir.mkdir(parents=True, exist_ok=True)


os.makedirs('out', exist_ok=True)
colors = ['#E69F00', '#009E73', '#F0E442', '#0072B2', '#404040', '#D55E00', '#CC79A7', '#56B4E9', "#000000"]

def read_gmt(path):
    """
    Reads a GMT file into a dictionary of gene sets.

    Parameters:
    path (str): The path to the GMT file.

    Returns:
    dict: A dictionary containing gene sets, where the keys are gene set names and the values are lists of genes.
    """
    gene_sets = {}
    with open(path, 'r') as f:
        for line in f:
            fields = line.strip().split('\t')
            gene_sets[fields[0]] = fields[2:]
    return gene_sets

# Read in the benchmarking libraries
benchmarking_libs_kinase = {}
for lib in os.listdir(data_dir/'benchmarking_data_kinase'):
    benchmarking_libs_kinase[lib.split('.')[0]] = read_gmt(data_dir/f'benchmarking_data_kinase/{lib}')

benchmarking_libs_tf = {}
for lib in os.listdir(data_dir/'benchmarking_data_tf'):
    benchmarking_libs_tf[lib.split('.')[0]] = read_gmt(data_dir/f'benchmarking_data_tf/{lib}')

def getLibraryIter(libdict: dict):
    """
    Generator function that iterates over a library dictionary and yields the keys and values.

    Parameters:
    libdict (dict): The library dictionary to iterate over.

    Yields:
    tuple: A tuple containing the key and value from the dictionary.
    """
    for k,v in libdict.items():
        if type(v) == list:
            yield k, v
        else:
            yield k, list(v.keys())

def enrich(gene_list: list, lib_json: dict, name: str): 
    """
    Perform enrichment analysis on a gene list using a given library.

    Args:
        gene_list (list): List of genes to be analyzed.
        lib_json (dict): Dictionary representing the library containing gene sets.
        name (str): Name of the analysis.

    Returns:
        pandas.DataFrame: DataFrame containing the enrichment results with columns ['Gene_Set', 'Term', 'Rank', 'Pvalue'].
    """
    gene_list = [x.upper() for x in gene_list]
    all_terms = list(lib_json.keys())
    termranks = []
    enrich_res = enrich_crisp(gene_list, getLibraryIter(lib_json), 20000, False)
    enrich_res = [[r[0], r[1].pvalue] if r[1].pvalue else [r[0], 1] for r in enrich_res]
    sorted_res = sorted(enrich_res, key=lambda x: x[1])

    for i in range(len(sorted_res)): 
        termranks.append([name, sorted_res[i][0], i, sorted_res[i][1]])
    i = len(sorted_res)
    for t in set(all_terms).difference([x[1] for x in termranks]): 
        i+=1
        termranks.append([name, t, i, 1])
    return pd.DataFrame(termranks, columns=['Gene_Set', 'Term', 'Rank', 'Pvalue'])


def rank_vecs_kinase(consensus: dict):
    """
    Rank the vectors based on the consensus dictionary.

    Parameters:
    - consensus (dict): A dictionary containing the consensus data.

    Returns:
    - rank_vecs_consensus (dict): A dictionary containing the ranked vectors based on the consensus data.
    """
    rank_vecs_consensus = {}
    for name in maybe_tqdm(benchmarking_libs_kinase):  
        bench_lib = benchmarking_libs_kinase[name]
        results = []
        for term in maybe_tqdm(bench_lib):
            try:
                enrichment = enrich(bench_lib[term], consensus, f"{term}:consensus")
                if '_' in term:
                    kinase = term.split('_')[0]
                else:
                    kinase = term
                
                if '|' in kinase:
                    kinases = kinase.split('|')
                    for k in kinases:
                        ranked = enrichment[enrichment['Term'] == k]
                        if len(ranked) > 0:
                            results.append(ranked)
                elif '.' in kinase:
                    kinases = kinase.split('.')
                    for k in kinases:
                        ranked = enrichment[enrichment['Term'] == k]
                        if len(ranked) > 0:
                            results.append(ranked)
                else:
                    ranked = enrichment[enrichment['Term'] == kinase]
                    if len(ranked) > 0:
                        results.append(ranked)
            except Exception as e:
                print(e)
                print(f"Error with {term}")
        consensus_res_df = pd.concat(results, axis=0)
        consensus_res_df['ScaledRank'] = (consensus_res_df['Rank']) / len(consensus)
        rank_vecs_consensus[name] = list(consensus_res_df['ScaledRank'])

    rank_vecs_consensus['random'] = [random.random() for _ in range(len(consensus_res_df['ScaledRank']))]

    return rank_vecs_consensus

def rank_vecs_tf(consensus: dict):
    """
    Rank the vectors based on the consensus dictionary.

    Parameters:
    - consensus (dict): A dictionary containing the consensus data.

    Returns:
    - rank_vecs_consensus (dict): A dictionary containing the ranked vectors based on the consensus data.
    """
        
    rank_vecs_consensus = {}
    for name in maybe_tqdm(benchmarking_libs_tf):  
        bench_lib = benchmarking_libs_tf[name]
        results = []
        for term in maybe_tqdm(bench_lib):
            try:
                enrichment = enrich(bench_lib[term], consensus, f"{term}:consensus")
                if '_' in term:
                    tf = term.split('_')[0]
                else:
                    tf = term.split(' ')[0]
                ranked = enrichment[enrichment['Term'] == tf]
                if len(ranked) > 0:
                    results.append(ranked)
            except Exception as e:
                print(e)
                print(f"Error with {term}")
        consensus_res_df = pd.concat(results, axis=0)
        consensus_res_df['ScaledRank'] = (consensus_res_df['Rank']) / len(consensus)
        rank_vecs_consensus[name] = list(consensus_res_df['ScaledRank'])

    return rank_vecs_consensus


def create_roc_vals_kinase(consensus: dict):
    """
    Create ROC values for benchmarking.

    Args:
        consensus (dict): A dictionary containing the consensus data.

    Returns:
        dict: A dictionary containing the ROC values.
    """
    roc_vals = {}
    for name in maybe_tqdm(benchmarking_libs_kinase):  
        bench_lib = benchmarking_libs_kinase[name]
        results = []
        misses = []
        for term in maybe_tqdm(bench_lib):
            try:
                enrichment = enrich(bench_lib[term], consensus, f"{term}:consensus")
                if '_' in term:
                    kinase = term.split('_')[0]
                else:
                    kinase = term
                
                if '|' in kinase:
                    kinases = kinase.split('|')
                    for k in kinases:
                        ranked = enrichment[enrichment['Term'] == k]
                        if len(ranked) > 0:
                            results.append(ranked)
                        rankedmiss = enrichment[enrichment['Term'] != k]
                        if len(ranked) > 0:
                            misses.append(rankedmiss)

                elif '.' in kinase:
                    kinases = kinase.split('.')
                    for k in kinases:
                        ranked = enrichment[enrichment['Term'] == k]
                        if len(ranked) > 0:
                            results.append(ranked)
                        rankedmiss = enrichment[enrichment['Term'] != k]
                        if len(rankedmiss) > 0:
                            misses.append(rankedmiss)
                else:
                    ranked = enrichment[enrichment['Term'] == kinase]
                    if len(ranked) > 0:
                        results.append(ranked)
                    rankedmiss = enrichment[enrichment['Term'] != kinase]
                    if len(rankedmiss) > 0:
                            misses.append(rankedmiss)
            except Exception as e:
                print(e)
                print(f"Error with {term}")
        consensus_res_df = pd.concat(results, axis=0)
        consensus_res_df['ScaledRank'] = (consensus_res_df['Rank']) / len(consensus)
        consensus_res_df_miss = pd.concat(misses, axis=0)
        consensus_res_df_miss['ScaledRank'] = (consensus_res_df_miss['Rank']) / len(consensus)
        roc_vals[name] = {}
        roc_vals[name]['tp'] = list(consensus_res_df['ScaledRank'])
        roc_vals[name]['fp'] = list(consensus_res_df_miss['ScaledRank'])

    return roc_vals


def sig_vecs_kinase(consensus: dict) -> dict:
    """
    Generate ranked vectors for each benchmarking library based on the consensus data.

    Args:
        consensus (dict): A dictionary containing the consensus data.

    Returns:
        dict: A dictionary containing the ranked vectors for each benchmarking library.
    """
        
    rank_vecs_consensus = {}
    for name in maybe_tqdm(benchmarking_libs_kinase):  
        bench_lib = benchmarking_libs_kinase[name]
        results = []
        for term in maybe_tqdm(bench_lib):
            enrichment = enrich(bench_lib[term], consensus, f"{term}:consensus")
            if '_' in term:
                kinase = term.split('_')[0]
            else:
                kinase = term
            
            if '|' in kinase:
                kinases = kinase.split('|')
                for k in kinases:
                    ranked = enrichment[enrichment['Term'] == k]
                    if len(ranked) > 0:
                        results.append(ranked)
            elif '.' in kinase:
                kinases = kinase.split('.')
                for k in kinases:
                    ranked = enrichment[enrichment['Term'] == k]
                    if len(ranked) > 0:
                        results.append(ranked)
            else:
                ranked = enrichment[enrichment['Term'] == kinase]
                if len(ranked) > 0:
                    results.append(ranked)

        consensus_res_df = pd.concat(results, axis=0)
        consensus_res_df['ScaledRank'] = (consensus_res_df['Rank']) / len(consensus)
        rank_vecs_consensus[name] = list(consensus_res_df['Pvalue'])

    rank_vecs_consensus['random'] = [random.random() for _ in range(len(consensus_res_df['ScaledRank']))]
    return rank_vecs_consensus

def sig_vecs_tf(consensus: dict) -> dict:
    """
    Generate ranked vectors for each benchmarking library based on the consensus data.

    Args:
        consensus (dict): A dictionary containing the consensus data.

    Returns:
        dict: A dictionary containing the ranked vectors for each benchmarking library.
    """
    rank_vecs_consensus = {}
    for name in maybe_tqdm(benchmarking_libs_tf):  
        bench_lib = benchmarking_libs_tf[name]
        results = []
        for term in maybe_tqdm(bench_lib):
            try:
                enrichment = enrich(bench_lib[term], consensus, f"{term}:consensus")
                if '_' in term:
                    tf = term.split('_')[0]
                else:
                    tf = term.split(' ')[0]
                ranked = enrichment[enrichment['Term'] == tf]
                if len(ranked) > 0:
                    results.append(ranked)
            except Exception as e:
                print(e)
                print(f"Error with {term}")
        consensus_res_df = pd.concat(results, axis=0)
        consensus_res_df['ScaledRank'] = (consensus_res_df['Rank']) / len(consensus)
        rank_vecs_consensus[name] = list(consensus_res_df['Pvalue'])

    rank_vecs_consensus['random'] = [random.random() for _ in range(len(consensus_res_df['Pvalue']))]

    return rank_vecs_consensus

def create_roc_vals_tf(consensus: dict) -> dict:
    """
    Create ROC values for benchmarking.

    Args:
        consensus (dict): A dictionary containing the consensus data.

    Returns:
        dict: A dictionary containing the ROC values.
    """

    roc_vals = {}
    for name in maybe_tqdm(benchmarking_libs_tf):  
        bench_lib = benchmarking_libs_tf[name]
        results = []
        misses = []
        for term in maybe_tqdm(bench_lib):
            try:
                enrichment = enrich(bench_lib[term], consensus, f"{term}:consensus")
                if '_' in term:
                    tf = term.split('_')[0]
                else:
                    tf = term.split(' ')[0]
                ranked = enrichment[enrichment['Term'] == tf]
                if len(ranked) > 0:
                    results.append(ranked)
                rankedMisses = enrichment[enrichment['Term'] != tf]
                if len(rankedMisses) > 0:
                    misses.append(rankedMisses)
            except Exception as e:
                print(e)
                print(f"Error with {term}")
        consensus_res_df = pd.concat(results, axis=0)
        consensus_res_df['ScaledRank'] = (consensus_res_df['Rank']) / len(consensus)
        consensus_res_df_misses = pd.concat(misses, axis=0)
        consensus_res_df_misses['ScaledRank'] = (consensus_res_df_misses['Rank']) / len(consensus)
        roc_vals[name] = {}
        roc_vals[name]['tp'] = list(consensus_res_df['ScaledRank'])
        roc_vals[name]['fp'] = list(consensus_res_df_misses['ScaledRank'])

    return roc_vals


def bootstrap_roc_curve(ones: list, zeros: list, n: int):
    """
    Calculate the mean area under the ROC curve (AUC) and the mean true positive rate (TPR)
    using bootstrap resampling.

    Parameters:
    ones (array-like): The positive class labels.
    zeros (array-like): The negative class labels.
    n (int): The number of bootstrap iterations.

    Returns:
    dict: A dictionary containing the mean AUC and the mean TPR.

    """
    base_fpr = np.linspace(0, 1, 50)
    size_group1 = len(ones)
    sum_auc = 0
    tprs = []
    for i in range(n):
        zeros_sampled = np.random.choice(zeros, size=size_group1, replace=True)
        fpr, tpr, _ = roc_curve(np.concatenate([np.ones_like(ones), np.zeros_like(zeros_sampled)]),
                                np.concatenate([ones, zeros_sampled]), drop_intermediate=False)
        roc_auc = auc(fpr, tpr)
        sum_auc += roc_auc
        tpr = np.interp(base_fpr, fpr, tpr)
        tpr[0] = 0.0
        tprs.append(list(tpr))

    auc_mean = sum_auc / n

    tpr_mean = np.mean(np.array(tprs), axis=0)
    return {'auc': auc_mean, 'approx': tpr_mean}


def plot_roc_curve(roc_vals: dict, name: str, n_bootstrap=5000):
    """
    Plots the ROC curve for the given ROC values.

    Parameters:
    roc_vals (dict): Dictionary containing the ROC values for different libraries.
    name (str): name of output figure
    n_bootstrap (int): Number of bootstrap iterations for calculating confidence intervals. Default is 5000.

    Returns:
    None
    """

    base_fpr = np.linspace(0, 1, 50)

    lib_curves = {}
    for lib in maybe_tqdm(roc_vals):
        bootstrapped_res = bootstrap_roc_curve(1 - np.array(roc_vals[lib]['tp']), 1 - np.array(roc_vals[lib]['fp']), n_bootstrap)
        print(lib, bootstrapped_res['auc'])
        lib_curves[lib] =bootstrapped_res

    # Plotting
    fig = plt.figure(figsize=(8, 6))
    for i, lib in enumerate(list(lib_curves)):
        plt.plot(base_fpr, lib_curves[lib]['approx'], label=f"{lib} AUC: {np.round(lib_curves[lib]['auc'], 3)}", color=colors[i])

    plt.plot([0, 1], [0, 1], color='black', linestyle='--')
    plt.xlabel('False Positive Rate')
    plt.ylabel('True Positive Rate')
    plt.legend()
    plt.savefig(fig_dir/f'{name}.png', dpi=300)

def make_boxplot(ranked_vectors: dict, name: str, ylabel='Scaled Rank'):
    """
    Create a boxplot from ranked vectors.

    Parameters:
    ranked_vectors (dict): A dictionary containing ranked vectors.
    name (str): The name of the boxplot.
    ylabel (str, optional): The label for the y-axis. Defaults to 'Scaled Rank'.

    Returns:
    None
    """
    bxplt_vecs = []
    for i, gs in enumerate(ranked_vectors):
        bxplt_vecs.append((gs, np.mean(ranked_vectors[gs]), colors[i]))

    fig = go.Figure()
    bxplt_vecs_sorted = list(sorted(bxplt_vecs, key=lambda x: x[1]))
    for (gs, _, color) in bxplt_vecs_sorted:
        fig.add_trace(
            go.Box(
                y=ranked_vectors[gs],
                name=gs.split('_')[0].replace('single', 'GEO'),
                fillcolor=color,
                line=dict(color='black')
            )
        )
    if ylabel == 'P-value':
        fig.add_hline(y=.05, line_width=1, line_dash="dash", line_color="black")
    fig.update_layout(yaxis_title=ylabel, plot_bgcolor='white', yaxis_gridcolor='gray')
    fig.show()
    fig.write_image(fig_dir/f'{name}.png')



if __name__ == "__main__":

    kinase_gmt = read_gmt(data_dir/'consensus_kinase_clean.gmt')
    kinase_sig_vecs = sig_vecs_kinase(kinase_gmt)
    make_boxplot(kinase_sig_vecs, '3f', ylabel='P-value')
    kinase_rank_vecs = rank_vecs_kinase(kinase_gmt)
    make_boxplot(kinase_rank_vecs, '3e', ylabel='Scaled Rank')
    kinase_roc_vals = create_roc_vals_kinase(kinase_gmt)
    plot_roc_curve(kinase_roc_vals, '3d')

    tf_gmt = read_gmt(data_dir/'consensus_tf_clean.gmt')
    tf_sig_vecs = sig_vecs_tf(tf_gmt)
    make_boxplot(tf_sig_vecs, '3c', ylabel='P-value')
    tf_scaled_rank_vecs = rank_vecs_tf(tf_gmt)
    make_boxplot(tf_scaled_rank_vecs, '3b', ylabel='Scaled Rank')
    tf_roc_vals = create_roc_vals_tf(tf_gmt)
    plot_roc_curve(tf_roc_vals, '3a')
    
    

