import click
from helper.cli import cli

@cli.command()
@click.argument('publications', type=int)
def create_release(publications):
  from helper.plpy import plpy
  plpy.execute(
    plpy.prepare('insert into app_public_v2.release (n_publications_processed) values ($1);', ['bigint']),
    [publications],
  )
  plpy.execute('refresh materialized view app_private_v2.pmc_stats;')
  plpy.conn.commit()
