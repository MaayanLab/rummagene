import click
from pathlib import Path
from helper.cli import cli

@cli.command()
@click.option('-i', '--input', type=click.Path(exists=True, file_okay=True, path_type=Path), help='GMT file to clean')
@click.option('-o', '--output', type=click.Path(path_type=Path), help='Output location')
def clean(input, output):
  import re
  from maayanlab_bioinformatics.harmonization.ncbi_genes import ncbi_genes_lookup

  lookup = None
  def gene_lookup(value):
    ''' Don't allow pure numbers or spaces--numbers can typically match entrez ids
    '''
    if type(value) != str: return None
    if re.search(r'\s', value): return None
    if re.match(r'\d+(\.\d+)?', value): return None
    global lookup
    if lookup is None:
      lookup = ncbi_genes_lookup(filters=lambda ncbi: ncbi)
    return lookup(value)

  terms = set()
  with input.open('r') as fr:
    with output.open('w') as fw:
      for line in filter(None, map(str.strip, fr)):
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