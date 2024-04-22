import getItem from "../../item"
import { redirect } from 'next/navigation'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const geneSet = await getItem(params.id)
  if (!geneSet.data.geneSetByTerm) return new Response(JSON.stringify({error: 'Not Found'}), { status: 404 })
  const formData = new FormData()
  formData.append('list', geneSet.data.geneSetByTerm.genes.nodes.map(gene => gene.symbol).join('\n'))
  formData.append('description', `Rummagene ${geneSet.data.geneSetByTerm.term}`)
  const req = await fetch('https://maayanlab.cloud/Enrichr/addList', {
    headers: {
      'Accept': 'application/json',
    },
    method: 'POST',
    body: formData,
  })
  const res = await req.json()
  if (!res.shortId) return new Response(JSON.stringify({error: 'Failed to Register Gene Set'}), { status: 500 })
  const searchParams = new URLSearchParams()
  searchParams.append('userListId', res.userListId)
  searchParams.append('search', 'true')
  redirect(`https://maayanlab.cloud/enrichr-kg?${searchParams.toString()}`)
}
