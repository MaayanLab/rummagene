#%%
from common import data_dir, GMT, maybe_tqdm

#%%
with (data_dir/'enrichr.gmt').open('w') as fw:
  for gene_set_library in maybe_tqdm((data_dir/'Enrichr').glob('*.gmt'), desc='Processing enrichr libraries...'):
    for (term, _desc), genes in maybe_tqdm(GMT.reader(gene_set_library), desc=f"Processing {gene_set_library}..."):
      print(
        gene_set_library.stem,
        term,
        *genes,
        sep='\t',
        file=fw,
      )
