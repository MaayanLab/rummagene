-- migrate:up

create materialized view app_public_v2.gene_set_gse as
select gs.id, regexp_replace(gs.term, '\mGSE([^-]+)\M.*', 'GSE\1') as gse, gs.species
from app_public_v2.gene_set gs;
comment on materialized view app_public_v2.gene_set_gse is E'@foreignKey (id) references app_public_v2.gene_set (id)';

create unique index gene_set_gse_id_gse_idx on app_public_v2.gene_set_gse (id, gse);
create index gene_set_gse_id_idx on app_public_v2.gene_set_gse (id);
create index gene_set_gse_gse_idx on app_public_v2.gene_set_gse (gse);

grant select on app_public_v2.gene_set_gse to guest;
grant all privileges on app_public_v2.gene_set_gse to authenticated;

create view app_public_v2.gse as select distinct gse from app_public_v2.gene_set_gse;
comment on view app_public_v2.gse is E'@foreignKey (gse) references app_public_v2.gene_set_gse (gse)';

grant select on app_public_v2.gse to guest;
grant all privileges on app_public_v2.gse to authenticated;



-- migrate:down

drop materialized view app_public_v2.gene_set_gse cascade;

