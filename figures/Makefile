# Ensure the environment is set up to run this
.venv: requirements.txt
	python3 -m venv .venv
	.venv/bin/pip install -r requirements.txt

# This is the rummagene database, as assembled by the rummagene bot
# https://github.com/MaayanLab/rummagene/tree/main/bot
data/table-mining.gmt:
	mkdir -p data && curl -L https://s3.amazonaws.com/maayanlab-public/rummagene/table-mining.gmt.gz | gzip -d > $@
# data/table-mining-clean.gmt: .venv data/lookup.json data/table-mining.gmt
# 	.venv/bin/python clean_gmt.py < data/table-mining.gmt > data/table-mining-clean.gmt

data/table-mining-clean.gmt:
	mkdir -p data && curl -L https://s3.amazonaws.com/maayanlab-public/rummagene/table-mining-clean.gmt.gz | gzip -d > $@

data/consensus_kinase_clean.gmt:
	mkdir -p data && curl -L https://s3.amazonaws.com/maayanlab-public/rummagene/consensus_kinase_clean.gmt.gz | gzip -d > $@

data/consensus_tf_clean.gmt:
	mkdir -p data && curl -L https://s3.amazonaws.com/maayanlab-public/rummagene/consensus_tf_clean.gmt.gz | gzip -d > $@

data/tf-kinases.json:
	mkdir -p data && curl -L https://s3.amazonaws.com/maayanlab-public/rummagene/tf-kinases.json.gz | gzip -d > $@

data/bto.owl:
	mkdir -p data && curl -L https://raw.githubusercontent.com/BRENDA-Enzymes/BTO/fcba7305e162314d91e2886a615f48481ca0a49b/bto.owl > $@

data/sigs_df_annotated.tsv:
	mkdir -p data && curl -L https://s3.amazonaws.com/maayanlab-public/rummagene/sigs_df_annotated.tsv.gz | gzip -d > $@

# download and unzip tf benchmarking data
data/benchmarking_data_tf:
	mkdir -p data && curl -L https://s3.amazonaws.com/maayanlab-public/rummagene/benchmarking_data_tf.zip --output data/benchmarking_data_tf.zip
	unzip data/benchmarking_data_tf.zip -d data

# download and unzip kinase benchmarking data
data/benchmarking_data_kinase:
	mkdir -p data && curl -L https://s3.amazonaws.com/maayanlab-public/rummagene/benchmarking_data_kinase.zip --output data/benchmarking_data_kinase.zip
	unzip data/benchmarking_data_kinase.zip -d data

data/doi_info.csv:
	mkdir -p data && curl -L https://s3.amazonaws.com/maayanlab-public/rummagene/doi_info.csv.gz | gzip -d > $@

data/Rummagene_transcription_factors.gmt:
	mkdir -p data && curl -L https://s3.amazonaws.com/maayanlab-public/rummagene/Rummagene_transcription_factors.gmt.gz | gzip -d > $@

data/Rummagene_kinases.gmt:
	mkdir -p data && curl -L https://s3.amazonaws.com/maayanlab-public/rummagene/Rummagene_kinases.gmt.gz | gzip -d > $@

# create consensus and term level kinase and tf gene set libraries
#data/consensus_kinase_clean.gmt: .venv data/table-mining-clean.gmt data/tf-kinases.json
#	.venv/bin/python create_tf_kinase_gsl.py
#data/consensus_tf_clean.gmt: .venv  data/table-mining-clean.gmt data/tf-kinases.json
#	.venv/bin/python create_tf_kinase_gsl.py
#data/Rummagene_transcription_factors.gmt: .venv data/table-mining-clean.gmt data/tf-kinases.json
#	.venv/bin/python create_tf_kinase_gsl.py
#data/Rummagene_kinases.gmt: .venv  data/table-mining-clean.gmt data/tf-kinases.json
#	.venv/bin/python create_tf_kinase_gsl.py

# This is a supplemental file for gene citations, we already ran it
# data/pubmed_rif.tsv: .venv data/table-mining-clean.gmt
# 	.venv/bin/python collect_citations.py
data/pubmed_rif.tsv:
	mkdir -p data && curl -L https://s3.amazonaws.com/maayanlab-public/rummagene/pubmed_rif_8-17-23.tsv.gz | gzip -d > $@

data/PMC-ids.csv:
	mkdir -p data && curl -L https://ftp.ncbi.nlm.nih.gov/pub/pmc/PMC-ids.csv.gz | gzip -d > $@

# this constructs a gene synonym/symbol lookup file used by clean_gmt.py
data/lookup.json: .venv
	.venv/bin/python gene_lookup.py

# Downloads all gene set libraries from Enrichr
data/Enrichr: .venv
	test -d data/Enrichr || .venv/bin/python download_enrichr_db.py

# assemble a single gmt from all enrichr libraries
data/enrichr.gmt: .venv data/Enrichr
	.venv/bin/python assemble_enrichr_gmt.py

# clean the enrichr gmt
data/enrichr-clean.gmt: .venv data/lookup.json data/enrichr.gmt
	.venv/bin/python clean_gmt.py < data/enrichr.gmt > data/enrichr-clean.gmt

# construct UMAP coordinates of the rummagene database
data/rummagene-umap.tsv: .venv data/table-mining-clean.gmt
	.venv/bin/python compute_umap.py

# used for similarity matrices
data/random50k_co-occurrence.f:
	mkdir -p data && curl -L https://s3.amazonaws.com/maayanlab-public/rummagene/random50k_co-occurrence.f.gz | gzip -d > $@

# construct similarity matrix
data/nmi.f: .venv data/random50k_co-occurrence.f
	.venv/bin/python similarity_matrices.py

# construct UMAP coordinates & clustering of the rummagene database + enrichr
data/joint-umap.tsv: .venv data/table-mining-clean.gmt data/enrichr-clean.gmt
	.venv/bin/python compute_joint_umap.py

# generate the figure panels for fig1
figures/fig1: .venv data/table-mining-clean.gmt data/PMC-ids.csv data/pubmed_rif.tsv data/rummagene-umap.tsv
	.venv/bin/python fig1.py

# generate the figure panels for fig2
figures/fig2: .venv data/bto.owl data/table-mining-clean.gmt data/tf-kinases.json data/Rummagene_transcription_factors.gmt data/Rummagene_kinases.gmt
	.venv/bin/python fig2.py
	.venv/bin/python fig2e-h.py

# generate the figure panels for fig3
figures/fig3: .venv data/benchmarking_data_tf data/benchmarking_data_kinase data/consensus_kinase_clean.gmt data/consensus_tf_clean.gmt
	.venv/bin/python fig3.py

# generate the figure panels for fig4
figures/fig4: .venv data/table-mining-clean.gmt data/PMC-ids.csv data/doi_info.csv
	.venv/bin/python fig4.py

# generate the figure panels for fig5
figures/fig5: .venv data/sigs_df_annotated.tsv
	.venv/bin/python fig5.py

# generate the figure panels for fig6
figures/fig6: .venv data/nmi.f data/Enrichr
	.venv/bin/python fig6.py

# generate the figure panels for fig7
figures/fig7: .venv data/joint-umap.tsv
	.venv/bin/python fig7.py

.PHONY: build
build: figures/fig1 figures/fig2 figures/fig3 figures/fig4 figures/fig5 figures/fig6 figures/fig7
