-- migrate:up
alter table app_public_v2.gene
add column ncbi_gene_id integer,
add column description varchar,
add column summary text;

-- migrate:down
alter table app_public_v2.gene
drop column ncbi_gene_id integer,
drop column description,
drop column summary;
