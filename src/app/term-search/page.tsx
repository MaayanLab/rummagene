'use client'
import React from 'react'
import client from '@/lib/apollo-client'
import { useGeneSetLibraryTermSearchQuery } from "@/graphql"
import ensureArray from '@/utils/ensureArray'
import { useRouter } from 'next/navigation'
import LinkedTerm from '@/components/linkedTerm'

export default function GeneSearchPage({
  searchParams
}: {
  searchParams: {
    q: string | string[] | undefined
  },
}) {
  const router = useRouter()
  const [terms, setTerms] = React.useState(ensureArray(searchParams.q)[0] ?? '')
  const { data } = useGeneSetLibraryTermSearchQuery({ client, variables: {
    terms: ensureArray(searchParams.q)
  } })
  return (
    <>
      <form
        onSubmit={evt => {
          evt.preventDefault()
          router.push(`/term-search?q=${terms}`, {
            scroll: false,
          })
        }}
      >
        Term: <input
          type="text"
          value={terms}
          onChange={evt => {
            setTerms(evt.currentTarget.value)
          }}
        />
        <button
          type="submit"
          className="btn"
        >Find knowledge</button>
      </form>
      <ul>
        {data?.geneSetLibraries?.nodes
          .filter(geneSetLibrary => geneSetLibrary.termSearch.nodes.length > 0)
          .map((geneSetLibrary, i) => (
            <div key={i} className="collapse collapse-plus bg-base-200">
              <input type="checkbox" /> 
              <div className="collapse-title text-xl font-medium">
                {geneSetLibrary.name} ({geneSetLibrary.termSearch.nodes.length})
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
    </>
  )
}
