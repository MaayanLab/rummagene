#%%
import json
from common import data_dir, cached_urlretrieve, maybe_tqdm

#%%
(data_dir/'Enrichr').mkdir(parents=True, exist_ok=True)

#%%
cached_urlretrieve(
  'https://maayanlab.cloud/Enrichr/datasetStatistics',
  data_dir/'Enrichr'/'datasetStatistics.json'
)
with (data_dir/'Enrichr'/'datasetStatistics.json').open('r') as fr:
  datasetStatistics = json.load(fr)
datasetStatistics

#%%
for library in maybe_tqdm(datasetStatistics['statistics'], desc='Downloading Enrichr database...'):
  cached_urlretrieve(
    f"https://maayanlab.cloud/Enrichr/geneSetLibrary?mode=text&libraryName={library['libraryName']}",
    data_dir/'Enrichr'/(library['libraryName']+'.gmt')
  )
