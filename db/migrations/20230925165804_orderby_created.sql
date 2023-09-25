-- migrate:up
create index release_created_idx on app_public_v2.release (created);

-- migrate:down
drop index release_created_idx;
