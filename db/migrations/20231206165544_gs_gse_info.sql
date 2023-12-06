-- migrate:up

create view app_public_v2.gene_set_gse_info as
select
  gsp.id,
  gsp.gse_id,
  gse_info.gse,
  gse_info.title,
  gse_info.sample_groups,
  gse_info.platform,
  gse_info.published_date
from app_public_v2.gene_set_pmid gsp
join app_public_v2.gse_info gse_info on gsp.gse = gse_info.gse;

grant select on app_public_v2.gene_set_gse_info to guest;
grant all privileges on app_public_v2.gene_set_gse_info to authenticated;

-- migrate:down

drop view app_public_v2.gene_set_gse_info;