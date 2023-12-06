-- migrate:up

create table app_public_v2.gsm_meta (
  id uuid primary key default uuid_generate_v4(),
  gsm varchar not null unique,
  gse varchar,
  title varchar,
  characteristics_ch1 varchar,
  source_name_ch1 varchar
);

-- migrate:down

drop table app_public_v2.gsm_meta;