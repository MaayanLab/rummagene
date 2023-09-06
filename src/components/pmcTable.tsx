import React, { use } from 'react'
import LinkedTerm from './linkedTerm';
import { useViewGeneSetQuery } from '@/graphql';
import GeneSetModal from './geneSetModal';

interface pmcData {
  __typename?: "PmcInfo" | undefined;
  pmcid: string;
  title?: string | null | undefined;
  yr?: number | null | undefined;
  doi?: string | null | undefined;
}

export default function PmcTable({ terms, data, gene_set_ids }: { terms?: Map<string, string[]>, data?: pmcData[], gene_set_ids?: Map<string, string[]> }) {
  const [page, setPage] = React.useState(0)
  const [numPerPage, setNumPerPage] = React.useState(10)

  const [searchTerm, setSearchTerm] = React.useState('')
  const [dataFiltered, setDataFiltered] = React.useState(data?.slice(page * numPerPage, numPerPage * (page + 1)))
  const [total, setTotal] = React.useState(data?.length)
  const [maxPage, setMaxPage] = React.useState(Math.floor((data?.length || 1) / numPerPage))

  const [geneSetId, setGeneSetId] = React.useState<string | null>(gene_set_ids?.values().next().value?.at(0) || '')
  const [currTerm, setCurrTerm] = React.useState<string | null>(gene_set_ids?.keys().next().value?.at(0) || '')
  const [showModal, setShowModal] = React.useState(false)

  React.useEffect(() => {
    const searchFilteredData = data?.filter(el => {
      const rowToSearch = el?.title + (terms?.get(el?.pmcid)?.join(' ') || '')
      return (rowToSearch?.toLowerCase().includes(searchTerm.toLowerCase()))
    })
    setTotal(searchFilteredData?.length)
    setMaxPage(Math.floor((searchFilteredData?.length || 1) / numPerPage))
    setDataFiltered(searchFilteredData?.slice(page * numPerPage, numPerPage * (page + 1)))
  }, [page, numPerPage, data, terms, searchTerm])

  const genesQuery = useViewGeneSetQuery({
    variables: { id: geneSetId }
  })

  return (
    <>
      <GeneSetModal geneset={genesQuery?.data?.viewGeneSet?.nodes} term={currTerm} showModal={showModal} setShowModal={setShowModal}></GeneSetModal>
      <div className='border m-5 mt-1 overflow-y-scroll'>
        <div className='text-right pt-3 pr-3'>
          <span className="label-text text-base">Search: </span>
          <input
            type="text"
            className="input input-bordered"
            value={searchTerm}
            onChange={evt => {
              setSearchTerm(evt.currentTarget.value)
            }}
          />
        </div>
        <table className="table table-pin-rows table-pin-cols table-auto">
          <thead>
            <tr>
              <td className='w-32'>PMC</td>
              <td className='w-1/4'>Title</td>
              <td className='w-20'>Year</td>
              <td className='w-20'># Terms</td>
              <td className='w-10'></td>
            </tr>
          </thead>
          <tbody>
            {dataFiltered?.map(el => {
              return (
                <>
                  <tr key={el?.pmcid} className={"hover:bg-gray-100 dark:hover:bg-gray-700"}>
                    <td><LinkedTerm term={`${el?.pmcid} `}></LinkedTerm></td>
                    <td>{el?.title}</td>
                    <td>{el?.yr}</td>
                    <td>{terms?.get(el?.pmcid)?.length}</td>
                    <td className='align-text-middle'>
                      <button
                      onClick={evt => {
                        terms?.get(el?.pmcid)?.map(term => document.getElementById(term)?.classList.toggle('hidden'))
                      }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                  {terms?.get(el?.pmcid)?.map(term => {
                    return (
                      <tr key={term} id={term} className='hidden'>
                        <td><p className="break-words w-96">{term}</p></td>
                        <td>
                          <button
                            className='btn btn-outline text-xs p-2 h-auto'
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
                        <td></td>
                        <td></td>
                      </tr>)
                  })}
                </>
              )
            })}
          </tbody >
        </table>
      </div>
      <div className="flex flex-col items-center">

        <span className="text-sm text-gray-700 dark:text-gray-400">
          Showing <span className="font-semibold text-gray-900 dark:text-white">{(page * numPerPage) + 1}</span> to <span className="font-semibold text-gray-900 dark:text-white">{Math.min(numPerPage * (page + 1), total || 0)}</span> of <span className="font-semibold text-gray-900 dark:text-white">{total}</span> Entries
        </span>

        <div className="inline-flex mt-2 xs:mt-0 mb-5">
          <button className="flex items-center justify-center px-3 h-8 text-sm font-medium text-white bg-gray-500 rounded-l hover:bg-gray-900 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
            onClick={evt => {
              if (page > 0) {
                setPage(page - 1)
              }
            }}>
            Prev
          </button>
          <button
            className="flex items-center justify-center px-3 h-8 text-sm font-medium text-white bg-gray-500 border-0 border-l border-gray-700 rounded-r hover:bg-gray-900 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
            onClick={evt => {
              if (page < maxPage) setPage(page + 1)
            }}
          >
            Next
          </button>
        </div>
      </div>
    </>
  )
}