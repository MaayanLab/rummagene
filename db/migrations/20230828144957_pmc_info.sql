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


create or replace function app_public.terms_pmcs(pmcids varchar[])
returns table (pmc varchar, term varchar, id uuid) as
$$
  select gsp.pmc, gs.term, gs.id
  from 
    app_public.gene_set_pmc as gsp
    inner join app_public.gene_set as gs on gs.id = gsp.id
  where gsp.pmc = ANY (pmcids);
$$ language sql immutable strict parallel safe;

grant execute on function app_public.terms_pmcs to guest, authenticated;

create or replace function app_public.view_gene_set(gsid uuid)
returns table (symbol varchar) as
$$
  select g.symbol
  from 
    app_public.gene g
    inner join app_public.gene_set_gene as gsg on g.id = gsg.gene_id
  where gsg.gene_set_id = gsid;
$$ language sql immutable strict parallel safe;

grant execute on function app_public.view_gene_set to guest, authenticated;

-- migrate:down

drop table app_public.pmc_info;
drop function app_public.get_pmc_info_by_ids(pmcIds varchar[]);
drop function app_public.terms_pmcs(pmcIds varchar[]);
drop function app_public.view_gene_set(gsid uuid)