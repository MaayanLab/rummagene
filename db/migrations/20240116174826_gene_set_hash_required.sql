-- migrate:up
alter table app_public_v2.gene_set set column hash set not null;

-- migrate:down
alter table app_public_v2.gene_set set column hash drop not null;
