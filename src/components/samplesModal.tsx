import React, { CSSProperties } from 'react'
import { useQueryGsmMetaQuery } from '@/graphql'

const noWrap: CSSProperties = {
    whiteSpace: 'pre-line',
}

export default function SamplesModal({ samples, condition, showModal, setShowModal }: { samples?: (string | null)[] | undefined, condition: string | null | undefined, showModal?: boolean, setShowModal: (show: boolean) => void }) {
    const { data: gsmMeta } = useQueryGsmMetaQuery({
        skip: !samples,
        variables: { gsms: samples },
    })
    return (
        <>
            {showModal ? (
                <>
                  <div
                        className="justify-center items-center flex overflow-x-hidden overflow-y-scroll fixed inset-0 z-50 focus:outline-none"
                        onClick={() => setShowModal(false)}
                    >
                    <div className="relative w-auto my-6 mx-auto max-w-3xl">
                        <div className="border-0 rounded-lg shadow-lg relative flex flex-col w-full bg-white outline-none focus:outline-none  dark:bg-neutral-900">
                            <div className='p-3 border-b'>
                                <p className="text-md text-center text-gray-900 dark:text-white">
                                    <div>{condition}</div>
                                </p>
                            </div>
                            <div className="p-2 h-56 overflow-y-scroll text-center" style={noWrap}>
                                <div className="overflow-x-auto">

                                    <table className="table table-xs">
                                        <thead>
                                            <tr>
                                                <th>GSE</th>
                                                <th>GSM</th>
                                                <th>Title</th>
                                                <th>Characteristic Ch1</th>
                                                <th>Source Ch1</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {gsmMeta?.getGsmMeta?.nodes?.map((sampleMeta, i) => {
                                                const gse = sampleMeta?.gse
                                                return (
                                                    <tr key={i}>
                                                        <td>
                                                            {gse?.includes(',') ? <>
                                                                {gse.split(',').map((g, i) => {
                                                                    return <><a
                                                                        key={i}
                                                                        className="underline cursor-pointer"
                                                                        href={`https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=${g}`}
                                                                        target="_blank"
                                                                        rel="noreferrer"
                                                                    >{g}</a>{i != (gse.split(',').length - 1) ? <>,</> : <></>} </>
                                                                })
                                                                }</> :
                                                                <a
                                                                    className="underline cursor-pointer"
                                                                    href={`https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=${gse}`}
                                                                    target="_blank"
                                                                    rel="noreferrer"
                                                                >{gse}</a>
                                                            }
                                                        </td>
                                                        <td><a
                                                            className="underline cursor-pointer"
                                                            href={`https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=${sampleMeta.gsm}`}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                        >{sampleMeta.gsm}</a></td>
                                                        <td>{sampleMeta?.title}</td>
                                                        <td>{sampleMeta?.characteristicsCh1}</td>
                                                        <td>{sampleMeta?.sourceNameCh1}</td>
                                                    </tr>
                                                )
                                            })}

                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            <div className="flex items-center justify-end p-6 border-t border-solid border-slate-200 rounded-b">

                            </div>
                        </div>
                    </div>
                    </div>
                    <div className="opacity-25 fixed inset-0 z-10 bg-black" onClick={() => setShowModal(false)}></div>
                </>
            ) : null}
        </>
    )
}
