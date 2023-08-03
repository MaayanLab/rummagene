'use client'
import client from '@/lib/apollo-client'
import { useEnrichmentQueryQuery, useFetchUserGeneSetQuery } from "@/graphql"
import ensureArray from "@/utils/ensureArray"
import classNames from 'classnames'

export default function Enrich({
  searchParams
}: {
  searchParams: {
    dataset: string | string[] | undefined
  },
}) {
  const dataset = ensureArray(searchParams.dataset)[0]
  const { data: userGeneSet, loading: userGeneSetLoading } = useFetchUserGeneSetQuery({
    client,
    skip: !dataset,
    variables: { id: dataset },
  })
  const { data: enrichmentResults, loading: enrichmentResultsLoading } = useEnrichmentQueryQuery({
    client,
    skip: !userGeneSet?.userGeneSet?.genes,
    variables: {
      genes: ensureArray(userGeneSet?.userGeneSet?.genes).filter((gene): gene is string => !!gene).map(gene => gene.toUpperCase()),
    }
  })
  return (
    <>
      <div className="flex flex-row gap-2">
        <span className="prose">Description</span>
        <span className="prose underline cursor-pointer">{userGeneSet?.userGeneSet?.description || 'Gene set'} ({userGeneSet?.userGeneSet?.genes?.length ?? '?'} genes)</span>
      </div>
      <progress className={classNames("progress w-full", { 'hidden': !userGeneSetLoading && !enrichmentResultsLoading })}></progress>
      <div className="flex flex-row flex-wrap">
        {enrichmentResults?.geneSetLibraries?.nodes.map((geneSetLibrary, i) => (
          <div key={i} className="card">
            <div className="card-body">
              <h2 className="card-title">
                {geneSetLibrary.name}
              </h2>
              <table className="table table-xs">
                <thead>
                  <tr>
                    <th>Term</th>
                    <th>Overlap</th>
                    <th>Odds</th>
                    <th>PValue</th>
                    <th>AdjPValue</th>
                  </tr>
                </thead>
                <tbody>
                  {geneSetLibrary.enrichLibraryBackground.nodes.map((enrichmentResult, j) => (
                    <tr key={j}>
                      <th>{enrichmentResult.geneSet?.term ?? null}</th>
                      <td className="text-underline cursor-pointer">{enrichmentResult.overlapGenes.nodes.length}</td>
                      <td>{enrichmentResult.oddsRatio?.toPrecision(3)}</td>
                      <td>{enrichmentResult.pvalue?.toPrecision(3)}</td>
                      <td>{enrichmentResult.adjPvalue?.toPrecision(3)}</td>
                    </tr>
                  ))}
                  <tr></tr>
                </tbody>
              </table>
              <p></p>
            </div>
          </div>
        )) ?? null}
      </div>
    </>
  )
}