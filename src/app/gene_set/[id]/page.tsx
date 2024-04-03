'use client'
import { useViewGeneSet2Query } from "@/graphql";
import Link from "next/link";

export default function Page(props: { params: { id: string } }) {
  const { data, error } = useViewGeneSet2Query({ variables: { id: props.params.id } })
  if (error) return <div className="alert alert-error">{error.toString()}</div>
  else if (!data) return null
  return (
    <>
      <h1 className="text-xl">{data.geneSet?.term}</h1>
      <h3 className="text-md">{data.geneSet?.description}</h3>
      <code className="w-40 h-20 overflow-y-scroll whitespace-pre-line">
        {data.geneSet?.genes.nodes.map(g => g.symbol).join('\n')}
      </code>
      {[
        'gse',
        'enrichr',
        'enrichr-kg',
        'pwb',
        'rummagene',
        'rummageo',
        // TODO: 'g2sg',
      ].map(t =>
        <Link key={t} className="link" href={`/gene_set/${props.params.id}/submit/${t}`} target="_blank">{`/gene_set/${props.params.id}/submit/${t}`}</Link>
      )}
    </>
  )
}