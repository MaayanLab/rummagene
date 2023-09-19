-- migrate:up
alter table app_public_v2.gene_set add column created timestamp not null default now();

create table app_public_v2.release (
  id uuid primary key default uuid_generate_v4(),
  n_publications_processed bigint,
  created timestamp default now()
);
grant select on table app_public_v2.release to guest;
grant all privileges on table app_public_v2.release to authenticated;

insert into app_public_v2.release (n_publications_processed)
values (5448589);
grant select on table app_public_v2.release to guest;
grant all privileges on table app_public_v2.release to authenticated;

create materialized view app_private_v2.pmc_stats as
select sum(n_publications_processed) as n_publications_processed
from app_public_v2.release;
create or replace function app_public_v2.pmc_stats() returns app_private_v2.pmc_stats
as $$
  select * from app_private_v2.pmc_stats;
$$ language sql strict immutable parallel safe security definer;
grant execute on function app_public_v2.pmc_stats to guest, authenticated;

-- migrate:down
drop function app_public_v2.pmc_stats;
drop materialized view app_private_v2.pmc_stats;
drop table app_public_v2.release;
alter table app_public_v2.gene_set drop column created;
alter table app_public_v2.background drop column created;

create table app_public_v2.pmc_stats (
  id int generated always as (1) stored unique,
  n_publications_processed bigint
);
grant select on table app_public_v2.pmc_stats to guest;
grant all privileges on table app_public_v2.pmc_stats to authenticated;
insert into app_public_v2.pmc_stats (n_publications_processed)
values (5448589);
