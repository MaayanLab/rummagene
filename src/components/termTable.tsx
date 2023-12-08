import React from 'react'
import LinkedTerm from '@/components/linkedTerm';
import { useViewGeneSetQuery } from '@/graphql';
import GeneSetModal from '@/components/geneSetModal';
import SamplesModal from '@/components/samplesModal';
import useQsState from '@/utils/useQsState';
import Pagination from '@/components/pagination';
import blobTsv from '@/utils/blobTsv';
import clientDownloadBlob from '@/utils/clientDownloadBlob';
import partition from '@/utils/partition';

const pageSize = 10

export default function TermTable({ terms }: {
  terms: {
    __typename?: "GeneSetPmid" | undefined;
    id?: any;
    term?: string | null | undefined;
    gse?: string | null | undefined;
    platform?: string | null | undefined;
    pmid?: string | null | undefined;
    publishedDate?: any;
    sampleGroups?: any;
    title?: string | null | undefined;
    geneSetById?: { __typename?: "GeneSet" | undefined; nGeneIds: number; species: string; } | null | undefined;
  }[]
}) {
  const [queryString, setQueryString] = useQsState({ page: '1', f: '' })
  const { page, searchTerm } = React.useMemo(() => ({ page: queryString.page ? +queryString.page : 1, searchTerm: queryString.f ?? '' }), [queryString])

  const dataFiltered = React.useMemo(() =>
    terms.filter(el => {
      return ((el?.title?.toLowerCase() + (el?.geneSetById?.species ?? '')).includes(searchTerm.toLowerCase()))
    }),
    [terms, searchTerm])

  const [geneSetId, setGeneSetId] = React.useState(terms[0].id)
  const [currTerm, setCurrTerm] = React.useState(terms[0].term)
  const [showModal, setShowModal] = React.useState(false)
  const [showConditionsModal, setShowConditionsModal] = React.useState(false)
  const [modalSamples, setModalSamples] = React.useState<string[]>()
  const [modalCondition, setModalCondition] = React.useState<string>()

  const genesQuery = useViewGeneSetQuery({
    variables: { id: geneSetId }
  })

  return (
    <>
      <GeneSetModal geneset={genesQuery?.data?.geneSet?.genes.nodes.map(({ symbol }) => symbol)} term={currTerm} showModal={showModal} setShowModal={setShowModal}></GeneSetModal>
      <SamplesModal samples={modalSamples} condition={modalCondition} showModal={showConditionsModal} setShowModal={setShowConditionsModal}></SamplesModal>
      <div className='m-5 mt-1'>
        <div className='join flex flex-row place-content-end items-center pt-3 pr-3'>
          <span className="label-text text-base">Search:&nbsp;</span>
          <input
            type="text"
            className="input input-bordered"
            value={searchTerm}
            onChange={evt => {
              setQueryString({ page: '1', f: evt.currentTarget.value })
            }}
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
                setQueryString({ page: '1', f: '' })
              }}
            >&#x232B;</button>
          </div>
          <div className="tooltip" data-tip="Download results">
            <button
              type="button"
              className="btn join-item font-bold text-2xl pb-1"
              onClick={evt => {
                if (!dataFiltered) return
                const blob = blobTsv(['gse', 'pmid', 'condition1Title', 'condition2Title', 'condition1Samples', 'condition2Samples', 'direction', 'platform', 'date', 'geneSetSize'], dataFiltered, item => {
                  if (!item?.term) return
                  const [gse, cond1, _, cond2, __, dir] = partition(item?.term)
            
                  var pmid = item?.pmid ?? ''
                  if (pmid?.includes(',')) {
                    pmid = JSON.parse(pmid.replace(/'/g, '"')).join(',')
                  }
                  var platform = item?.platform ?? ''
                  if (platform?.includes(',')) {
                    platform = JSON.parse(platform.replace(/'/g, '"')).join(',')
                  }
                  return {
                    gse: gse,
                    pmid: pmid,
                    title: item?.title ?? '',
                    condition1Title: item?.sampleGroups['titles'][cond1] ?? '',
                    condition2Title: item?.sampleGroups['titles'][cond2] ?? '',
                    condition1Samples: item?.sampleGroups['samples'][cond1] ?? '',
                    condition2Samples: item?.sampleGroups['samples'][cond2] ?? '',
                    direction: dir,
                    platform: item?.platform ?? '',
                    date: item?.publishedDate ?? '',
                    geneSetSize: item?.geneSetById?.nGeneIds ?? 0,
                  }
                })
                clientDownloadBlob(blob, 'results.tsv')
              }}
            >&#x21E9;</button>
          </div>
        </div>
        <table className="table table-xs">
          <thead>
            <tr>
              <th>GEO Series</th>
              <th>PMID</th>
              <th>Species</th>
              <th>Title</th>
              <th>Condition 1</th>
              <th>Condition 2</th>
              <th>Direction</th>
              <th>Platform</th>
              <th>Date</th>
              <th>Gene Set</th>
            </tr>
          </thead>
          <tbody>
            {dataFiltered?.slice((page - 1) * pageSize, page * pageSize).map(el => {
              const [gse, cond1, _, cond2, __, dir] = partition(el?.term ?? '')
              var pmid = el?.pmid ?? null
              if (pmid?.includes(',')) {
                pmid = JSON.parse(pmid.replace(/'/g, '"')).join(',')
              }
              var platform = el?.platform ?? ''
              if (platform?.includes(',')) {
                platform = JSON.parse(platform.replace(/'/g, '"')).join(',')
              }
              const cond1Title = el?.sampleGroups?.titles[cond1] ?? ''
              const cond2Title = el?.sampleGroups?.titles[cond2] ?? ''
              const cond1Samples = el?.sampleGroups?.samples[cond1] ?? ''
              const cond2Samples = el?.sampleGroups?.samples[cond2] ?? ''

              return (
                <tr key={el?.term}>
                  <th>
                    {gse.includes(',') ? <>
                      {gse.split(',').map((g, i) => {
                        return <><a
                          key={i}
                          className="underline cursor-pointer"
                          href={`https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=${g}`}
                          target="_blank"
                          rel="noreferrer"
                        >{g}</a>{ i != (gse.split(',').length - 1) ? <>,</>: <></>} </>
                      })
                    }</> :
                      <a
                        className="underline cursor-pointer"
                        href={`https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=${gse}`}
                        target="_blank"
                        rel="noreferrer"
                      >{gse}</a>
                    }
                  </th>
                  <th>
                    {pmid ? pmid.includes(',') ?
                       <>
                       {pmid.split(',').map((p, i) => {
                         return <><a
                           key={i}
                           className="underline cursor-pointer"
                           href={`https://pubmed.ncbi.nlm.nih.gov/${p}/`}
                           target="_blank"
                           rel="noreferrer"
                         >{p}</a>{ pmid ? i != (pmid?.split(',')?.length - 1) ? <>,</>: <></> : <></>} </>
                       })
                       } </> :
                      <a
                        className="underline cursor-pointer"
                        href={`https://pubmed.ncbi.nlm.nih.gov/${pmid}/`}
                        target="_blank"
                        rel="noreferrer"
                      >{pmid}</a> : <>N/A</>}
                  </th>
                  <td>{el?.geneSetById?.species ?? ''}</td>
                  <td>{el?.title ?? ''}</td>
                  <td>
                  <label
                      htmlFor="geneSetModal"
                      className="prose underline cursor-pointer"
                      onClick={evt => {
                        setModalSamples(cond1Samples)
                        setModalCondition(cond1Title)
                        setShowConditionsModal(true)
                      }}
                    >{cond1Title}</label>
                  </td>
                  <td>
                    <label
                      htmlFor="geneSetModal"
                      className="prose underline cursor-pointer"
                      onClick={evt => {
                        setModalSamples(cond2Samples)
                        setModalCondition(cond2Title)
                        setShowConditionsModal(true)
                      }}
                    >{cond2Title}</label>
                  </td>
                  <td>
                    {dir === 'up' ? 'Up' : dir === 'dn' ? 'Down' : 'Up/Down'}
                  </td>
                  <td>
                    {platform ? platform.includes(',') ?
                      <>
                      {platform.split(',').map((p, i) => {
                        return <><a
                          key={i}
                          className="underline cursor-pointer"
                          href={`https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=${p}`}
                          target="_blank"
                          rel="noreferrer"
                        >{p}</a>{ i != (platform.split(',').length - 1) ? <>,</>: <></>} </>
                      })
                      } </> :
                      <a
                        className="underline cursor-pointer"
                        href={`https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=${platform}`}
                        target="_blank"
                        rel="noreferrer"
                      >{platform}</a> : <>N/A</>}
                  </td>
                  <td>
                    {el?.publishedDate ?? ''}
                  </td>
                  <td className='w-3/12'>
                    <button
                      className='btn btn-xs btn-outline p-2 h-auto'
                      data-te-toggle="modal"
                      data-te-target="#geneSetModal"
                      data-te-ripple-init
                      data-te-ripple-color="light"
                      onClick={evt => {
                        setCurrTerm(el?.term || '')
                        setGeneSetId(el?.id || '')
                        setShowModal(true)
                      }}
                    ><p>View Gene Set ({el?.geneSetById?.nGeneIds})</p>
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-col items-center">
        <Pagination
          page={page}
          pageSize={pageSize}
          totalCount={dataFiltered?.length}
          onChange={newPage => { setQueryString({ page: `${newPage}` }) }}
        />
      </div>
    </>
  )
}