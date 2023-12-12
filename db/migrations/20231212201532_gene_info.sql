-- migrate:up
alter table app_public_v2.gene
add column description varchar,
add column summary text;

-- migrate:down
alter table app_public_v2.gene
drop column description,
drop column summary;
