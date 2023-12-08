'use client'
import React from 'react'
import useSWR from 'swr'
import { useQueryPbGeneSetsQuery } from '@/graphql'
import PmidSearchColumns from '@/components/pmidSearchData'
import Image from 'next/image'
import Loading from '@/components/loading'
import useQsState from '@/utils/useQsState'
import HomeLayout from '@/app/homeLayout'

interface esearchResult {
  count: string
  idlist: string[]
}

interface eutilsResult {
  header: Object
  esearchresult: esearchResult
}

async function pubmed_search(search: string) {
  const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${search}&sort=relevance&retmode=json&retmax=5000`
  const res = await fetch(url)
  const data: eutilsResult = await res.json()
  return data
}

function PubMedSearchResults({ search }: { search: string }) {
  const { data: pbData, error, isLoading } = useSWR(() => search, pubmed_search)
  const pbids = React.useMemo(() => pbData?.esearchresult?.idlist?.map(id => id.toString()) ?? [], [pbData])
  const pmidCount = React.useMemo(() => pbData?.esearchresult?.count !== undefined ? Number(pbData?.esearchresult?.count) : 0, [pbData])

  const { data } = useQueryPbGeneSetsQuery({
    skip: pbids.length === 0,
    variables: { pmids: pbids }
  })
  const pmidsInDb = React.useMemo(() => data?.getPbInfoByIds?.nodes ? Array.from(new Set(data?.getPbInfoByIds?.nodes?.map((el) => el?.pmid))) : undefined, [data])
  const { pmid_terms, gene_set_ids } = React.useMemo(() => {
    const pmid_terms = new Map<string, string[]>()
    const gene_set_ids = new Map<string, [any, number, any]>()
    data?.getPbInfoByIds?.nodes?.forEach(el => {
      if (!el || !el.geneSetById?.term) return
      if (el.pmid) {
        if (el.pmid.includes(',')) {
          el.pmid.split(',').forEach((pm) => {
            if (!pmid_terms.has(pm)) {
              if (el) pmid_terms.set(pm, [el?.geneSetById?.term as string])
            } else if (!pmid_terms.get(pm)?.includes(el?.geneSetById?.term  as string)) {
              pmid_terms.get(pm)?.push(el?.geneSetById?.term  as string)
            }
          })
        } else {
        if (!pmid_terms.has(el.pmid)) {
          pmid_terms.set(el.pmid, [el.geneSetById?.term])
        } else if (!pmid_terms.get(el.pmid)?.includes(el.geneSetById?.term)) {
          pmid_terms.get(el.pmid)?.push(el.geneSetById?.term)
        }
      }}
      if (el.id) {
        gene_set_ids.set(el.geneSetById?.term, [el.id, el.geneSetById?.nGeneIds, el.sampleGroups])
      }
    })
    return { pmid_terms, gene_set_ids }
  }, [data])

  if (error) return <div className="text-center p-5"><div className="text-center"><Image className={'rounded mx-auto'} src={'/images/loading.gif'} width={250} height={250} alt={'Loading...'} /> </div>Failed to fetch articles from PubMed... trying again in a few seconds.</div>
  if (isLoading) return <Loading/>
  if (!pbData?.esearchresult?.idlist || !pmidsInDb) return null
  if (pmidsInDb.length < 1) return <div className="text-center p-5">Your query returned {Intl.NumberFormat("en-US", {}).format(pmidCount)} articles, but none of first 5000 articles are associated with gene sets in the Rummageo database. Please try refining your query.</div>
  return (
    <div className="flex flex-col gap-2 my-2">
      <h2 className="text-md font-bold">
        Your query returned {Intl.NumberFormat("en-US", {}).format(pmidCount)} articles from PubMed. {pmidCount > 5000
          ? <>Since there are more than 5,000 papers that match your query, we only display {Intl.NumberFormat("en-US", {}).format(gene_set_ids.size)} gene sets associated with {Intl.NumberFormat("en-US", {}).format(pmid_terms.size)} publications asscociated with gene sets from the first 5,000 publications returned from your query. Please narrow your search to obtain better results.</>
          : <>Rummageo <Image className="inline-block rounded" src="/images/rummageo_logo.png" width={50} height={100} alt="Rummageo"></Image> found {Intl.NumberFormat("en-US", {}).format(gene_set_ids.size)} gene sets associated with {Intl.NumberFormat("en-US", {}).format(pmid_terms.size)} publications returned from your query.</>}
      </h2>
      <PmidSearchColumns pmid_terms={pmid_terms} pmids={pmidsInDb} gene_set_ids={gene_set_ids}></PmidSearchColumns>
    </div>
  )
}

const examples = [
  'mice aging',
  'STAT3 knockout',
  'erythrocyte',
]

export default function PubMedSearchPage() {
  const [rawSearch, setRawSearch] = React.useState('')
  const [queryString, setQueryString] = useQsState({ q: '' })
  React.useEffect(() => setRawSearch(queryString.q ?? ''), [queryString.q])
  if (!queryString.q) {
    return (
      <HomeLayout>
        <h1 className="text-xl">Query PubMed and receive gene sets associated with the returned papers</h1>
        <form
          className="flex flex-col items-center gap-4"
          onSubmit={evt => {
            evt.preventDefault()
            setQueryString({ q: rawSearch })
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
              onClick={() => {setQueryString({ q: example })}}
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
              setQueryString({ q: rawSearch })
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
              className="btn normal-case bg-neutral-800 bg-opacity-30"
            >Search PubMed</button>
            <div className='ml-10'>Query PubMed and receive gene sets created from GEO entries associated with returned papers.</div>
          </form>
          <p className="prose p-2">
            try an example:&nbsp;
            {examples.flatMap((example, i) => [
              i > 0 ? <React.Fragment key={i}>, </React.Fragment> : null,
              <a
                key={example}
                className="font-bold text-sm cursor-pointer"
                onClick={() => {setQueryString({ q: example })}}
              >{example}</a>
            ])}
          </p>
        </div>
        {queryString.q ? <PubMedSearchResults search={queryString.q} /> : null}
      </>
    )
  }
}
