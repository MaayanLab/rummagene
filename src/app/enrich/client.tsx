'use client'
import React from 'react'
import {
  FetchUserGeneSetQuery,
  useEnrichmentQueryQuery,
  useFetchGeneInfoQuery,
  useFetchUserGeneSetQuery,
  useOverlapQueryQuery,
  useViewGeneSetQuery
} from '@/graphql'
import Loading from '@/components/loading'
import Pagination from '@/components/pagination'
import useQsState from '@/utils/useQsState'
import Stats from '../stats'
import Image from 'next/image'
import GeneSetModal from '@/components/geneSetModal'
import * as array from '@/utils/array'

const pageSize = 10

type GeneSetModalT = {
  type: 'UserGeneSet',
  description: string,
  genes: string[],
} | {
  type: 'GeneSetOverlap',
  id: string,
  description: string,
  genes: string[]
} | {
  type: 'GeneSet',
  id: string,
  description: string,
} | undefined

function BreakLong({ children, className = "break-words", long = 16 }: { children: string, className?: string, long?: number }) {
  const chunks: string[] = []
  const expr = /[^\w]+/g
  let m: RegExpExecArray | null = null
  let i = 0
  while ((m = expr.exec(children)) !== null) {
    chunks.push(...array.interpolate<any>(array.even_chunk(children.slice(i, m.index), long), <wbr />))
    chunks.push(m[0])
    i = m.index + m.length
  }
  chunks.push(...array.interpolate<any>(array.even_chunk(children.slice(i), long), <wbr />))
  return <span key={i} className={className}>{chunks.map((text, i) => <React.Fragment key={i}>{text}</React.Fragment>)}</span>
}

function description_markdown(text: string) {
  if (!text) return <span className="italic">No description found</span>
  const m = /\*\*(.+?)\*\*/.exec(text)
  if (m) return <>
    <BreakLong>{text.slice(0, m.index)}</BreakLong>
    <BreakLong className="font-bold italic">{m[1]}</BreakLong>
    <BreakLong>{text.slice(m.index + 4 + m[1].length)}</BreakLong>
  </>
  return text
}

