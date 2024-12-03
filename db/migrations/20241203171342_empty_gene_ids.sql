-- migrate:up
create or replace function app_private_v2.indexed_enrich(
  background app_public_v2.background,
  gene_ids uuid[],
  filter_term varchar default null,
  overlap_ge int default 1,
  pvalue_le double precision default 0.05,
  adj_pvalue_le double precision default 0.05,
  "offset" int default null,
  "first" int default null
) returns app_public_v2.paginated_enrich_result as $$
  import os, requests
  params = dict(
    overlap_ge=overlap_ge,
    pvalue_le=pvalue_le,
    adj_pvalue_le=adj_pvalue_le,
  )
  if filter_term: params['filter_term'] = filter_term
  if offset: params['offset'] = offset
  if first: params['limit'] = first
  if not gene_ids: return dict(nodes=[], total_count=0)
  req = requests.post(
    f"{os.environ.get('ENRICH_URL', 'http://rummagene-enrich:8000')}/{background['id']}",
    params=params,
    json=gene_ids,
  )
  total_count = req.headers.get('Content-Range').partition('/')[-1]
  return dict(nodes=req.json(), total_count=total_count)
$$ language plpython3u immutable parallel safe;

-- migrate:down

