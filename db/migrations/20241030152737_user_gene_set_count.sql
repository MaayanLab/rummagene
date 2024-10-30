-- migrate:up
create or replace function app_public_v2.user_gene_set_count()
returns int as $$
  select count(*) as total_count
  from app_public_v2.user_gene_set;
$$ language sql immutable strict parallel safe;
grant execute on function app_public_v2.user_gene_set_count to guest, authenticated;

comment on table app_public_v2.user_gene_set is '@omit all';

-- migrate:down
comment on table app_public_v2.user_gene_set is null;
drop function app_public_v2.user_gene_set_count();
