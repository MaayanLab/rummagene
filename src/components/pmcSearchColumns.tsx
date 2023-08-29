import React from 'react'
import useSWR, { Fetcher } from 'swr'
import { GetPmcInfoByIdsDocument, GetPmcInfoByIdsQuery } from '@/graphql';
import {TermsPmcsDocument, TermsPmcsQuery} from '@/graphql';
import { useSuspenseQuery } from '@apollo/client';
import PmcTable from './pmcTable';

interface esearchResult {
  count: string;
  idlist: string[];
}

interface eutilsResult {
  header: Object;
  esearchresult: esearchResult;
}

const fetcher: Fetcher<eutilsResult> = async (endpoint: string) => fetch(endpoint).then(async (res) => {
  const data = await res.json()
  console.log(data)
  return data
})

export default function PmcSearchColumns({ pmc_terms, pmcs, gene_set_ids}: { pmc_terms?: Map<string, string[]>, pmcs?: (string | null | undefined)[], gene_set_ids?: Map<string, string>}) {
  //const pmcMetaData = useSWR(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pmc&retmode=json&id=${id}`, fetcher)

  const { data: pmcMeta } = useSuspenseQuery<GetPmcInfoByIdsQuery>(GetPmcInfoByIdsDocument, {
    variables: { pmcids: pmcs },
  })

  console.log(pmcMeta)

  if (pmcMeta.getPmcInfoByIds?.nodes == undefined) return <></>
  if (pmcMeta.getPmcInfoByIds?.nodes?.length < 1) return <></>


  return (
    <>
      <PmcTable data={pmcMeta.getPmcInfoByIds?.nodes} terms={pmc_terms} gene_set_ids={gene_set_ids}></PmcTable>
    </>
  )
}
