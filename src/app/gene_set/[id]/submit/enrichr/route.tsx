import { ViewGeneSetDocument, ViewGeneSetQuery, ViewGeneSetQueryVariables } from "@/graphql"
import { getClient } from "@/lib/apollo/client"
import { redirect } from 'next/navigation'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const client = getClient()
  const geneSet = await client.query<ViewGeneSetQuery, ViewGeneSetQueryVariables>({
    query: ViewGeneSetDocument,
    variables: {
      id: params.id,
    },
  })
  if (!geneSet.data.geneSet) return new Response(JSON.stringify({error: 'Not Found'}), { status: 404 })
  const formData = new FormData()
  formData.append('list', geneSet.data.geneSet.genes.nodes.map(gene => gene.symbol).join('\n'))
  formData.append('description', `Rummagene Gene Set ${params.id}`)
  const req = await fetch('https://maayanlab.cloud/Enrichr/api/addList', {
    method: 'POST',
    body: formData,
  })
  const res = await req.json()
  if (!res.shortId) return new Response(JSON.stringify({error: 'Failed to Register Gene Set'}), { status: 500 })
  redirect(`https://maayanlab.cloud/Enrichr/enrich?dataset=${res.shortId}`)
}
