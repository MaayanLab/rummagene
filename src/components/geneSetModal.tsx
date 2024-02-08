import React from 'react'
import EnrichrButton from './enrichrButton'
import { useAddUserGeneSetMutation } from '@/graphql'
import { useRouter } from 'next/navigation'
import classNames from 'classnames'

function ExpandableText({ text }: { text: string }) {
    const [more, setMore] = React.useState(false)
    const startText = React.useMemo(() => text.split('. ')[0], [text])
    return <>
        {more ? text : startText}
        &nbsp;
        {more ? <button className="text-blue-500" onClick={() => setMore(() => false)}>Show Less</button>
        : <button className="text-blue-500" onClick={() => setMore(() => true)}>Show More</button>}
    </>
}

export default function GeneSetModal({ geneset, term, showModal, setShowModal }: { geneset?: ({ symbol: string, ncbi_gene_id?: number | null, description?: string | null, summary?: string | null } | null | undefined)[] | undefined, term: string | null | undefined, showModal?: boolean, setShowModal: (show: boolean) => void }) {
    const ref = React.useRef<HTMLDialogElement>(null)
    const router = useRouter()
    const [addUserGeneSetMutation, { loading, error }] = useAddUserGeneSetMutation()
    const genes = React.useMemo(() => geneset?.filter((gene): gene is Exclude<typeof gene, null | undefined> => !!gene).map(({ symbol }) => symbol), [geneset])
    React.useEffect(() => {
        if (!ref.current) return
        ref.current.addEventListener('close', () => setShowModal(false))
    }, [ref])
    React.useEffect(() => {
        if (!ref.current) return
        if (showModal) ref.current.showModal()
    }, [ref, showModal])
    return (
        <>
            <dialog className="modal" ref={ref}>
                <div className="modal-box w-11/12 max-w-screen-xl h-5/6 overflow-hidden flex flex-col">
                    <p className="text-md text-center text-gray-900 dark:text-white flex-shrink-0">
                        Gene Set  ({geneset ? geneset?.length : 'n'})
                    </p>
                    <p className="text-md text-center text-gray-600 dark:text-white">{term}</p>
                    <div className={classNames("p-2 py-6 text-slate-500 text-sm leading-relaxed whitespace-pre-line overflow-hidden flex flex-grow flex-shrink")}>
                        {geneset ?
                            <div className="overflow-x-auto block">
                                <table className="table table-xs table-pin-rows table-pin-cols">
                                    <thead className="bg-white sticky top-0">
                                        <th>Symbol</th>
                                        <th>Description</th>
                                        <th>Summary</th>
                                    </thead>
                                    <tbody className="overflow-y-auto">
                                        {geneset.filter((gene): gene is Exclude<typeof gene, null | undefined> => !!gene).map(gene =>
                                            <tr key={gene.symbol}>
                                                <td className="font-bold">{gene.symbol}</td>
                                                <td>{gene.description}</td>
                                                <td><ExpandableText text={gene.summary ?? ''} /></td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        : <span className='loading loading-ring loading-lg'></span>
                        }
                    </div>

                    <div className="flex items-center justify-end p-6 border-t border-solid border-slate-200 rounded-b  flex-shrink-0">


                        <button
                            className="btn btn-sm btn-outline text-xs p-2 m-2"
                            type="button"
                            onClick={() => {
                                setShowModal(false)
                                navigator.clipboard.writeText(genes?.join('\n') || '')
                            }}
                        >
                            Copy to Clipboard
                        </button>
                        <EnrichrButton genes={genes} description={term}></EnrichrButton>
                        <button
                            className="btn btn-sm btn-outline text-xs p-2 m-2"
                            type="button"
                            onClick={async (evt) => {
                                evt.preventDefault()
                                const result = await addUserGeneSetMutation({
                                    variables: {
                                        genes,
                                        description: term,
                                    }
                                })
                                const id = result.data?.addUserGeneSet?.userGeneSet?.id
                                if (id) {
                                    router.push(`/enrich?dataset=${id}`)
                                }
                            }}>
                            Enrich on Rummagene
                        </button>
                        <span className={classNames("loading", "w-6", { 'hidden': !loading })}></span>
                        <div className={classNames("alert alert-error", { 'hidden': !error })}>{error?.message ?? null}</div>
                    </div>
                </div>
                <form method="dialog" className="modal-backdrop">
                    <button>close</button>
                </form>
            </dialog>
        </>
    )
}
