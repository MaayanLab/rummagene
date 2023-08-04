'use client'
import React from 'react'
import { useSuspenseQuery } from '@apollo/experimental-nextjs-app-support/ssr'
import { GeneSetLibraryTermSearchDocument, GeneSetLibraryTermSearchQuery } from '@/graphql'
import ensureArray from '@/utils/ensureArray'
import { useRouter } from 'next/navigation'
import LinkedTerm from '@/components/linkedTerm'

function TermSearchResults({ terms }: { terms: string[] }) {
  const { data } = useSuspenseQuery<GeneSetLibraryTermSearchQuery>(GeneSetLibraryTermSearchDocument, {
    variables: {
      terms
    }
  })
  return (
    <ul>
      {data?.geneSetLibraries?.nodes
        .filter(geneSetLibrary => geneSetLibrary.termSearch.nodes.length > 0)
        .map((geneSetLibrary, i) => (
          <div key={i} className="collapse collapse-plus">
            <input type="checkbox" /> 
            <div className="collapse-title text-xl font-medium">
              {geneSetLibrary.name} ({geneSetLibrary.termSearch.totalCount})
            </div>
            <div className="collapse-content"> 
              <ul>
                {geneSetLibrary.termSearch.nodes.map((geneSet, j) => (
                  <li key={j}>
                    <LinkedTerm term={geneSet.term} />
                  </li>
                ))}
              </ul>
            </div>
          </div>
      )) ?? null}
    </ul>
  )
}

export default function GeneSearchPage({
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
    <div className="mx-64">
      <form
        onSubmit={evt => {
          evt.preventDefault()
          router.push(`/term-search?q=${encodeURIComponent(rawTerms)}`, {
            scroll: false,
          })
        }}
      >
        Term: <input
          type="text"
          value={rawTerms}
          onChange={evt => {
            setRawTerms(evt.currentTarget.value)
          }}
        />
        <button
          type="submit"
          className="btn"
        >Find knowledge</button>
      </form>
      <React.Suspense fallback={<div className="text-center"><span className="loading loading-ring loading-lg"></span></div>}>
        <TermSearchResults terms={terms} />
      </React.Suspense>
    </div>
  )
}
