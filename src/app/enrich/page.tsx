'use client'
import React from 'react'
import classNames from 'classnames'
import client from '@/lib/apollo-client'
import { useEnrichmentQueryQuery, useFetchUserGeneSetQuery } from "@/graphql"
import ensureArray from "@/utils/ensureArray"
import LinkedTerm from '@/components/linkedTerm'

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
  const [modelGeneSet, setModelGeneSet] = React.useState<{ description: string, genes: string[] }>()
  return (
    <>
      <div className="flex flex-row gap-2 alert">
        <span className="prose">Description:</span>
        <label
          htmlFor="geneSetModal"
          className="prose underline cursor-pointer"
          onClick={evt => {
            setModelGeneSet({
              genes: (userGeneSet?.userGeneSet?.genes ?? []).filter((gene): gene is string => !!gene),
              description: userGeneSet?.userGeneSet?.description || 'Gene set',
            })
          }}
        >{userGeneSet?.userGeneSet?.description || 'Gene set'} ({userGeneSet?.userGeneSet?.genes?.length ?? '?'} genes)</label>

      </div>
      <progress className={classNames("progress w-full", { 'hidden': !userGeneSetLoading && !enrichmentResultsLoading })}></progress>
      <div className="flex flex-row flex-wrap">
        {enrichmentResults?.geneSetLibraries?.nodes.map((geneSetLibrary, i) => (
          <div key={i} className="collapse collapse-arrow">
            <input type="checkbox" defaultChecked /> 
            <h2 className="collapse-title text-xl font-medium">
              {geneSetLibrary.name}
            </h2>
            <div className="collapse-content overflow-x-auto">
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
                      <th><LinkedTerm term={enrichmentResult.geneSet?.term} /></th>
                      <td className="whitespace-nowrap text-underline cursor-pointer">
                        <label
                          htmlFor="geneSetModal"
                          className="prose underline cursor-pointer"
                          onClick={evt => {
                            setModelGeneSet({
                              genes: enrichmentResult.overlapGenes.nodes.map(gene => gene.symbol) ?? [],
                              description: enrichmentResult.geneSet?.term ?? '',
                            })
                          }}
                        >{enrichmentResult.overlapGenes.nodes.length}</label>
                      </td>
                      <td className="whitespace-nowrap">{enrichmentResult.oddsRatio?.toPrecision(3)}</td>
                      <td className="whitespace-nowrap">{enrichmentResult.pvalue?.toPrecision(3)}</td>
                      <td className="whitespace-nowrap">{enrichmentResult.adjPvalue?.toPrecision(3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )) ?? null}
      </div>
      <input
        type="checkbox"
        id="geneSetModal"
        className="modal-toggle"
        onChange={evt => {
          if (!evt.currentTarget.checked) {
            setModelGeneSet(undefined)
          }
        }}
      />
      <div className="modal">
        <div className="modal-box">
          <h3 className="text-lg font-bold">
            <LinkedTerm term={modelGeneSet?.description} />
          </h3>
          <textarea
            className="w-full"
            readOnly
            rows={8}
            value={modelGeneSet?.genes.join('\n') ?? ''}
          />
        </div>
        <label className="modal-backdrop" htmlFor="geneSetModal">Close</label>
      </div>
    </>
  )
}