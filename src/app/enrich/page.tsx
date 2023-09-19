'use client'
import React from 'react'
import {
  FetchUserGeneSetQuery,
  useEnrichmentQueryQuery,
  useFetchUserGeneSetQuery
} from '@/graphql'
import ensureArray from "@/utils/ensureArray"
import LinkedTerm from '@/components/linkedTerm'
import Loading from '@/components/loading'
import Pagination from '@/components/pagination'
import { useQsState } from '@/utils/useQsState'

const pageSize = 10

function EnrichmentResults({ userGeneSet, setModelGeneSet }: { userGeneSet?: FetchUserGeneSetQuery, setModelGeneSet: any }) {
  const genes = React.useMemo(() =>
    ensureArray(userGeneSet?.userGeneSet?.genes).filter((gene): gene is string => !!gene).map(gene => gene.toUpperCase()),
    [userGeneSet]
  )
  const [page, setPage] = useQsState('page', 1)
  const { data: enrichmentResults } = useEnrichmentQueryQuery({
    skip: genes.length === 0,
    variables: { genes, offset: (page-1)*pageSize, first: pageSize },
  })
  return (
    <div className="flex flex-row flex-wrap">
      {enrichmentResults?.backgrounds?.nodes.map((background, i) => (
        <div key={i} className="collapse collapse-arrow">
          <input type="checkbox" defaultChecked /> 
          <h2 className="collapse-title text-xl font-medium">
            Matching gene sets ({background.enrich?.totalCount})
          </h2>
          <div className="collapse-content overflow-x-auto">
            <table className="table table-xs">
              <thead>
                <tr>
                  <th>Supporting tables containing matching gene sets</th>
                  <th>Overlap</th>
                  <th>Odds</th>
                  <th>PValue</th>
                  <th>AdjPValue</th>
                </tr>
              </thead>
              <tbody>
                {background.enrich?.nodes?.map((enrichmentResult, j) => (
                  <tr key={j}>
                    <th><LinkedTerm term={enrichmentResult?.geneSet?.term} /></th>
                    <td className="whitespace-nowrap text-underline cursor-pointer">
                      <label
                        htmlFor="geneSetModal"
                        className="prose underline cursor-pointer"
                        onClick={evt => {
                          setModelGeneSet({
                            genes: enrichmentResult?.geneSet?.overlap.nodes.map(gene => gene.symbol) ?? [],
                            description: enrichmentResult?.geneSet?.term ?? '',
                          })
                        }}
                      >{enrichmentResult?.geneSet?.overlap.totalCount}</label>
                    </td>
                    <td className="whitespace-nowrap">{enrichmentResult?.oddsRatio?.toPrecision(3)}</td>
                    <td className="whitespace-nowrap">{enrichmentResult?.pvalue?.toPrecision(3)}</td>
                    <td className="whitespace-nowrap">{enrichmentResult?.adjPvalue?.toPrecision(3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="w-full flex flex-col items-center">
            <Pagination
              page={page}
              totalCount={background.enrich?.totalCount ? background.enrich?.totalCount : undefined}
              pageSize={pageSize}
              onChange={page => setPage(page)}
            />
          </div>
        </div>
      )) ?? 
      <Loading/>
      }
    </div>
  )
}

export default function Enrich({
  searchParams
}: {
  searchParams: {
    dataset: string | string[] | undefined
  },
}) {
  const dataset = ensureArray(searchParams.dataset)[0]
  const { data: userGeneSet } = useFetchUserGeneSetQuery({
    skip: !dataset,
    variables: { id: dataset },
  })
  const [modelGeneSet, setModelGeneSet] = React.useState<{ description: string, genes: string[] }>()
  return (
    <>
      <div className="flex flex-row gap-2 alert">
        <span className="prose">Input:</span>
        <label
          htmlFor="geneSetModal"
          className="prose underline cursor-pointer"
          onClick={evt => {
            setModelGeneSet({
              genes: (userGeneSet?.userGeneSet?.genes ?? []).filter((gene): gene is string => !!gene),
              description: userGeneSet?.userGeneSet?.description || 'Gene set',
            })
          }}
        >{userGeneSet?.userGeneSet?.description || 'Gene set'}{userGeneSet ? <> ({userGeneSet?.userGeneSet?.genes?.length ?? '?'} genes)</> : null}</label>
      </div>
      <div className="container mx-auto">
        <EnrichmentResults userGeneSet={userGeneSet} setModelGeneSet={setModelGeneSet} />
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