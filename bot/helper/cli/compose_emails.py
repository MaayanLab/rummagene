import re
import json
import click
import pandas as pd
import jinja2
from urllib.parse import quote
from pathlib import Path
from textwrap import dedent
from helper.cli import cli

class Context(dict):
  def register(self, fn):
    self[fn.__name__] = fn
ctx = Context()
ctx.register(quote)

@ctx.register
def maybe_the(s):
  if re.match(r'^(\w+\s)?journal', s, re.IGNORECASE):
    return f"the {s}"
  else:
    return s

@ctx.register
def human_list(L):
  if len(L) == 0:
    return ''
  elif len(L) == 1:
    start, = L
    return start
  elif len(L) == 2:
    start, end = L
    return f"{start} and {end}"
  elif len(L) >= 3:
    *start, end = L
    return f"{', '.join(start)}, and {end}"

email_template = jinja2.Template(dedent('''
  {%- set single_gene_set = articles|length == 1 and articles[0].terms|length == 1 %}
  {%- set single_article = articles|length == 1 %}
  To: {{ email }}
  Subject: Adding your recently published gene set{% if not single_gene_set %}s{% endif %} to the Rummagene database

  Dear Dr. {{ surname }},

  Congratulations on your recent publication{% if not single_article %}s{% endif %} in {{ maybe_the(human_list(journals)) }} ({% for article in articles %}{% if not loop.first %}, {% endif %}<a href="https://www.ncbi.nlm.nih.gov/pmc/articles/{{ article.pmc }}">{{ article.pmc }}</a>{% endfor %}).

  We crawled the tables and supporting materials of the paper{% if single_article %}s{% endif %}, and found {% if single_gene_set %}a unique gene set{% else %}unique gene sets{% endif %} in it. We added this gene set to <a href="https://rummagene.com">Rummagene</a>, a new database and search engine that mines gene sets from tables and supporting materials of biomedical research publications.

  {%- if single_gene_set %}

  You can further analyze the gene set by submitting it for enrichment analysis with the following tools:

  <a href="https://rummagene.com/gene_set/{{ quote(articles[0].terms[0]) }}/submit/rummagene">Rummagene</a> - find gene sets in other papers' supporting materials that are similar to your gene set
  {#<a href="https://rummagene.com/gene_set/{{ quote(articles[0].terms[0]) }}/submit/rummageo">RummaGEO</a> - find matching up/down gene sets extracted from the NCBI GEO database similar to your gene set#}
  <a href="https://rummagene.com/gene_set/{{ quote(articles[0].terms[0]) }}/submit/enrichr">Enrichr</a> - find similar gene sets in a collection of ~500,000 annotated gene sets
  <a href="https://rummagene.com/gene_set/{{ quote(articles[0].terms[0]) }}/submit/enrichr-kg">Enrichr-KG</a> - visualize your gene set in the context of prior knowledge about other gene sets
  <a href="https://rummagene.com/gene_set/{{ quote(articles[0].terms[0]) }}/submit/cfde-gse">CFDE-GSE</a> - explore how your gene set compares with gene sets created from NIH Common Fund datasets
  <a href="https://rummagene.com/gene_set/{{ quote(articles[0].terms[0]) }}/submit/playbook">Playbook</a> - build a workflow to analyze your gene sets and convert it into publication ready figures with text
  <a href="https://rummagene.com/gene_set/{{ quote(articles[0].terms[0]) }}/submit/g2sg">G2SG</a> - add your gene set into a workspace where you can combine and compare it to other gene sets
  {%- else %}
  {%- if single_article %}

  The gene sets from your paper can be found <a href="https://rummagene.com/term-search?page=1&q={{ articles[0].pmc }}">here</a> and are now discoverable by other users of Rummagene.
  {%- else %}

  The gene sets from your papers listed below are now discoverable by other users of Rummagene.
  
  <table>
    <thead>
      <tr>
        <th>Paper</th>
        <th>Journal</th>
        <th>Gene Sets</th>
        <th>Rummagene Link</th>
      </tr>
    </thead>
    <tbody>
      {%- for article in articles %}
      <tr>
        <th>{{ article.article_title }}</th>
        <th>{{ article.journal_title }}</th>
        <th>{{ article.terms|length }}</th>
        <th><a href="https://rummagene.com/term-search?page=1&q={{ article.pmc }}">Link</a></th>
      </tr>
      {%- endfor %}
    </tbody>
  </table>
  {%- endif %}

  We hope that these links are helpful to advancing your research. Please let us know if you have any questions or concerns.
  {%- endif %}

  Sincerely,

  Members of the Ma'ayan Lab
  Mount Sinai Center for Bioinformatics
  Icahn School of Medicine at Mount Sinai
  New York, NY 10029 USA
''').strip())

@cli.command()
@click.option('-i', '--input', type=click.Path(exists=True, file_okay=True, path_type=Path), help='progress file to make emails from')
def compose_emails(input: Path | str):
  df_progress = pd.read_csv(input, sep='\t', header=None, converters={0:lambda s: s, 1:json.loads})
  df_progress['pmc'] = df_progress[0].apply(lambda f: f.rpartition('/')[-1].partition('.')[0])
  df_progress = pd.concat([df_progress['pmc'], df_progress[1].apply(pd.Series)], axis=1).dropna(subset=['email'])
  df_progress = df_progress[df_progress['corresp']]
  email_article_authors = df_progress.groupby('email').agg({
    'pmc': list, 'article_title': list, 'journal_title': list, 'surname': 'first', 'given_name': 'first', 'terms': list,
  })
  email_article_authors['articles'] = email_article_authors.apply(lambda r: [
    dict(pmc=pmc, article_title=article_title, journal_title=journal_title, terms=terms)
    for pmc, article_title, journal_title, terms in zip(r['pmc'], r['article_title'], r['journal_title'], r['terms'])
  ], axis=1)
  email_article_authors = email_article_authors.drop(['pmc', 'article_title', 'journal_title'], axis=1)
  email_article_authors['journals'] = email_article_authors['articles'].apply(lambda A: sorted({a['journal_title'] for a in A}))
  for email, record in email_article_authors.iterrows():
    print(
      email_template.render(**record.to_dict(), email=email, **ctx),
      end='\n\n\n=====\n\n\n',
    )
