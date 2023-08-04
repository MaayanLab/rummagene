'use client'
import React from 'react'
import client from '@/lib/apollo-client'
import { useGeneSetLibraryGeneSearchQuery } from "@/graphql"
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
  const [genes, setGenes] = React.useState(ensureArray(searchParams.q)[0] ?? '')
  const { data } = useGeneSetLibraryGeneSearchQuery({ client, variables: {
    genes: ensureArray(searchParams.q)
  } })
  return (
    <>
      <form
        onSubmit={evt => {
          evt.preventDefault()
          router.push(`/gene-search?q=${genes}`, {
            scroll: false,
          })
        }}
      >
        Gene: <input
          type="text"
          value={genes}
          onChange={evt => {
            setGenes(evt.currentTarget.value)
          }}
        />
        <button
          type="submit"
          className="btn"
        >Find knowledge</button>
      </form>
      <ul>
        {data?.geneSetLibraries?.nodes
          .filter(geneSetLibrary => geneSetLibrary.geneSearch.nodes.length > 0)
          .map((geneSetLibrary, i) => (
            <div key={i} className="collapse collapse-plus">
              <input type="checkbox" /> 
              <div className="collapse-title text-xl font-medium">
                {geneSetLibrary.name} ({geneSetLibrary.geneSearch.nodes.length})
              </div>
              <div className="collapse-content"> 
                <ul>
                  {geneSetLibrary.geneSearch.nodes.map((geneSet, j) => (
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
