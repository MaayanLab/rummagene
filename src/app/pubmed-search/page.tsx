'use client'
import React from 'react'
import ensureArray from '@/utils/ensureArray'
import { useRouter } from 'next/navigation'
import useSWR, { Fetcher } from 'swr'
import LinkedTerm from '@/components/linkedTerm'
import { usePmCsQuery } from '@/graphql'


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


async function PubMedSearchResults({ pmcData, isLoading, error}:
  { pmcData: eutilsResult | undefined, isLoading: boolean, error: any}) {

  if (error) return <div className="text-center p-5">Failed to fetch articles from PubMed Central... trying again in a few seconds.<div className="text-center"><span className="loading loading-ring loading-lg"></span></div></div>
  if (isLoading) return <div className="text-center p-5"><span className="loading loading-ring loading-lg"></span></div>

  const data = usePmCsQuery({ nextFetchPolicy: 'standby' })
  console.log(data)
  const pmcsInDb = data?.data?.pmcs?.nodes.map((el: { pmc: string }) => el?.pmc?.replace(/[A-Z]/g, '')) || ['']
  const pmcsReturned = pmcData?.esearchresult?.idlist?.filter(el => pmcsInDb.includes(el))

  if (!pmcsReturned) return <></>
  if (pmcsReturned?.length < 1) return <div>Your query returned {pmcData?.esearchresult?.count} articles, but none are contained in the Rummagene database.</div>

  console.log(pmcsReturned)
  return (
    <div className="overflow-x-auto">
      <table className="table table-xs table-pin-rows table-pin-cols">
        <thead>
          <tr>
            <td>PMC</td>
          </tr>
        </thead>
        <tbody>
          {pmcsReturned?.map((id) => (
            <tr key={id}>
              <td><LinkedTerm term={`PMC${id} `}></LinkedTerm></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>)
}

export default function PubMedSearchPage({ searchParams }: {
  searchParams: {
    q: string | string[] | undefined
  }}) {
  const router = useRouter()

  const searchTerms = React.useMemo(() =>
    ensureArray(searchParams.q).flatMap(el => el.split(/\s+/g)),
    [searchParams.q])
  const [rawSearch, setRawSearch] = React.useState(searchTerms.join(' '))
  const [search, setSearch] = React.useState(searchTerms.join(' '))
  const { data, error, isLoading } = useSWR(() =>
    `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pmc&term=${rawSearch}&retmode=json&retmax=99999`, fetcher
  )

  return (
    <>
      <form
        className="flex flex-row items-center gap-2"
        onSubmit={evt => {
          evt.preventDefault()
          router.push(`/pubmed-search?q=${encodeURIComponent(rawSearch)}`, {
            scroll: false,
          })
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
            console.log(evt.currentTarget.value)
            console.log(search)
            setSearch(evt.currentTarget.value)
          }}
        />
        <button
          type="submit"
          className="btn normal-case"
        >Search PubMed Central</button>
      </form>
        <React.Suspense fallback={<div className="text-center"><span className="loading loading-ring loading-lg"></span></div>}>
          <PubMedSearchResults pmcData={data} isLoading={isLoading} error={error}/>
        </React.Suspense>
    </>
  )
}
