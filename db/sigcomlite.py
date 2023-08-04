def fishers_exact(
  ids: list[str],
  a: list[int],
  b: list[int],
  c: list[int],
  d: list[int],
  n: int,
  fdr: float = 0.05,
  pvalue_less_than: float = 0.05,
  adj_pvalue_less_than: float = 0.05,
):
  import fisher
  import numpy as np
  import statsmodels.stats.multitest

  _left_side, pvalues, _two_sided = fisher.pvalue_npy(
    np.array(a, dtype=np.uint), np.array(b, dtype=np.uint),
    np.array(c, dtype=np.uint), np.array(d, dtype=np.uint),
  )
  if len(pvalues) < n:
    # we do not have all values, assume the rest are insignificant
    #  so we have the right number of p-values for multiple hypothesis testing correction
    pvalues = np.concatenate([pvalues, np.ones(n - len(pvalues))])
  try:
    _reject, adj_pvalues, _alphacSidak, _alphacBonf = statsmodels.stats.multitest.multipletests(
      pvalues,
      fdr,
      'fdr_bh',
    )
    adj_pvalues = np.nan_to_num(adj_pvalues, nan=1.0)
  except:
    adj_pvalues = np.ones(len(pvalues))
  pvalues = np.nan_to_num(pvalues, nan=1.0)
  for i, id in enumerate(ids):
    if pvalues[i] <= pvalue_less_than and adj_pvalues[i] <= adj_pvalue_less_than:
      yield dict(
        id=id,
        pvalue=pvalues[i],
        adj_pvalue=adj_pvalues[i],
      )
