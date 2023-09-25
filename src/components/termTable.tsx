import React, { use } from 'react'
import LinkedTerm from './linkedTerm';
import { useViewGeneSetQuery } from '@/graphql';
import GeneSetModal from './geneSetModal';


export default function TermTable({ terms }: { terms: { __typename?: "GeneSet" | undefined; term?: string | null | undefined; id?: any; nGeneIds?: number | null | undefined; }[] }) {
  const [page, setPage] = React.useState(0)
  const [numPerPage, setNumPerPage] = React.useState(10)

  const [searchTerm, setSearchTerm] = React.useState('')
  const [dataFiltered, setDataFiltered] = React.useState(terms.slice(page * numPerPage, numPerPage * (page + 1)))
  const [total, setTotal] = React.useState(terms.length)
  const [maxPage, setMaxPage] = React.useState(Math.floor((terms.length || 10) / numPerPage))

  const [geneSetId, setGeneSetId] = React.useState(terms[0].id)
  const [currTerm, setCurrTerm] = React.useState(terms[0].term)
  const [showModal, setShowModal] = React.useState(false)

  React.useEffect(() => {
    const searchFilteredData = terms.filter(el => {
      return (el?.term?.toLowerCase().includes(searchTerm.toLowerCase()))
    })
    setTotal(searchFilteredData?.length)
    setMaxPage(Math.floor((searchFilteredData?.length || 1) / numPerPage))

    setDataFiltered(searchFilteredData?.slice(page * numPerPage, numPerPage * (page + 1)))
  }, [page, numPerPage, terms, searchTerm])

  const genesQuery = useViewGeneSetQuery({
    variables: { id: geneSetId }
  })

  return (
    <>
      <GeneSetModal geneset={genesQuery?.data?.geneSet?.genes.nodes.map(({ symbol }) => symbol)} term={currTerm} showModal={showModal} setShowModal={setShowModal}></GeneSetModal>
      <div className='border m-5 mt-1'>

        <div className='text-right p-1'>

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
        <table className="table table-pin-cols table-auto">
          <thead>
            <tr>
              <td >Term</td>
              <td >Gene Set</td>
            </tr>
          </thead>
          <tbody>
            {dataFiltered?.map(el => {
              return (
                <tr key={el?.term} className={"hover:bg-gray-100 dark:hover:bg-gray-700"}>
                  <td className="break-all"><LinkedTerm term={`${el?.term}`}></LinkedTerm></td>
                  <td className='w-3/12'>
                    <button
                      className='btn btn-outline text-xs p-2 h-auto'
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