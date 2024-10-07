import React from 'react'
import LinkedTerm from '@/components/linkedTerm';
import { useViewGeneSetQuery } from '@/graphql';
import GeneSetModal from '@/components/geneSetModal';
import useQsState from '@/utils/useQsState';
import Pagination from '@/components/pagination';
import blobTsv from '@/utils/blobTsv';
import clientDownloadBlob from '@/utils/clientDownloadBlob';

const pageSize = 10

export default function TermTable({ terms }: { terms: {
  description?: any; __typename?: "GeneSet" | undefined; term?: string | null | undefined; id?: any; nGeneIds?: number | null | undefined; 
}[] }) {
  const [queryString, setQueryString] = useQsState({ page: '1', f: '' })
  const { page, searchTerm } = React.useMemo(() => ({ page: queryString.page ? +queryString.page : 1, searchTerm: queryString.f ?? '' }), [queryString])

  const dataFiltered = React.useMemo(() =>
    terms.filter(el => {
      return (el?.term?.toLowerCase().includes(searchTerm.toLowerCase()))
    }),
  [terms, searchTerm])

  const [geneSetId, setGeneSetId] = React.useState(terms[0].id)
  const [currTerm, setCurrTerm] = React.useState(terms[0].term)
  const [showModal, setShowModal] = React.useState(false)

  const genesQuery = useViewGeneSetQuery({
    variables: { id: geneSetId }
  })

  return (
    <>
      <GeneSetModal geneset={genesQuery?.data?.geneSet?.genes.nodes} term={currTerm} showModal={showModal} setShowModal={setShowModal}></GeneSetModal>
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
                const blob = blobTsv(['term', 'nGenes'], dataFiltered, item => ({
                  term: item.term,
                  nGenes: item.nGeneIds,
                }))
                clientDownloadBlob(blob, 'results.tsv')
              }}
            >&#x21E9;</button>
          </div>
        </div>
        <table className="table table-xs table-pin-cols table-auto">
          <thead>
            <tr>
              <td >Term</td>
              <td >Figure</td>
              <td >Thumbnail</td>
              <td>Description</td>
              <td >Gene Set</td>
            </tr>
          </thead>
          <tbody>
            {dataFiltered?.slice((page-1) * pageSize, page * pageSize).map(async el => {
              const pmcid = el?.term?.split('_')[0]
              const figure = el?.term?.split('_')[2]
              const description = el?.description
              const figImg = await fetch(`https://pfocr.wikipathways.org/figures/${el?.term}.html`).then(response => response.text())
              .then(text => {
                let regex = /<a[^>]+href="([^"]+)"/i;
                let match = text.match(regex);
                // Extract the content
                if (match && match[1]) {
                  return match[1];
                } else return ''
            })
              return (
                <tr key={el?.term} className={""}>
                  <td>
                    <a
                      className="underline cursor-pointer"
                      href={`https://www.ncbi.nlm.nih.gov/pmc/articles/${pmcid}/`}
                      target="_blank"
                      rel="noreferrer"
                    >{pmcid}</a>
                  </td>
                  <td>
                    <a
                      className="underline cursor-pointer"
                      href={`https://pfocr.wikipathways.org/figures/${el?.term}.html`}
                      target="_blank"
                      rel="noreferrer"
                    >{figure}</a>
                  </td>
                  <td>
                  <a
                      className="underline cursor-pointer"
                      href={`https://pfocr.wikipathways.org/figures/${el?.term}.html`}
                      target="_blank"
                      rel="noreferrer"
                    ><img src={`https://www.ncbi.nlm.nih.gov/pmc/articles/${pmcid}/bin/${figImg.split('__')[1]?.replace('.html', '')}.jpg`} style={{ width: 'fit-content', height: '70px', alignContent: 'center', margin: 'auto'}} /></a>
                  </td>
                  <td>
                          {description}
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
                    ><p>View Gene Set ({el?.nGeneIds})</p>
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
          onChange={newPage => {setQueryString({ page: `${newPage}` })}}
        />
      </div>
    </>
  )
}