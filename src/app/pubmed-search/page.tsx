'use client'
import React from 'react'
import useSWR from 'swr'
import { useTermsPmcsQuery } from '@/graphql'
import PmcSearchColumns from '@/components/pmcSearchData'
import Image from 'next/image'
import Loading from '@/components/loading'
import { useQsState } from '@/utils/useQsState'
import HomeLayout from '@/app/homeLayout'
import Stats from '../stats'


interface esearchResult {
  count: string
  idlist: string[]
}

interface eutilsResult {
  header: Object
  esearchresult: esearchResult
}

async function pubmed_search(search: string) {
  const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pmc&term=${search}&sort=relevance&retmode=json&retmax=5000`
  const res = await fetch(url)
  const data: eutilsResult = await res.json()
  return data
}

function PubMedSearchResults({ search }: { search: string }) {
  const { data: pmcData, error, isLoading } = useSWR(() => search, pubmed_search)
  const pmcids = React.useMemo(() => pmcData?.esearchresult?.idlist?.map(id => 'PMC' + id.toString()) ?? [], [pmcData])
  const pmcCount = React.useMemo(() => pmcData?.esearchresult?.count !== undefined ? Number(pmcData?.esearchresult?.count) : 0, [pmcData])
  const { data } = useTermsPmcsQuery({
    skip: pmcids.length === 0,
    variables: { pmcids }
  })
  const pmcsInDb = React.useMemo(() => data?.termsPmcsCount?.nodes ? Array.from(new Set(data?.termsPmcsCount?.nodes?.map((el) => el?.pmc))) : undefined, [data])
  const { pmc_terms, gene_set_ids } = React.useMemo(() => {
    const pmc_terms = new Map<string, string[]>()
    const gene_set_ids = new Map<string, string[]>()
    data?.termsPmcsCount?.nodes?.forEach(el => {
      if (!el || !el.term) return
      if (el.pmc) {
        if (!pmc_terms.has(el.pmc)) {
          pmc_terms.set(el.pmc, [el.term])
        } else {
          pmc_terms.get(el.pmc)?.push(el.term)
        }
      }
      if (el.id) {
        gene_set_ids.set(el.term, [el.id, el.count])
      }
    })
    return { pmc_terms, gene_set_ids }
  }, [data])
  if (error) return <div className="text-center p-5"><div className="text-center"><Image className={'rounded mx-auto'} src={'/images/loading.gif'} width={125} height={250} alt={'Loading...'} /> </div>Failed to fetch articles from PubMed Central... trying again in a few seconds.</div>
  if (isLoading) return <Loading/>
  if (!pmcData?.esearchresult?.idlist || !pmcsInDb) return null
  if (pmcsInDb.length < 1) return <div className="text-center p-5">Your query returned {Intl.NumberFormat("en-US", {}).format(pmcCount)} articles, but none of them are contained in the Rummagene database. Please try refining your query.</div>
  return (
    <div className="flex flex-col gap-2 my-2">
      <h2 className="text-md font-bold">
        Your query returned {Intl.NumberFormat("en-US", {}).format(pmcCount)} articles from PubMed Central, after rummaging through <Stats show_gene_sets />, Rummagene <Image className="inline-block rounded" src="/images/rummagene_logo.png" width={50} height={100} alt="Rummagene"></Image> found {Intl.NumberFormat("en-US", {}).format(pmcsInDb.length)} {pmcCount > 5000 ? <>of the top 5000</> : null} gene sets.
      </h2>
      <PmcSearchColumns pmc_terms={pmc_terms} pmcs={pmcsInDb} gene_set_ids={gene_set_ids}></PmcSearchColumns>
    </div>
  )
}

const examples = [
  'type 2 diabetes',
  'STAT3 knockout',
  'erythrocyte',
]

export default function PubMedSearchPage() {
  const [rawSearch, setRawSearch] = React.useState('')
  const [search, setSearch] = useQsState('q', '')
  React.useEffect(() => setRawSearch(search), [search])
  if (!search) {
    return (
      <HomeLayout>
        <h1 className="text-xl">Query PubMed Central and receive gene sets extracted from the returned paper</h1>
        <form
          className="flex flex-col items-center gap-2 mt-5"
          onSubmit={evt => {
            evt.preventDefault()
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
          />
          <button
            type="submit"
            className="btn normal-case"
          >Search PMC</button>
        </form>
        <p className="prose p-2">
          try an example:&nbsp;
          {examples.flatMap((example, i) => [
            i > 0 ? <React.Fragment key={i}>, </React.Fragment> : null,
            <a
              key={example}
              className="font-bold text-sm cursor-pointer"
              onClick={() => {setSearch(example)}}
            >{example}</a>
          ])}
        </p>
      </HomeLayout>
    )
  } else {
    return (
      <>
        <div className='flex-col'>
          <form
            className="flex flex-row items-center gap-2 mt-5"
            onSubmit={evt => {
              evt.preventDefault()
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
            />
            <button
              type="submit"
              className="btn normal-case"
            >Search PMC</button>
            <div className='ml-10'>Query PubMed Central and receive gene sets extracted from the returned papers.</div>
          </form>
          <p className="prose p-2">
            try an example:&nbsp;
            {examples.flatMap((example, i) => [
              i > 0 ? <React.Fragment key={i}>, </React.Fragment> : null,
              <a
                key={example}
                className="font-bold text-sm cursor-pointer"
                onClick={() => {setSearch(example)}}
              >{example}</a>
            ])}
          </p>
        </div>
        {search ? <PubMedSearchResults search={search} /> : null}
      </>
    )
  }
}
