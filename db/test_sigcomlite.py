import os
import re
import pytest
import psycopg2
try:
  from dotenv import load_dotenv; load_dotenv()
except ImportError:
  print('Install python-dotenv for .env support')

class PlPyCompat:
  ''' An object that works like `plpy` does when running over plpython3u
  '''
  def __init__(self, *args, **kwargs) -> None:
    self.conn = psycopg2.connect(*args, **kwargs)
  def cursor(self, query, args):
    with self.conn.cursor() as cur:
      cur.execute(query, args)
      yield from cur.fetchall()
  def execute(self, query, args):
    with self.conn.cursor() as cur:
      cur.execute(query, args)
  def prepare(self, query, arg_types):
    return re.sub(r'\$\d+', '%s', query)

@pytest.fixture()
def plpy():
  return PlPyCompat(os.environ['DATABASE_URL'])
