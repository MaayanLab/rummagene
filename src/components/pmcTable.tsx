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

export default function PmcTable({ terms, data, gene_set_ids }: { terms?: Map<string, string[]>, data?: pmcData[], gene_set_ids?: Map<string, string> }) {
  const [page, setPage] = React.useState(0)
  const [numPerPage, setNumPerPage] = React.useState(10)

  const [searchTerm, setSearchTerm] = React.useState('')
  const [dataFiltered, setDataFiltered] = React.useState(data?.slice(page * numPerPage, numPerPage * (page + 1)))
  const [total, setTotal] = React.useState(data?.length)
  const [maxPage, setMaxPage] = React.useState(Math.floor((data?.length || 1) / numPerPage))

  const [geneSetId, setGeneSetId] = React.useState(gene_set_ids?.get(gene_set_ids?.keys().next().value))
  const [showModal, setShowModal] = React.useState(false)

  React.useEffect(() => {
    setDataFiltered(data?.slice(page * numPerPage, numPerPage * (page + 1)))
  }, [page, numPerPage])

  const genesQuery = useViewGeneSetQuery({
    variables: {id: geneSetId}
  })

  console.log(genesQuery?.data?.viewGeneSet?.nodes)

  return (
    <>
      <GeneSetModal geneset={genesQuery?.data?.viewGeneSet?.nodes} showModal={showModal} setShowModal={setShowModal}></GeneSetModal>
      <div className='border m-5 mt-1 overflow-y-scroll'>
        <table className="table table-pin-rows table-pin-cols table-auto">
          <thead>
            <tr>
              <td className='w-32'>PMC</td>
              <td className='w-1/4'>Title</td>
              <td className='w-20'>Year</td>
              <td className='w-20'># Terms</td>
            </tr>
          </thead>
          <tbody>
            {dataFiltered?.map(el => {
              return (
                <tr key={el?.pmcid}>
                  <td><LinkedTerm term={`${el?.pmcid} `}></LinkedTerm></td>
                  <td>{el?.title}</td>
                  <td>{el?.yr}</td>
                  <td>{terms?.get(el?.pmcid)?.length}</td>
                  <thead>
                    <tr>
                    </tr>
                  </thead>
                  <tbody>
                    {terms?.get(el?.pmcid)?.map(term => {
                      return (
                      <tr>
                        <td><p className="break-words w-96">{term}</p></td>
                        <td className=''>
                          <button 
                          className='btn btn-lg btn-outline text-xs p-2'
                          data-te-toggle="modal"
                          data-te-target="#geneSetModal"
                          data-te-ripple-init
                          data-te-ripple-color="light"
                          onClick={evt => {
                            setGeneSetId(gene_set_ids?.get(term) || '')
                            setShowModal(true)
                          }}
                          ><p>View Gene Set</p>
                          </button>
                        </td>
                      </tr>)
                    })}
                  </tbody>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-col items-center">

        <span className="text-sm text-gray-700 dark:text-gray-400">
          Showing <span className="font-semibold text-gray-900 dark:text-white">{(page * numPerPage) + 1}</span> to <span className="font-semibold text-gray-900 dark:text-white">{Math.min(numPerPage * (page + 1), total || 0)}</span> of <span className="font-semibold text-gray-900 dark:text-white">{total}</span> Entries
        </span>

        <div className="inline-flex mt-2 xs:mt-0 mb-5">
          <button className="flex items-center justify-center px-3 h-8 text-sm font-medium text-white bg-gray-800 rounded-l hover:bg-gray-900 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
            onClick={evt => {
              if (page > 0) {
                setPage(page - 1)
              }
            }}>
            Prev
          </button>
          <button
            className="flex items-center justify-center px-3 h-8 text-sm font-medium text-white bg-gray-800 border-0 border-l border-gray-700 rounded-r hover:bg-gray-900 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
            onClick={evt => {
              console.log(maxPage)
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