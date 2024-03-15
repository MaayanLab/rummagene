import pathlib
import os
from common import maybe_tqdm

from dotenv import load_dotenv
load_dotenv()

from Bio import Entrez
Entrez.email = os.getenv('EMAIL')
Entrez.api_key = os.getenv('API_KEY')

def get_all_genes(path):
    genes = set()
    with pathlib.Path(path).open('r') as fr:
        for line in fr:
            for term, _, *geneset in (line.strip().split('\t'),):
                genes.update(geneset)
    return list(genes)



if __name__ == '__main__':
    genes = get_all_genes('data/table-mining-clean.gmt')

    db = 'pubmed'
    domain = 'https://www.ncbi.nlm.nih.gov/entrez/eutils'
    retmode='json'
    with open(f'data/pubmed_rif.tsv', 'w') as f:
        for g in maybe_tqdm(genes):
            query = g
            handle = Entrez.esearch(db="pubmed", retmax=9999999 ,term=g, idtype="acc")
            record = Entrez.read(handle)
            handle.close()
            if len(record['IdList']) > 0:
                for id in record['IdList']:
                    f.write(f"{g}\t{id}\n")
