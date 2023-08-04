'use client'
import React from 'react'
import { useSuspenseQuery } from '@apollo/experimental-nextjs-app-support/ssr'
import { GeneSetLibraryGeneSearchDocument, GeneSetLibraryGeneSearchQuery } from '@/graphql'
import ensureArray from '@/utils/ensureArray'
import { useRouter } from 'next/navigation'
import LinkedTerm from '@/components/linkedTerm'

function GeneSearchResults({ genes }: { genes: string[] }) {
  const { data } = useSuspenseQuery<GeneSetLibraryGeneSearchQuery>(GeneSetLibraryGeneSearchDocument, {
    variables: {
      genes
    }
  })
  return (
    <ul>
      {data?.geneSetLibraries?.nodes
        .filter(geneSetLibrary => geneSetLibrary.geneSearch.nodes.length > 0)
        .map((geneSetLibrary, i) => (
          <div key={i} className="collapse collapse-plus">
            <input type="checkbox" /> 
            <div className="collapse-title text-xl font-medium">
              {geneSetLibrary.name} ({geneSetLibrary.geneSearch.totalCount})
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
  const genes = React.useMemo(() =>
    ensureArray(searchParams.q).flatMap(el => el.split(/\s+/g)),
  [searchParams.q])
  const [rawGenes, setRawGenes] = React.useState(genes.join(' '))
  return (
    <>
      <form
        className="flex flex-row items-center gap-2"
        onSubmit={evt => {
          evt.preventDefault()
          router.push(`/gene-search?q=${encodeURIComponent(rawGenes)}`, {
            scroll: false,
          })
        }}
      >
        <span className="label-text text-lg">Gene</span>
        <input
          type="text"
          className="input input-bordered"
          placeholder="STAT3"
          value={rawGenes}
          onChange={evt => {
            setRawGenes(evt.currentTarget.value)
          }}
        />
        <button
          type="submit"
          className="btn normal-case"
        >Search gene sets</button>
      </form>
      <React.Suspense fallback={<div className="text-center"><span className="loading loading-ring loading-lg"></span></div>}>
        <GeneSearchResults genes={genes} />
      </React.Suspense>
    </>
  )
}
