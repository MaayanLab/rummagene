''' Re-write the output.gmt with only official symbols

NOTE: It's useful to have the original symbols to rule identify artifacts that are being mistakenly converted
'''

from tqdm import tqdm
from pathlib import Path
from download_extract import gene_lookup

def main(data_dir = Path()):
  terms = set()
  with (data_dir/'output.gmt').open('r') as fr:
    total = sum(1 for _ in tqdm(fr, desc='Counting lines...'))
    fr.seek(0)
    with (data_dir/'output-clean.gmt').open('w') as fw:
      for line in tqdm(filter(None, map(str.strip, fr)), desc='Cleaning gmt...', total=total):
        term, _, *geneset = line.split('\t')
        geneset_mapped = [gene_mapped for gene in geneset for gene_mapped in (gene_lookup(gene),) if gene_mapped]
        if (
          len(geneset_mapped) >= 5
          and len(geneset_mapped) < 2500
          and len(term) < 200
          and term not in terms
        ):
          terms.add(term)
          print(
            term, '',
            *geneset_mapped,
            sep='\t',
            file=fw,
          )

if __name__ == '__main__':
  import os
  from dotenv import load_dotenv; load_dotenv()
  data_dir = Path(os.environ.get('PTH', 'data'))
  main(data_dir)
