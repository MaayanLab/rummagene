'use client'
import React from 'react'
import client from '@/lib/apollo-client'
import example from './example.json'
import uniqueArray from '@/utils/uniqueArray'
import { useAddUserGeneSetMutation } from '@/graphql'
import classNames from 'classnames'
import { useRouter } from 'next/navigation'

export default function InputForm() {
  const router = useRouter()
  const [rawGenes, setRawGenes] = React.useState('')
  const genes = React.useMemo(() => uniqueArray(rawGenes.split(/[;,\t\r\n\s]+/).filter(v => v)), [rawGenes])
  const [addUserGeneSetMutation, { loading, error }] = useAddUserGeneSetMutation({ client })
  return (
    <>
      <h1 className="text-xl">Input data</h1>
      <p className="prose">
        Paste a set of Entrez gene symbols on each row in the textbox below.
        You can try a gene set <a
          className="font-bold cursor-pointer"
          onClick={() => {
            setRawGenes(example.genes.join('\n'))
          }}
        >example</a>.
      </p>
      <form
        className="flex flex-col place-items-end"
        onSubmit={async (evt) => {
          evt.preventDefault()
          const result = await addUserGeneSetMutation({
            variables: {
              genes,
            }
          })
          const id = result.data?.addUserGeneSet?.userGeneSet?.id
          if (id) {
            router.push(`/enrich?dataset=${id}`)
          }
        }}
      >
        <textarea
          value={rawGenes}
          onChange={evt => {
            setRawGenes(evt.currentTarget.value)
          }}
          rows={8}
          className="textarea textarea-bordered w-full"
          placeholder="Paste a set of valid Entrez gene symbols (e.g. STAT3) on each row in the text-box"
        />
        {genes.length} gene(s) entered
        <button className="btn" type="submit">Submit</button>
        <progress className={classNames("w-full", { 'hidden': !loading })}></progress>
        <div className={classNames("alert alert-error", { 'hidden': !error })}>{error?.message ?? null}</div>
      </form>
    </>
  )
}
