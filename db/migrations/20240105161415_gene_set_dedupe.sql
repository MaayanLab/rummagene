-- migrate:up
alter table app_public_v2.gene_set add column hash uuid;
create index on app_public_v2.gene_set (hash);

-- migrate:down
alter table app_public_v2.gene_set drop column hash;
