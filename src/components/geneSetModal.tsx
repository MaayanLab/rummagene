import React, { CSSProperties } from 'react'

const noWrap: CSSProperties = {
    whiteSpace: 'pre-line',
}

export default function GeneSetModal({ geneset, showModal, setShowModal }: { geneset?: (string | null)[] | undefined, showModal?: boolean, setShowModal: (show: boolean) => void }) {

    return (
        <>
        {showModal ? (
                <>
                    <div
                        className="justify-center items-center flex overflow-x-hidden overflow-y-scroll fixed inset-0 z-50 focus:outline-none"
                        onClick={() => setShowModal(false)}
                    >
                        <div className="relative w-auto my-6 mx-auto max-w-3xl">
                            <div className="border-0 rounded-lg shadow-lg relative flex flex-col w-full bg-white outline-none focus:outline-none">
                                <div className='p-3 border-b'>
                                    <p className="text-md text-center text-gray-900 dark:text-white">
                                        Gene Set  ({geneset ? geneset?.length : 'n'})
                                    </p>
                                </div>
                                <div className="p-2 h-56 overflow-y-scroll text-center" style={noWrap}>
                                    <p className="my-4 text-slate-500 text-sm leading-relaxed">
                                        {geneset ? geneset?.join('\n') : <span className='loading loading-ring loading-lg'></span>}

                                    </p>
                                </div>
                                <div className="flex items-center justify-end p-6 border-t border-solid border-slate-200 rounded-b">
                                    <button
                                        className="btn btn-sm m-2"
                                        type="button"
                                        onClick={() => setShowModal(false)}
                                    >
                                        Close
                                    </button>
                                    <button
                                        className="btn btn-sm btn-outline text-xs p-2"
                                        type="button"
                                        onClick={() => {
                                            setShowModal(false)
                                            navigator.clipboard.writeText(geneset?.join('\n') || '')
                                        }}
                                    >
                                        Copy to Clipboard
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="opacity-25 fixed inset-0 z-40 bg-black" onClick={() => setShowModal(false)}></div>
                </>
            ) : null}
        </>
    )
}
