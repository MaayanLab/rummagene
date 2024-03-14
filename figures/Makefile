# Ensure the environment is set up to run this
.venv/: requirements.txt
	python3 -m venv .venv
	.venv/bin/pip install -r requirements.txt

# This is the rummagene database, as assembled by the rummagene bot
# https://github.com/MaayanLab/rummagene/tree/main/bot
data/table-mining.gmt:
	mkdir -p data && curl https://s3.dev.maayanlab.cloud/rummagene/table-mining.gmt.gz | gzip -d > $@
# data/table-mining-clean.gmt: .venv data/lookup.json data/table-mining.gmt
# 	.venv/bin/python clean_gmt.py < data/table-mining.gmt > data/table-mining-clean.gmt
data/table-mining-clean.gmt:
	mkdir -p data && curl https://s3.dev.maayanlab.cloud/rummagene/table-mining-clean.gmt.gz | gzip -d > $@

# This is a supplemental file for gene citations, we already ran it
# data/pubmed_rif.tsv: .venv data/table-mining-clean.gmt
# 	.venv/bin/python collect_citations.py
data/pubmed_rif.tsv:
	mkdir -p data && curl https://s3.dev.maayanlab.cloud/rummagene/pubmed_rif_8-17-23.tsv.gz | gzip -d > $@

# this constructs a gene synonym/symbol lookup file used by clean_gmt.py
data/lookup.json: .venv
	.venv/bin/python gene_lookup.py

# Downloads all gene set libraries from Enrichr
data/Enrichr: .venv
	.venv/bin/python download_enrichr_db.py

# assemble a single gmt from all enrichr libraries
data/enrichr.gmt: .venv data/Enrichr
	.venv/bin/python assemble_enrichr_gmt.py

# clean the enrichr gmt
data/enrichr-clean.gmt: .venv data/lookup.json data/enrichr.gmt
	.venv/bin/python clean_gmt.py < data/enrichr.gmt > data/enrichr-clean.gmt

# construct UMAP coordinates of the rummagene database
data/rummagene-umap.tsv: .venv data/table-mining-clean.gmt
	.venv/bin/python compute_umap.py

# construct UMAP coordinates & clustering of the rummagene database + enrichr
data/joint-umap.tsv: .venv data/table-mining-clean.gmt data/enrichr-clean.gmt
	.venv/bin/python compute_joint_umap.py

# generate the figure panels for fig1
figures/fig1: .venv data/table-mining-clean.gmt data/pubmed_rif.tsv data/rummagene-umap.tsv
	.venv/bin/python fig1.py

# generate the figure panels for fig2
figures/fig7: .venv data/joint-umap.tsv
	.venv/bin/python fig7.py

.PHONY: build
build: figures/fig1 figures/fig7
