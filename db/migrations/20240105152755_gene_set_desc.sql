-- migrate:up
alter table app_public_v2.gene_set add column description varchar;

-- migrate:down
alter table app_public_v2.gene_set drop column description;
