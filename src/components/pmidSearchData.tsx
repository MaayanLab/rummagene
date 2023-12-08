import React from 'react'
import { GetPmidInfoDocument, GetPmidInfoQuery } from '@/graphql';
import { useSuspenseQuery } from '@apollo/client';
import PmidTable from './pmidTable';
import Loading from './loading';

export default function PmidSearchData({ pmid_terms, pmids, gene_set_ids}: 
  { pmid_terms?: Map<string, string[]>, pmids?: (string | null | undefined)[], gene_set_ids?: Map<string, [any, number, any]>}) {

  const { data: pmcMeta } = useSuspenseQuery<GetPmidInfoQuery>(GetPmidInfoDocument, {
    variables: { pmids: pmids },
  })

  if (pmcMeta.getPbMetaByIds?.nodes == undefined) return <>Error Fetching PubMed data from database.</>
  if (pmcMeta.getPbMetaByIds?.nodes?.length < 1) return <>PubMed data not found in database.</>

  return (
    <React.Suspense fallback={<Loading/>}>
      <PmidTable data={pmcMeta.getPbMetaByIds?.nodes} terms={pmid_terms} gene_set_ids={gene_set_ids}></PmidTable>
    </React.Suspense>
  )
}
