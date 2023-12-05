import re
import os
import json
import psycopg2, psycopg2.extras

class PlPyCompat:
  ''' An object that works like `plpy` does when running over plpython3u
  '''
  def __init__(self, conn) -> None:
    self.conn = conn
  def cursor(self, query, args=[]):
    with self.conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
      cur.execute(query, args)
      for row in cur.fetchall():
        yield {
          k: json.dumps(v) if type(v) == dict else v
          for k, v in row.items()
        }
  def execute(self, query, args=[]):
    with self.conn.cursor() as cur:
      cur.execute(query, args)
  def prepare(self, query, arg_types):
    return re.sub(r'\$\d+', '%s', query)
  def rollback(self):
    self.conn.rollback()

try:
  from dotenv import load_dotenv; load_dotenv()
except ImportError:
  print('Install python-dotenv for .env support')
  
conn = psycopg2.connect(os.environ['DATABASE_URL'])
plpy = PlPyCompat(conn)
