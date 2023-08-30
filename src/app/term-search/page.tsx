'use client'
import React from 'react'
import { useSuspenseQuery } from '@apollo/experimental-nextjs-app-support/ssr'
import { GeneSetLibraryTermSearchDocument, GeneSetLibraryTermSearchQuery } from '@/graphql'
import ensureArray from '@/utils/ensureArray'
import { useRouter } from 'next/navigation'
import TermTable from '@/components/termTable'
import Image from 'next/image'

function TermSearchResults({ terms }: { terms: string[] }) {
  const { data } = useSuspenseQuery<GeneSetLibraryTermSearchQuery>(GeneSetLibraryTermSearchDocument, {
    variables: {
      terms,
      first: 1000
    }
  })

  return (
    <ul>
      {data?.geneSetLibraries?.nodes
        .filter(geneSetLibrary => geneSetLibrary.termSearchCount.nodes.length > 0)
        .map((geneSetLibrary, i) => (
          <div key={i} className="collapse collapse-plus">
            <input type="checkbox" />
            <div className="collapse-title text-xl font-medium">
              Matching gene sets {geneSetLibrary.name} ({geneSetLibrary.termSearchCount.totalCount})
            </div>
            <div className="collapse-content">
            <TermTable terms={geneSetLibrary.termSearchCount.nodes}></TermTable>
              </div>
            </div>
        )) ?? null}
    </ul>
  )
}

export default function TermSearchPage({
  searchParams
}: {
  searchParams: {
    q: string | string[] | undefined
  },
}) {
  const router = useRouter()
  const terms = React.useMemo(() =>
    ensureArray(searchParams.q).flatMap(el => el.split(/\s+/g)),
    [searchParams.q])
  const [rawTerms, setRawTerms] = React.useState(terms.join(' '))
  return (
    <>
      <form
        className="flex flex-row items-center gap-2"
        onSubmit={evt => {
          evt.preventDefault()
          router.push(`/term-search?q=${encodeURIComponent(rawTerms)}`, {
            scroll: false,
          })
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
      </form>
      <React.Suspense fallback={<div className="text-center p-5"><Image className={'rounded mx-auto'} src={'/images/loading.gif'} width={125} height={250} alt={'Loading...'}/> </div>}>
        <TermSearchResults terms={terms} />
      </React.Suspense>
    </>
  )
}
