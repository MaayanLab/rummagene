import click
from helper.cli import cli

@cli.command()
@click.option('--enrich-url', envvar='ENRICH_URL', default='http://127.0.0.1:8000')
def update_background(enrich_url):
  ''' A background is tied to a complete set of genes across all gene sets
  but also to a computed index in the enrich API. This function creates a
  new one, and drops the old one after ensuring the index is ready.
  '''
  import requests
  from helper.plpy import plpy
  # record current backgrounds
  current_backgrounds = [row['id'] for row in plpy.cursor('select id from app_public_v2.background')]  # create updated background
  new_background, = plpy.cursor('''
    insert into app_public_v2.background (gene_ids, n_gene_ids)
    select
      jsonb_object_agg(distinct gsg.gene_id, null) as gene_ids,
      count(distinct gsg.gene_id) as n_gene_ids
    from app_public_v2.gene_set gs, jsonb_each(gs.gene_ids) gsg(gene_id, nil)
    returning id;
  ''')
  plpy.conn.commit()
  # trigger index creation for the new background
  assert requests.get(f"{enrich_url}/{new_background['id']}").ok
  # remove old backgrounds
  plpy.execute(
    plpy.prepare('delete from app_public_v2.background where id = any($1::uuid[])', ['text[]']),
    [current_backgrounds]
  )
  plpy.conn.commit()
  # remove index for the old background
  for current_background in current_backgrounds:
    requests.delete(f"{enrich_url}/{current_background}")
