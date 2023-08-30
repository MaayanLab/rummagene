-- migrate:up

create table app_public.pmc_info (
  id uuid primary key default uuid_generate_v4(),
  pmcid varchar not null unique,
  title varchar,
  yr int,
  doi varchar
);

comment on table app_public.pmc_info is E'@foreignKey (pmcid) references app_public.gene_set_pmc (pmc)';

grant select on table app_public.pmc_info to guest;
grant all privileges on table app_public.pmc_info to authenticated;


create or replace function app_public.get_pmc_info_by_ids(pmcids varchar[])
returns setof app_public.pmc_info as
$$
  select *
  from app_public.pmc_info
  where pmcid = ANY (pmcIds);
$$ language sql immutable strict parallel safe;

grant execute on function app_public.get_pmc_info_by_ids to guest, authenticated;


-- migrate:down

drop table app_public.pmc_info;
drop function app_public.get_pmc_info_by_ids(pmcIds varchar[]);
