'use client'
import React from 'react'
import ensureArray from '@/utils/ensureArray'
import { useRouter } from 'next/navigation'
import useSWR, { Fetcher } from 'swr'
import { TermsPmcsDocument, TermsPmcsQuery } from '@/graphql';
import { useSuspenseQuery } from '@apollo/client'
import PmcSearchColumns from '@/components/pmcSearchData'
import Image from 'next/image'


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
  return data
})


function PubMedSearchResults({ pmcData, isLoading, error, search }:
  { pmcData: eutilsResult | undefined, isLoading: boolean, error: any, search: string }) {

  const { data } = useSuspenseQuery<TermsPmcsQuery>(TermsPmcsDocument, {
    variables: { pmcids: pmcData?.esearchresult?.idlist?.map(id => 'PMC' + id.toString()) || [] },
  })

  if (search.length == 0) return <></>

  var pmcsInDb: Set<string | undefined | null>;

  pmcsInDb = new Set(data?.termsPmcsCount?.nodes?.map((el) => el?.pmc))

  if (error) return <div className="text-center p-5"><div className="text-center"><Image className={'rounded mx-auto'} src={'/images/loading.gif'} width={125} height={250} alt={'Loading...'} /> </div>Failed to fetch articles from PubMed Central... trying again in a few seconds.</div>

  if (isLoading) return (
    <div className="text-center p-5">
      <Image className={'rounded mx-auto'} src={'/images/loading.gif'} width={125} height={250} alt={'Loading...'} />
      <p>Fetching articles from PubMed Central and Rummaging for gene sets.</p>
    </div>)

  if (!pmcData?.esearchresult?.idlist) return <></>

  if (pmcsInDb?.size < 1) return <div className="text-center p-5">Your query returned {Intl.NumberFormat("en-US", {}).format(Number(pmcData?.esearchresult?.count))} articles, but none of the top 5000 are contained in the Rummagene database. Please try refining your query.</div>

  var pmc_terms = new Map<string, string[]>();
  data?.termsPmcsCount?.nodes?.forEach((el: any) => {
    if (!(el?.pmc) || !(el?.term)) return;
    else if (!pmc_terms.has(el?.pmc)) {
      pmc_terms.set(el?.pmc, [el?.term])
    } else {
      pmc_terms.set(el.pmc, (pmc_terms.get(el.pmc) as string[]).concat([el.term]))
    }
  })

  var gene_set_ids = new Map<string, string[]>();
  data?.termsPmcsCount?.nodes?.forEach((el: any) => {
    if (!(el?.id) || !(el?.term)) return;
    gene_set_ids.set(el?.term, [el?.id, el?.count])
  })

  return (
    <>
      <div className='p-5 text-center'>The top 5000 results from your query identified {Intl.NumberFormat("en-US", {}).format(pmcsInDb?.size)} articles which have extracted gene sets in the Rummagene database.</div>
      <PmcSearchColumns pmc_terms={pmc_terms} pmcs={Array.from(pmcsInDb)} gene_set_ids={gene_set_ids}></PmcSearchColumns>
    </>)
}

export default function PubMedSearchPage({ searchParams }: {
  searchParams: {
    q: string | string[] | undefined
  }
}) {
  const router = useRouter()

  const searchTerms = React.useMemo(() =>
    ensureArray(searchParams.q).flatMap(el => el.split(/\s+/g)),
    [searchParams.q])
  const [rawSearch, setRawSearch] = React.useState(searchTerms.join(' '))
  const [search, setSearch] = React.useState(searchTerms.join(' '))
  const { data, error, isLoading } = useSWR(() =>
    `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pmc&term=${search}&sort=relevance&retmode=json&retmax=5000`, fetcher
  )

  return (
    <>
      <div className='flex-col'>
        <form
          className="flex flex-row items-center gap-2 mt-5"
          onSubmit={evt => {
            evt.preventDefault()
            router.push(`/pubmed-search?q=${encodeURIComponent(rawSearch)}`, {
              scroll: false,
            })
            setSearch(rawSearch)
          }}
        >
          <span className="label-text text-lg">Search Term(s)</span>
          <input
            type="text"
            className="input input-bordered"
            placeholder="type 2 diabetes"
            value={rawSearch}
            onChange={evt => {
              setRawSearch(evt.currentTarget.value)
            }}
            onSubmit={evt => {
              setSearch(rawSearch)
            }}
          />
          <button
            type="submit"
            className="btn normal-casewe"
          >Search PMC</button>
          <div className='ml-10'> Query PubMed Central and recieve gene sets extracted from the returned papers.</div>
        </form>
        <p className="prose p-2">
          try an example:
          <a
            className="font-bold text-sm cursor-pointer"
            onClick={() => {
              setRawSearch('type 2 diabetes')
              setSearch('type 2 diabetes')
            }}
          > type 2 diabetes</a>,
          <a
            className="font-bold text-sm cursor-pointer"
            onClick={() => {
              setRawSearch('STAT3 knockout')
              setSearch('STAT3 knockout')
            }}
          > STAT3 knockout</a>,
          <a
            className="font-bold text-sm cursor-pointer"
            onClick={() => {
              setRawSearch('erythrocyte')
              setSearch('erythrocyte')
            }}
          > erythrocyte</a>
        </p>
      </div>
      <PubMedSearchResults pmcData={data} isLoading={isLoading} error={error} search={search} />
    </>
  )
}

