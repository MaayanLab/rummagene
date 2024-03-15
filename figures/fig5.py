
import os
import pandas as pd
from common import data_dir, add_p_value_annotation
import plotly.graph_objects as go
import numpy as np

sigs_df = pd.read_csv(data_dir/'sigs_df_annotated.tsv', sep='\t', index_col=0, compression='gzip')

fig = go.Figure()
vecs= [('all pairs',sigs_df['most_cited_genes_percent'].values), ('top 10,000',sigs_df['most_cited_genes_percent'].values[:10000]), ('top 1000',sigs_df['most_cited_genes_percent'].values[:1000]), ('top 100',sigs_df['most_cited_genes_percent'].values[:100])]

fig.add_traces(
    go.Box(
        mean=[np.mean(vec) for _, vec in vecs],
        upperfence=[np.max(vec) for _, vec in vecs],
        sd =[np.std(vec) for _, vec in vecs],
        lowerfence=[np.min(vec) for _, vec in vecs],
        median=[np.quantile(vec, .5) for _, vec in vecs],
        q1=[np.quantile(vec, .25) for _, vec in vecs],
        q3=[np.quantile(vec, .75) for _, vec in vecs],
        x=[name for name, _ in vecs],
        line=dict(color='black'),
        boxpoints=False,
    )
)
fig.update_layout(yaxis_title="top 500 cited genes", plot_bgcolor='white', yaxis_gridcolor='gray')

fig = add_p_value_annotation(fig, [[0, 1], [0, 2], [0, 3]])

os.makedirs('figures/fig5', exist_ok=True)
fig.save('figures/fig5/5a.png')



fig = go.Figure()
vecs= [('all pairs',sigs_df['most_expr_genes'].values), ('top 10,000',sigs_df['most_expr_genes'].values[:10000]), ('top 1000',sigs_df['most_expr_genes'].values[:1000]), ('top 100',sigs_df['most_expr_genes'].values[:100])]
for name, vec in vecs:
    fig.add_trace(
        go.Box(
        mean=[np.mean(vec) for _, vec in vecs],
        upperfence=[np.max(vec) for _, vec in vecs],
        sd =[np.std(vec) for _, vec in vecs],
        lowerfence=[np.min(vec) for _, vec in vecs],
        median=[np.quantile(vec, .5) for _, vec in vecs],
        q1=[np.quantile(vec, .25) for _, vec in vecs],
        q3=[np.quantile(vec, .75) for _, vec in vecs],
        x=[name for name, _ in vecs],
        line=dict(color='black'),
        boxpoints=False,
        )
    )
fig.update_layout(
    yaxis_title="top 500 most expressed genes", 
    plot_bgcolor='white', 
    yaxis_gridcolor='gray', 
    width=1000, height=800)

fig = add_p_value_annotation(fig, [[0, 1], [0, 2], [0, 3]])

fig.save('figures/fig5/5b.png')

fig = go.Figure()
vecs= [('all pairs',sigs_df['most_cited_genes_percent'].values), ('top 10,000',sigs_df['most_cited_genes_percent'].values[:10000]), ('top 1000',sigs_df['most_cited_genes_percent'].values[:1000]), ('top 100',sigs_df['most_cited_genes_percent'].values[:100])]

fig.add_traces(
    go.Box(
        mean=[np.mean(vec) for _, vec in vecs],
        upperfence=[np.max(vec) for _, vec in vecs],
        sd =[np.std(vec) for _, vec in vecs],
        lowerfence=[np.min(vec) for _, vec in vecs],
        median=[np.quantile(vec, .5) for _, vec in vecs],
        q1=[np.quantile(vec, .25) for _, vec in vecs],
        q3=[np.quantile(vec, .75) for _, vec in vecs],
        x=[name for name, _ in vecs],
        line=dict(color='black'),
        boxpoints=False,
    )
)
fig.update_layout(yaxis_title="top 500 cited genes", plot_bgcolor='white', yaxis_gridcolor='gray')

fig = add_p_value_annotation(fig, [[0, 1], [0, 2], [0, 3]])

fig.save('figures/fig5/5c.png')