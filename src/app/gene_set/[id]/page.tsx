import Link from "next/link";
import getItem from "./item";

export default async function Page(props: { params: { id: string } }) {
  const { data } = await getItem(props.params.id)
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