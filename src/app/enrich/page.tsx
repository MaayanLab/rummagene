'use client'
import React from 'react'
import {
  FetchUserGeneSetQuery,
  useEnrichmentQueryQuery,
  useFetchUserGeneSetQuery,
  useOverlapQueryQuery,
  useViewGeneSetQuery
} from '@/graphql'
import ensureArray from "@/utils/ensureArray"
import LinkedTerm from '@/components/linkedTerm'
import Loading from '@/components/loading'
import Pagination from '@/components/pagination'
import { useQsState } from '@/utils/useQsState'

const pageSize = 10

type GeneSetModalT = {
  id?: string,
  description: string,
  genes?: string[]
} | undefined

function EnrichmentResults({ userGeneSet, setModalGeneSet }: { userGeneSet?: FetchUserGeneSetQuery, setModalGeneSet: React.Dispatch<React.SetStateAction<GeneSetModalT>> }) {
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
    <div className="flex flex-col gap-2 my-2">
      <h2 className="text-xl font-medium">
        Matching gene sets ({enrichmentResults?.currentBackground?.enrich?.totalCount})
      </h2>
      <div className="overflow-x-auto">
        <table className="table table-xs">
          <thead>
            <tr>
              <th>Supporting tables containing matching gene sets</th>
              <th>Gene Set Size</th>
              <th>Overlap</th>
              <th>Odds</th>
              <th>PValue</th>
              <th>AdjPValue</th>
            </tr>
          </thead>
          <tbody>
            {enrichmentResults?.currentBackground?.enrich?.nodes?.map((enrichmentResult, j) => (
              <tr key={j}>
                <th><LinkedTerm term={enrichmentResult?.geneSet?.term} /></th>
                <td className="whitespace-nowrap text-underline cursor-pointer">
                  <label
                    htmlFor="geneSetModal"
                    className="prose underline cursor-pointer"
                    onClick={evt => {
                      setModalGeneSet({
                        id: enrichmentResult?.geneSet?.id,
                        description: enrichmentResult?.geneSet?.term ?? '',
                      })
                    }}
                  >{enrichmentResult?.geneSet?.nGeneIds}</label>
                </td>
                <td className="whitespace-nowrap text-underline cursor-pointer">
                  <label
                    htmlFor="geneSetModal"
                    className="prose underline cursor-pointer"
                    onClick={evt => {
                      setModalGeneSet({
                        id: enrichmentResult?.geneSet?.id,
                        genes,
                        description: enrichmentResult?.geneSet?.term ?? '',
                      })
                    }}
                  >{enrichmentResult?.nOverlap}</label>
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
          totalCount={enrichmentResults?.currentBackground?.enrich?.totalCount ? enrichmentResults?.currentBackground.enrich?.totalCount : undefined}
          pageSize={pageSize}
          onChange={page => setPage(page)}
        />
      </div>
    </div>
  )
}

function GeneSetModal(props: { modalGeneSet: GeneSetModalT, setModalGeneSet: React.Dispatch<React.SetStateAction<GeneSetModalT>> }) {
  const { data: geneSet } = useViewGeneSetQuery({
    skip: props.modalGeneSet?.id === undefined || props.modalGeneSet?.genes !== undefined,
    variables: {
      id: props.modalGeneSet?.id,
    }
  })
  const { data: overlap } = useOverlapQueryQuery({
    skip: props.modalGeneSet?.id === undefined,
    variables: {
      id: props.modalGeneSet?.id,
      genes: props.modalGeneSet?.genes ?? [],
    },
  })
  return (
    <>
      <input
        type="checkbox"
        id="geneSetModal"
        className="modal-toggle"
        onChange={evt => {
          if (!evt.currentTarget.checked) {
            props.setModalGeneSet(undefined)
          }
        }}
      />
      <div className="modal">
        <div className="modal-box">
          <h3 className="text-lg font-bold">
            <LinkedTerm term={props.modalGeneSet?.description} />
          </h3>
          <textarea
            className="w-full"
            readOnly
            rows={8}
            value={(geneSet?.geneSet?.genes.nodes || overlap?.geneSet?.overlap.nodes)?.map(gene => gene.symbol).join('\n') ?? ''}
          />
        </div>
        <label className="modal-backdrop" htmlFor="geneSetModal">Close</label>
      </div>
    </>
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
  const [modalGeneSet, setModalGeneSet] = React.useState<GeneSetModalT>()
  return (
    <>
      <div className="flex flex-row gap-2 alert">
        <span className="prose">Input:</span>
        <label
          htmlFor="geneSetModal"
          className="prose underline cursor-pointer"
          onClick={evt => {
            setModalGeneSet({
              genes: (userGeneSet?.userGeneSet?.genes ?? []).filter((gene): gene is string => !!gene),
              description: userGeneSet?.userGeneSet?.description || 'Gene set',
            })
          }}
        >{userGeneSet?.userGeneSet?.description || 'Gene set'}{userGeneSet ? <> ({userGeneSet?.userGeneSet?.genes?.length ?? '?'} genes)</> : null}</label>
      </div>
      <div className="container mx-auto">
        <EnrichmentResults userGeneSet={userGeneSet} setModalGeneSet={setModalGeneSet} />
      </div>
      <GeneSetModal modalGeneSet={modalGeneSet} setModalGeneSet={setModalGeneSet} />
    </>
  )
}
