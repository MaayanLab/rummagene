-- migrate:up

create table app_public_v2.gsm_meta (
  id uuid primary key default uuid_generate_v4(),
  gsm varchar not null unique,
  gse varchar,
  title varchar,
  characteristics_ch1 varchar,
  source_name_ch1 varchar
);

create index idx_gsm_meta_gsm ON app_public_v2.gsm_meta (gsm);

grant select on app_public_v2.gsm_meta to guest;
grant all privileges on app_public_v2.gsm_meta to authenticated;

create or replace function app_public_v2.get_gsm_meta(gsms varchar[])
returns setof app_public_v2.gsm_meta as
$$
  select *
  from app_public_v2.gsm_meta
  where gsm = ANY (gsms);
$$ language sql immutable strict parallel safe;

grant execute on function app_public_v2.get_gsm_meta to guest, authenticated;

-- migrate:down

drop table app_public_v2.gsm_meta cascade;