function EnrichmentResults({ userGeneSet, setModalGeneSet }: { userGeneSet?: FetchUserGeneSetQuery, setModalGeneSet: React.Dispatch<React.SetStateAction<GeneSetModalT>> }) {
  const genes = React.useMemo(() =>
    array.ensure(userGeneSet?.userGeneSet?.genes).filter((gene): gene is string => !!gene).map(gene => gene.toUpperCase()),
    [userGeneSet]
  )
  const [queryString, setQueryString] = useQsState({ page:  '1', q: '' })
  const [rawTerm, setRawTerm] = React.useState('')
  const { page, term } = React.useMemo(() => ({ page: queryString.page ? +queryString.page : 1, term: queryString.q ?? '' }), [queryString])
  const { data: enrichmentResults } = useEnrichmentQueryQuery({
    skip: genes.length === 0,
    variables: { genes, filterTerm: term, offset: (page-1)*pageSize, first: pageSize },
  })
  React.useEffect(() => {setRawTerm(term)}, [term])
  return (
    <div className="flex flex-col gap-2 my-2">
      <h2 className="text-md font-bold">
        {!enrichmentResults?.currentBackground?.enrich ?
          <>Rummaging through <Stats show_gene_sets />.</>
          : <>After rummaging through <Stats show_gene_sets />. Rummagene <Image className="inline-block rounded" src="/images/rummagene_logo.png" width={50} height={100} alt="Rummagene"></Image> found {Intl.NumberFormat("en-US", {}).format(enrichmentResults?.currentBackground?.enrich?.totalCount || 0)} statistically significant matches.</>}
      </h2>
      <form
        className="join flex flex-row place-content-end place-items-center"
        onSubmit={evt => {
          evt.preventDefault()
          setQueryString({ page: '1', q: rawTerm })
        }}
      >
        <input
          type="text"
          className="input input-bordered join-item"
          value={rawTerm}
          onChange={evt => {setRawTerm(evt.currentTarget.value)}}
        />
        <div className="tooltip" data-tip="Search results">
          <button
            type="submit"
            className="btn join-item"
          >&#x1F50D;</button>
        </div>
        <div className="tooltip" data-tip="Clear search">
          <button
            type="reset"
            className="btn join-item"
            onClick={evt => {
              setQueryString({ page: '1', q: '' })
            }}
          >&#x232B;</button>
        </div>
        <a href={`/enrich/download?dataset=${queryString.dataset}&q=${queryString.q}`} download="results.tsv">
          <div className="tooltip" data-tip="Download results">
            <button
              type="button"
              className="btn join-item font-bold text-2xl pb-1"
            >&#x21E9;</button>
          </div>
        </a>
      </form>
      <div className="overflow-x-auto">
        <table className="table table-xs">
          <thead>
            <tr>
              <th>Paper</th>
              <th>Title</th>
              <th>Table</th>
              <th>Column</th>
              <th>Gene Set Size</th>
              <th>Overlap</th>
              <th>Odds</th>
              <th>PValue</th>
              <th>AdjPValue</th>
            </tr>
          </thead>
          <tbody>
            {!enrichmentResults?.currentBackground?.enrich ?
              <tr>
                <td colSpan={7}><Loading /></td>
              </tr>
            : null}
            {enrichmentResults?.currentBackground?.enrich?.nodes?.flatMap((enrichmentResult, genesetIndex) => {
              if (!enrichmentResult?.geneSets) return null
              const papers = {} as Record<string, {
                tables: Record<string, { columns: Record<string, typeof enrichmentResult['geneSets']['nodes'][0]>, descriptions: Set<string> }>,
                nTableColumns: number,
                pmcInfoByPmcid: typeof enrichmentResult['geneSets']['nodes'][0]['geneSetPmcsById']['nodes'][0]['pmcInfoByPmcid'],
              }>
              let nPapers = 0
              let nPaperTables = 0
              let nPaperTableColumns = 0
              for (const node of enrichmentResult?.geneSets.nodes) {
                const [paper, _, term] = array.partition(node.term, '-')
                const m = term ? /^(.+?\.\w+)-+(.+)$/.exec(term) : null
                const table = m ? m[1] : ''
                const column = m ? m[2] : term ?? ''
                if (!(paper in papers)) {
                  papers[paper] = {
                    tables: {},
                    nTableColumns: 0,
                    pmcInfoByPmcid: node.geneSetPmcsById.nodes[0].pmcInfoByPmcid,
                  }
                  nPapers += 1
                }
                if(!(table in papers[paper].tables)) {
                  papers[paper].tables[table] = { columns: {}, descriptions: new Set() }
                  nPaperTables += 1
                }
                papers[paper].tables[table].columns[column] = node
                papers[paper].tables[table].descriptions.add(node.description ?? '')
                papers[paper].nTableColumns += 1
                nPaperTableColumns += 1
              }
              return Object.entries(papers).flatMap(([pmcid, { tables, nTableColumns, pmcInfoByPmcid }], paperIndex) =>
                Object.entries(tables).flatMap(([table, { columns, descriptions }], tableIndex) =>
                  [
                    ...Object.entries(columns).flatMap(([column, geneSet], columnIndex) =>
                      <tr key={`${genesetIndex}-${paperIndex}-${tableIndex}-${columnIndex}`} className="border-b-0">
                        {tableIndex === 0 && columnIndex === 0 ? <th rowSpan={nTableColumns+Object.keys(tables).length}>
                          <a
                            className="underline cursor-pointer"
                            href={`https://www.ncbi.nlm.nih.gov/pmc/articles/${pmcid}/`}
                            target="_blank"
                            rel="noreferrer"
                          >{pmcid}</a>
                        </th> : null}
                        {tableIndex === 0 && columnIndex === 0 ? <td rowSpan={nTableColumns+Object.keys(tables).length}>{pmcInfoByPmcid?.title ?? ''}</td> : null}
                        {columnIndex === 0 ? <td rowSpan={Object.keys(columns).length}>
                          <a
                            className="underline cursor-pointer"
                            href={`https://www.ncbi.nlm.nih.gov/pmc/articles/${pmcid}/bin/${table}`}
                            target="_blank"
                          >
                            <BreakLong>{table}</BreakLong>
                          </a>
                        </td> : null}
                        <td rowSpan={1}>
                          <label
                            htmlFor="geneSetModal"
                            className="prose underline cursor-pointer"
                            onClick={evt => {
                              setModalGeneSet({
                                type: 'GeneSet',
                                id: geneSet.id,
                                description: geneSet.term ?? '',
                              })
                            }}
                          ><BreakLong>{column}</BreakLong></label>
                        </td>
                        {paperIndex === 0 && tableIndex === 0 && columnIndex === 0 ? <>
                          <td rowSpan={nPaperTableColumns+nPaperTables} className="whitespace-nowrap text-underline cursor-pointer">
                            {geneSet.nGeneIds}
                          </td>
                          <td rowSpan={nPaperTableColumns+nPaperTables} className="whitespace-nowrap text-underline cursor-pointer">
                            <label
                              htmlFor="geneSetModal"
                              className="prose underline cursor-pointer"
                              onClick={evt => {
                                setModalGeneSet({
                                  type: 'GeneSetOverlap',
                                  id: geneSet.id,
                                  description: `${userGeneSet?.userGeneSet?.description || 'User gene set'} & ${geneSet.term || 'Rummagene gene set'}`,
                                  genes,
                                })
                              }}
                            >{enrichmentResult?.nOverlap}</label>
                          </td>
                          <td rowSpan={nPaperTableColumns+nPaperTables} className="whitespace-nowrap">{enrichmentResult?.oddsRatio?.toPrecision(3)}</td>
                          <td rowSpan={nPaperTableColumns+nPaperTables} className="whitespace-nowrap">{enrichmentResult?.pvalue?.toPrecision(3)}</td>
                          <td rowSpan={nPaperTableColumns+nPaperTables} className="whitespace-nowrap">{enrichmentResult?.adjPvalue?.toPrecision(3)}</td>
                        </> : null}
                      </tr>
                    ),
                    <tr key={`${genesetIndex}-${paperIndex}-${tableIndex}-*`}>
                      <td colSpan={2}><span className="text-gray-700 font-bold">Description:</span> {description_markdown(Array.from(descriptions).filter(description => !!description).join('. '))}</td>
                    </tr>
                  ]
                )
              )
            })}
          </tbody>
        </table>
      </div>
      {enrichmentResults?.currentBackground?.enrich ?
        <div className="w-full flex flex-col items-center">
          <Pagination
            page={page}
            totalCount={enrichmentResults?.currentBackground?.enrich?.totalCount ? enrichmentResults?.currentBackground?.enrich.totalCount : undefined}
            pageSize={pageSize}
            onChange={page => {
              setQueryString({ page: `${page}`, q: term })
            }}
          />
        </div>
      : null}
    </div>
  )
}

