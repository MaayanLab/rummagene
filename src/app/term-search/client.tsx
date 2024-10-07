'use client'
import React from 'react'
import { useTermSearchQuery } from '@/graphql'
import TermTable from '@/components/termTable'
import Image from 'next/image'
import useQsState from '@/utils/useQsState'
import HomeLayout from '@/app/homeLayout'
import Stats from '../stats'

export function TermSearchResults({ terms }: { terms: string }) {
  const { data } = useTermSearchQuery({
    variables: {
      terms,
      first: 10000
    }
  })
  if (!data) {
    return (
      <>
        <Image className={'rounded mx-auto'} src={'/images/PFOCRummage.gif'} width={125} height={250} alt={'Loading...'} />
        <p>Rummaging through <Stats show_gene_sets /> with your search term.</p>
      </>
    )
  }
  return (
    <div className="flex flex-col gap-2 my-2">
      <h2 className="text-md font-bold">
        After rummaging through <Stats show_gene_sets />. PFOCRummage <Image className="inline-block rounded" src="/images/PFOCRummageBlack.png" width={50} height={100} alt="PFOCRummagene"></Image> found your search term in the table titles of {data.geneSetTermSearchDesc?.totalCount} gene sets.
      </h2>
      {data.geneSetTermSearchDesc?.nodes && data.geneSetTermSearchDesc?.nodes.length > 0 ? <TermTable terms={data.geneSetTermSearchDesc?.nodes}></TermTable> : null}
    </div>
  )
}

const examples = [
  'neuron',
  'adipogenesis',
  'PBMC',
]

export default function TermSearchClientPage(props: { searchParams?: { page?: string, q?: string } }) {
  const [queryString, setQueryString] = useQsState({ page: props.searchParams?.page ?? '1', q: props.searchParams?.q ?? '' })
  const [rawTerms, setRawTerms] = React.useState('')
  React.useEffect(() => {setRawTerms(queryString.q ?? '')}, [queryString.q])
  if (!queryString.q) {
    return (
      <HomeLayout>
        <h1 className="text-xl">Query extracted gene set table titles to find relevant gene sets</h1>
        <form
          className="flex flex-col items-center gap-2"
          onSubmit={evt => {
            evt.preventDefault()
            setQueryString({ page: '1', q: rawTerms })
          }}
        >
          <span className="label-text text-lg">Search Term(s)</span>
          <input
            type="text"
            className="input input-bordered"
            placeholder="neuron"
            value={rawTerms}
            onChange={evt => {
              setRawTerms(evt.currentTarget.value)
            }}
          />
          <button
            type="submit"
            className="btn normal-case"
          >Search gene sets</button>
        </form>
        <p className="prose">
          try an example:&nbsp;
          {examples.flatMap((example, i) => [
            i > 0 ? <React.Fragment key={i}>, </React.Fragment> : null,
            <a
              key={example}
              className="font-bold text-sm cursor-pointer"
              onClick={() => {setQueryString({ page: '1', q: example })}}
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
          className="flex flex-row items-center gap-4"
          onSubmit={evt => {
            evt.preventDefault()
            setQueryString({ page: '1', q: rawTerms })
          }}
        >
          <span className="label-text text-lg">Term</span>
          <input
            type="text"
            className="input input-bordered"
            placeholder="neuron"
            value={rawTerms}
            onChange={evt => {
              setRawTerms(evt.currentTarget.value)
            }}
          />
          <button
            type="submit"
            className="btn normal-case"
          >Search gene sets</button>
        <div> Query extracted gene set table titles to find relevant gene sets.</div>
        </form>
        <p className="prose p-2">
          try an example:&nbsp;
          {examples.flatMap((example, i) => [
            i > 0 ? <React.Fragment key={i}>, </React.Fragment> : null,
            <a
              key={example}
              className="font-bold text-sm cursor-pointer"
              onClick={() => {setQueryString({ page: '1', q: example })}}
            >{example}</a>
          ])}
        </p>
        </div>
        {queryString.q ? <TermSearchResults terms={queryString.q} /> : null}
      </>
    )
  }
}
