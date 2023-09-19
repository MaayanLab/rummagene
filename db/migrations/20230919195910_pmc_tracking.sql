-- migrate:up
create table app_public_v2.pmc_stats (
  id int generated always as (1) stored unique,
  n_publications_processed bigint
);
grant select on table app_public_v2.pmc_stats to guest;
grant all privileges on table app_public_v2.pmc_stats to authenticated;

insert into app_public_v2.pmc_stats (n_publications_processed)
values (5448589);

-- migrate:down
drop table app_public_v2.pmc_stats;
