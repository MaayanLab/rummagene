-- migrate:up
alter table app_public_v2.pmc_info
add column license varchar;
create index on app_public_v2.pmc_info (license);

alter table app_public_v2.background
add column commercial boolean not null default false;

-- migrate:down
alter table app_public_v2.background
drop column commercial;
alter table app_public_v2.pmc_info
drop column license;
