# %%
# Scatterplot
from sklearn.feature_extraction.text import TfidfVectorizer
import pandas as pd
import scanpy as sc
import anndata
import pathlib
from collections import OrderedDict
from common import data_dir

# %%
# Bokeh
from bokeh.io import export_svg
from bokeh.plotting import figure, show
from bokeh.models import HoverTool, ColumnDataSource
from bokeh.palettes import Category20

#%%
fig_dir = pathlib.Path('figures')/'fig2'
fig_dir.mkdir(parents=True, exist_ok=True)

# %%
def get_scatter_library(libname):
    with open(data_dir/f"{libname}.gmt", 'r') as f:
        lines = f.readlines()

    ### variables to store gene set data
    lib_dict = OrderedDict()

    for line in lines:
        tokens = line.split("\t\t")
        term = tokens[0]
        genes = [x.split(',')[0].strip() for x in tokens[1].split('\t')]
        lib_dict[term] = ' '.join(genes)
    
    return lib_dict

# %%
def process_scatterplot(libdict, nneighbors=30, mindist=0.1, spread=1.0, maxdf=1.0, mindf=1):
    print("\tTF-IDF vectorizing gene set data...")
    vec = TfidfVectorizer(max_df=maxdf, min_df=mindf)
    X = vec.fit_transform(libdict.values())
    print(X.shape)
    adata = anndata.AnnData(X)
    adata.obs.index = libdict.keys()

    print("\tPerforming Leiden clustering...")
    ### the n_neighbors and min_dist parameters can be altered
    sc.pp.neighbors(adata, n_neighbors=nneighbors, use_rep='X')
    sc.tl.umap(adata, min_dist=mindist, spread=spread, random_state=42)
    sc.tl.leiden(adata, resolution=1.0)

    new_order = adata.obs.sort_values(by='leiden').index.tolist()
    adata = adata[new_order, :]
    adata.obs['leiden'] = 'Cluster ' + adata.obs['leiden'].astype('object')

    df = pd.DataFrame(adata.obsm['X_umap'])
    df.columns = ['x', 'y']

    df['cluster'] = adata.obs['leiden'].values
    df['term'] = adata.obs.index
    df['genes'] = [libdict[l] for l in df['term']]

    return df

# %%
def get_scatter_colors(df, color_by='cluster', limit=None):
    clusters = pd.unique(df[color_by]).tolist()
    if limit:
        clusters.remove('Other')
    colors = list(Category20[20])[::2] + list(Category20[20])[1::2]
    # make colorblind friendly
    colors[1] = '#E69F00'
    colors[2] = '#009E73'
    colors[3] = '#D55E00'
    color_mapper = {clusters[i]: colors[i % 20] for i in range(len(clusters))}
    if limit: 
        color_mapper['Other'] = '#ededed'
    return color_mapper

def get_scatterplot(scatterdf, color_by='cluster', limit=None, hide_legend=False):
    df = scatterdf.copy()
    if limit:
        top_n = df[color_by].value_counts()[:limit].index.tolist()
        df[color_by] = df[color_by].apply(lambda x: x if x in top_n else 'Other')
    color_mapper = get_scatter_colors(df, color_by, limit)
    df['color'] = df[color_by].apply(lambda x: color_mapper[x])

    tooltips = [
        ("Gene Set", "@gene_set"),
        ("Cluster", "@label")
    ]
        
    hover_emb = HoverTool(tooltips=tooltips)
    tools_emb = [hover_emb, 'pan', 'wheel_zoom', 'reset', 'save']

    plot_emb = figure(
        plot_width=800, 
        plot_height=700, 
        tools=tools_emb
    )

    source = ColumnDataSource(
        data=dict(
            x = df['x'],
            y = df['y'],
            gene_set = df['term'],
            colors = df['color'],
            label = df[color_by],
            fa = df[color_by].apply(lambda x: 0.5 if x == 'Other' else 0.9)
        )
    )

    # hide axis labels and grid lines
    plot_emb.xaxis.major_tick_line_color = None
    plot_emb.xaxis.minor_tick_line_color = None
    plot_emb.yaxis.major_tick_line_color = None
    plot_emb.yaxis.minor_tick_line_color = None
    plot_emb.xaxis.major_label_text_font_size = '0pt'
    plot_emb.yaxis.major_label_text_font_size = '0pt' 

    plot_emb.output_backend = "svg"    
    
    plot_emb.xaxis.axis_label = "UMAP-1"
    plot_emb.yaxis.axis_label = "UMAP-2"
    plot_emb.xaxis.axis_label_text_font_size = '16pt'
    plot_emb.yaxis.axis_label_text_font_size = '16pt'
    
    s = plot_emb.scatter(
        'x', 
        'y', 
        size = 4, 
        source = source, 
        color = 'colors', 
        legend_group = 'label',
        fill_alpha = 'fa',
        line_alpha = 'fa'
    )

    if hide_legend:
        plot_emb.legend.visible=False

    plot_emb.add_layout(plot_emb.legend[0], 'right')
    plot_emb.legend.label_text_font_size = '15pt'
    plot_emb.legend.title_text_font_size = '15pt'
    plot_emb.legend.title_text_font_style = 'bold'
    if color_by == 'TF':
        plot_emb.legend.title = color_by
    else:
        plot_emb.legend.title = color_by.title()
    
    return plot_emb

# %% [markdown]
# ### Transcription Factors

# %%
l_dict = get_scatter_library('Rummagene-transcription-factorsv2')

# %%
print(f"Now processing Rummagene-transcription-factors-v2")
## defaults: nneighbors=30, mindist=0.1, spread=1.0, maxdf=1.0, mindf=1
scatter_df = process_scatterplot(
    l_dict, 
    nneighbors=11,
    mindist=0.50,
    # spread=0., 
    maxdf=0.04, 
    # mindf=5
)
print(f"\tDone!")

# %%
scatter_df['PMID'] = scatter_df['term'].apply(lambda x: x.split('-')[0])
scatter_df['TF'] = scatter_df['term'].apply(lambda x: x.split('_')[-1])

# %%
# Display Scatter Plots
plot_top20 = get_scatterplot(scatter_df,color_by='TF', limit=20)
# show(plot_top20)
# output_file(filename=f"Figures/TFs_byTFTop20_v2.html")
# save(plot_top20)
export_svg(plot_top20, filename=str(fig_dir/"2e.svg"))

# %%
# Display Scatter Plots
plot_pmid = get_scatterplot(scatter_df,color_by='PMID', hide_legend=True)
# output_file(filename=f"Figures/TFs_byPMID_v2.html")
# save(plot_pmid)
# show(plot_pmid)
export_svg(plot_pmid, filename=str(fig_dir/"2f.svg"))
