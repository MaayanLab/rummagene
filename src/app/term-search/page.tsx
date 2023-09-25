'use client'
import React from 'react'
import { useTermSearchQuery } from '@/graphql'
import TermTable from '@/components/termTable'
import Image from 'next/image'
import { useQsState } from '@/utils/useQsState'
import HomeLayout from '@/app/homeLayout'

function TermSearchResults({ terms }: { terms: string }) {
  const { data } = useTermSearchQuery({
    variables: {
      terms,
      first: 10000
    }
  })
  if (!data) {
    return (
      <>
        <Image className={'rounded mx-auto'} src={'/images/loading.gif'} width={125} height={250} alt={'Loading...'} />
        <p>Rummaging for gene sets with your search term.</p>
      </>
    )
  }
  return (
    <div className='text-center mt-5'>
      <p className='text-lg'> Your search term is contained in {data.geneSetTermSearch?.totalCount} gene sets.</p>
      <TermTable terms={data.geneSetTermSearch?.nodes}></TermTable>
    </div>
  )
}

const examples = [
  'neuron',
  'CRISPR',
  'PBMC',
]

export default function TermSearchPage() {
  const [terms, setTerms] = useQsState('q', '')
  const [rawTerms, setRawTerms] = React.useState('')
  React.useEffect(() => {setRawTerms(terms)}, [terms])
  if (!terms) {
    return (
      <HomeLayout>
        <h1 className="text-xl">Query extracted gene set table titles to find relevant gene sets</h1>
        <form
          className="flex flex-col items-center gap-2 mt-5"
          onSubmit={evt => {
            evt.preventDefault()
            setTerms(rawTerms)
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
        <p className="prose p-2">
          try an example:&nbsp;
          {examples.flatMap((example, i) => [
            i > 0 ? <React.Fragment key={i}>, </React.Fragment> : null,
            <a
              key={example}
              className="font-bold text-sm cursor-pointer"
              onClick={() => {setTerms(example)}}
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
          className="flex flex-row items-center gap-2"
          onSubmit={evt => {
            evt.preventDefault()
            setTerms(rawTerms)
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
        <div className='ml-10'> Query extracted gene set table titles to find relevant gene sets.</div>
        </form>
        <p className="prose p-2">
          try an example:&nbsp;
          {examples.flatMap((example, i) => [
            i > 0 ? <React.Fragment key={i}>, </React.Fragment> : null,
            <a
              key={example}
              className="font-bold text-sm cursor-pointer"
              onClick={() => {setTerms(example)}}
            >{example}</a>
          ])}
        </p>
        </div>
        {terms ? <TermSearchResults terms={terms} /> : null}
      </>
    )
  }
}
