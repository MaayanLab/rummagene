import sys
from common import GMT, maybe_tqdm, gene_lookup

for (term, desc), genes in maybe_tqdm(GMT.reader(sys.stdin), desc='Cleaning gmt...'):
  genes_mapped = {
    gene_mapped
    for gene in genes
    for gene_mapped in (gene_lookup(gene),)
    if gene_mapped
  }
  if len(genes_mapped) < 5: continue
  print(
    term,
    desc,
    *genes_mapped,
    sep='\t',
  )
