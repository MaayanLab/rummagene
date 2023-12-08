import React from 'react'
import { useViewGeneSetQuery } from '@/graphql';
import GeneSetModal from '@/components/geneSetModal';
import useQsState from '@/utils/useQsState';
import Pagination from '@/components/pagination';
import blobTsv from '@/utils/blobTsv';
import clientDownloadBlob from '@/utils/clientDownloadBlob';
import partition from '@/utils/partition';
import SamplesModal from './samplesModal';

const pageSize = 10


export default function PmidTable({ terms, data, gene_set_ids }: {
  terms?: Map<string, string[]>, data?: {
    __typename?: "PmidInfo" | undefined;
    pmid: string;
    pubDate?: string | null | undefined;
    title?: string | null | undefined;
    doi?: string | null | undefined;
  }[], gene_set_ids?: Map<string, [any, number, any]>
}) {
  const [queryString, setQueryString] = useQsState({ page: '1', f: '' })
  const { page, searchTerm } = React.useMemo(() => ({ page: queryString.page ? +queryString.page : 1, searchTerm: queryString.f ?? '' }), [queryString])

  const dataFiltered = React.useMemo(() =>
    data?.filter(el => {
      const rowToSearch = el?.title + (terms?.get(el?.pmid)?.join(' ') || '')
      return (rowToSearch?.toLowerCase().includes(searchTerm.toLowerCase()))
    }),
    [data, searchTerm, terms])

  const [geneSetId, setGeneSetId] = React.useState<string | null>(gene_set_ids?.values().next().value?.at(0) || '')
  const [currTerm, setCurrTerm] = React.useState<string | null>(gene_set_ids?.keys().next().value?.at(0) || '')
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
                const blob = blobTsv(['pmcid', 'title', 'year', 'doi', 'terms'], dataFiltered, item => {
                  var terms_mapped = terms?.get(item.pmid)
                  terms_mapped?.map(term => {
                    const sample_groups = gene_set_ids?.get(term)?.at(2)
                    const [gse, cond1, _, cond2, species, dir] = partition(term)
                    const term_title = [gse, sample_groups?.titles[cond1], 'vs.', sample_groups.titles[cond2], dir, species].join(' ')
                    return term_title
                  })
                  return {
                  pmcid: item.pmid,
                  title: item.title,
                  year: item.pubDate,
                  doi: item.doi,
                  terms: terms_mapped?.join(' ')
                }})
                clientDownloadBlob(blob, 'results.tsv')
              }}
            >&#x21E9;</button>
          </div>
        </div>
        <table className="table table-xs">
          <thead>
            <tr>
              <th>PMID</th>
              <th>Title</th>
              <th >Date</th>
              <th># Terms</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {dataFiltered?.slice((page - 1) * pageSize, page * pageSize).map(el => {
              return (
                <>
                  <tr key={el?.pmid}>
                    <td><a
                        className="underline cursor-pointer"
                        href={`https://pubmed.ncbi.nlm.nih.gov/${el?.pmid}/`}
                        target="_blank"
                        rel="noreferrer"
                      >{el?.pmid}</a></td>
                    <td>{el?.title}</td>
                    <td>{el?.pubDate}</td>
                    <td>{terms?.get(el?.pmid)?.length}</td>
                    <td className='align-text-middle'>
                      <button
                        onClick={evt => {
                          terms?.get(el?.pmid)?.map(term => document.getElementById(term)?.classList.toggle('hidden'))
                        }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                  {terms?.get(el?.pmid)?.map(term => {
                    const sample_groups = gene_set_ids?.get(term)?.at(2)
                    const [gse, cond1, _, cond2, species, dir] = partition(term)
                    return (
                      <tr key={term} id={term} className='hidden bg-white dark:bg-black bg-opacity-30'>
                        <td colSpan={1}>{gse.includes(',') ? <>
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
                    }</td>
                        <td colSpan={1}>
                        <label
                      htmlFor="geneSetModal"
                      className="prose underline cursor-pointer"
                      onClick={evt => {
                        setModalSamples(sample_groups?.samples[cond1])
                        setModalCondition(sample_groups?.titles[cond1])
                        setShowConditionsModal(true)
                      }}
                    >{sample_groups?.titles[cond1]}</label>
                        </td>
                        <td colSpan={1}><label
                      htmlFor="geneSetModal"
                      className="prose underline cursor-pointer"
                      onClick={evt => {
                        setModalSamples(sample_groups?.samples[cond2])
                        setModalCondition(sample_groups?.titles[cond2])
                        setShowConditionsModal(true)
                      }}
                    >{sample_groups?.titles[cond2]}</label></td>
                    <td colSpan={1}>{dir}</td>
                    <td colSpan={1}>{species.replace('.tsv', '')}</td>
                        <td colSpan={1}>
                          <button
                            className='btn btn-xs btn-outline p-2 h-auto'
                            data-te-toggle="modal"
                            data-te-target="#geneSetModal"
                            data-te-ripple-init
                            data-te-ripple-color="light"
                            onClick={evt => {
                              setCurrTerm(term)
                              setGeneSetId(gene_set_ids?.get(term)?.at(0) || '')
                              setShowModal(true)
                            }}
                          ><p>View Gene Set ({gene_set_ids?.get(term)?.at(1) || 'n'})</p>
                          </button>
                        </td>
                      </tr>)
                  })}
                </>
              )
            })}
          </tbody >
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