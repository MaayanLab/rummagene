-- migrate:up

create table app_public_v2.gse_info (
  id uuid primary key default uuid_generate_v4(),
  gse varchar,
  pmid varchar,
  title varchar,
  summary varchar,
  published_date date,
  species varchar,
  platform varchar,
  sample_groups jsonb
);

grant select on app_public_v2.gse_info to guest;
grant all privileges on app_public_v2.gse_info to authenticated;

create table app_public_v2.pmid_info (
  id uuid primary key default uuid_generate_v4(),
  pmid varchar not null unique,
  pmcid varchar,
  title varchar,
  yr int,
  doi varchar
);

grant select on app_public_v2.gse_info to guest;
grant all privileges on app_public_v2.gse_info to authenticated;

-- Create the materialized view gene_set_pmid
create materialized view app_public_v2.gene_set_pmid as
select
  gs.id,
  gse_info.id as gse_id,
  gse_info.gse,
  gse_info.pmid,
  gse_info.title,
  gse_info.sample_groups,
  gse_info.platform,
  gse_info.published_date
from app_public_v2.gene_set gs
join app_public_v2.gse_info gse_info on regexp_replace(gs.term, '\mGSE([^-]+)\M.*', 'GSE\1') = gse_info.gse;

-- Add a comment for the foreign key
comment on materialized view app_public_v2.gene_set_pmid is E'@foreignKey (id) references app_public_v2.gene_set (id)';

-- Create unique and regular indexes
create unique index gene_set_pmid_id_pmid_idx on app_public_v2.gene_set_pmid (id, pmid);
create index gene_set_pmid_id_idx on app_public_v2.gene_set_pmid (id);
create index gene_set_pmid_pmid_idx on app_public_v2.gene_set_pmid (pmid);

-- Grant permissions
grant select on app_public_v2.gene_set_pmid to guest;
grant all privileges on app_public_v2.gene_set_pmid to authenticated;

-- Create the view pmid
create view app_public_v2.pmid as select distinct pmid from app_public_v2.gene_set_pmid;

-- Add a comment for the foreign key
comment on view app_public_v2.pmid is E'@foreignKey (pmid) references app_public_v2.gene_set_pmid (pmid)';

-- Grant permissions for the view
grant select on app_public_v2.pmid to guest;
grant all privileges on app_public_v2.pmid to authenticated;

create or replace function app_public_v2.get_pb_info_by_ids(pmids varchar[])
returns setof app_public_v2.gse_info as
$$
  select *
  from app_public_v2.gse_info
  where pmid = ANY (pmids);
$$ language sql immutable strict parallel safe;
grant execute on function app_public_v2.get_pb_info_by_ids to guest, authenticated;


-- migrate:down

drop table app_public_v2.gse_info;
drop table app_public_v2.pmid_info;
drop materialized view app_public_v2.gene_set_pmid;
drop function app_public_v2.get_pb_info_by_ids(pmids varchar[]);

