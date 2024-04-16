import json
import click
import pandas as pd
import jinja2
from pathlib import Path
from textwrap import dedent
from tqdm import tqdm
from helper.cli import cli

email_template = jinja2.Template(dedent('''
  To: {{ email }}
  Subject: We found a gene set in your recent paper

  Dear Dr. {{ surname }},

  Congratulations for your recent publication{% if articles|length > 1 %}s{% endif %} in {% for article in articles %}{% if loop.index > 0 %}, {% endif %}{{article.journal_title}}{% endfor %}.

  We crawled the tables & supporting materials and found unique gene set(s) that were added to Rummagene.

  {% for article in articles %}
  - {{ article.article_title }} in {{ article.journal_title }}
  {% endfor %}

  You can further analyze the gene set(s) by submitting them for enrichment analysis with the following tools:

  <a href="https://rummagene.com/gene_set/{props['gene_set_id']}/submit/rummagene">Rummagene</a> - find gene sets in other papers' supporting materials that are similar to your gene set
  <a href="https://rummagene.com/gene_set/{props['gene_set_id']}/submit/rummageo">RummaGEO</a> - find matching up/down gene sets extracted from the NCBI GEO database similar to your gene set
  <a href="https://rummagene.com/gene_set/{props['gene_set_id']}/submit/enrichr">Enrichr</a> - find similar gene sets in a collection of ~500,000 annotated gene sets
  <a href="https://rummagene.com/gene_set/{props['gene_set_id']}/submit/enrichr-kg">Enrichr-KG</a> - visualize your gene set in the context of prior knowledge about other gene sets
  <a href="https://rummagene.com/gene_set/{props['gene_set_id']}/submit/cfde-gse">CFDE-GSE</a> - explore how your gene set compares with gene sets created from NIH Common Fund datasets
  <a href="https://rummagene.com/gene_set/{props['gene_set_id']}/submit/playbook">Playbook</a> - build a workflow to analyze your gene sets and convert it into publication ready figures with text
  <a href="https://rummagene.com/gene_set/{props['gene_set_id']}/submit/g2sg">G2SG</a> - add your gene set into a workspace where you can combine and compare it to other gene sets

  We hope that you will find these resources useful.

  Sincerely,

  Members of the Ma'ayan Lab
  Mount Sinai Center for Bioinformatics
  Icahn School of Medicine at Mount Sinai
  New York, NY 10029 USA
''').strip())

@cli.command()
@click.option('-i', '--input', type=click.Path(exists=True, file_okay=True, path_type=Path), help='progress file to make emails from')
def compose_emails(progress_file: Path | str):
  df_progress = pd.read_csv(progress_file, sep='\t', header=None)
  df_progress['pmc'] = df_progress[0].apply(lambda f: f.rpartition('/')[-1].partition('.')[0])
  df_progress = pd.concat([df_progress['pmc'], df_progress[1].apply(json.loads).apply(pd.Series)], axis=1).dropna(subset=['email'])
  df_progress = df_progress[df_progress['corresp']]
  email_article_authors = df_progress.groupby('email').agg({
    'pmc': list, 'article_title': list, 'journal_title': list, 'surname': 'first', 'given_name': 'first'
  })
  email_article_authors['articles'] = email_article_authors.apply(lambda r: [
    dict(pmc=pmc, article_title=article_title, journal_title=journal_title)
    for pmc, article_title, journal_title in zip(r['pmc'], r['article_title'], r['journal_title'])
  ], axis=1)
  email_article_authors = email_article_authors.drop(['pmc', 'article_title', 'journal_title'], axis=1)
  for email, record in email_article_authors.iterrows():
    print(email_template.render(dict(record.to_dict(), email=email)))
    break