function GeneSetModalWrapper(props: { modalGeneSet: GeneSetModalT, setModalGeneSet: React.Dispatch<React.SetStateAction<GeneSetModalT>> }) {
  const { data: geneSet } = useViewGeneSetQuery({
    skip: props.modalGeneSet?.type !== 'GeneSet',
    variables: props.modalGeneSet?.type === 'GeneSet' ? {
      id: props.modalGeneSet.id,
    } : undefined
  })
  const { data: overlap } = useOverlapQueryQuery({
    skip: props.modalGeneSet?.type !== 'GeneSetOverlap',
    variables: props.modalGeneSet?.type === 'GeneSetOverlap' ?  {
      id: props.modalGeneSet.id,
      genes: props.modalGeneSet?.genes,
    } : undefined,
  })
  const { data: userGeneSet } = useFetchGeneInfoQuery({
    skip: props.modalGeneSet?.type !== 'UserGeneSet',
    variables: props.modalGeneSet?.type === 'UserGeneSet' ? {
      genes: props.modalGeneSet.genes,
    } : undefined,
  })
  return (
    <GeneSetModal
      showModal={props.modalGeneSet !== undefined}
      term={props.modalGeneSet?.description}
      geneset={
        props.modalGeneSet?.type === 'GeneSet' ? geneSet?.geneSet?.genes.nodes
        : props.modalGeneSet?.type === 'GeneSetOverlap' ? overlap?.geneSet?.overlap.nodes
        : props.modalGeneSet?.type === 'UserGeneSet' ?
          userGeneSet?.geneMap2?.nodes ? userGeneSet.geneMap2.nodes.map(({ gene, geneInfo }) => ({gene, ...geneInfo}))
          : props.modalGeneSet.genes.map(symbol => ({ symbol }))
        : undefined
      }
      setShowModal={show => {
        if (!show) props.setModalGeneSet(undefined)
      }}
    />
  )
}

export default function EnrichClientPage({
  searchParams
}: {
  searchParams: {
    dataset: string | string[] | undefined
  },
}) {
  const dataset = array.ensure(searchParams.dataset)[0]
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
              type: 'UserGeneSet',
              genes: (userGeneSet?.userGeneSet?.genes ?? []).filter((gene): gene is string => !!gene),
              description: userGeneSet?.userGeneSet?.description || 'Gene set',
            })
          }}
        >{userGeneSet?.userGeneSet?.description || 'Gene set'}{userGeneSet ? <> ({userGeneSet?.userGeneSet?.genes?.length ?? '?'} genes)</> : null}</label>
      </div>
      <EnrichmentResults userGeneSet={userGeneSet} setModalGeneSet={setModalGeneSet} />
      <GeneSetModalWrapper modalGeneSet={modalGeneSet} setModalGeneSet={setModalGeneSet} />
    </>
  )
}
