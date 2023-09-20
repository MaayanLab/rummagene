-- migrate:up
alter table app_public_v2.background add column created timestamp default now();
create or replace function app_public_v2.current_background() returns app_public_v2.background
as $$
  select *
  from app_public_v2.background
  order by created asc
  limit 1;
$$ language sql strict immutable parallel safe security definer;
grant execute on function app_public_v2.current_background to guest, authenticated;

-- migrate:down
drop function app_public_v2.current_background;
alter table app_public_v2.background drop column created;
