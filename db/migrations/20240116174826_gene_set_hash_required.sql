-- migrate:up
alter table app_public_v2.gene_set alter column hash set not null;

-- migrate:down
alter table app_public_v2.gene_set alter column hash drop not null;
