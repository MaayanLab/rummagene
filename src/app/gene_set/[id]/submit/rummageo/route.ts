import getItem from "../../item"
import { redirect } from 'next/navigation'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const geneSet = await getItem(params.id)
  if (!geneSet.data.geneSetByTerm) return new Response(JSON.stringify({error: 'Not Found'}), { status: 404 })
  const req = await fetch('https://rummageo.com/graphql', {
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    method: 'POST',
    body: JSON.stringify({
      operationName: 'AddUserGeneSet',
      query: `
        mutation AddUserGeneSet($genes: [String], $description: String = "") {
          addUserGeneSet(input: {genes: $genes, description: $description}) {
            userGeneSet {
              id
            }
          }
        }
      `,
      variables: {
        genes: geneSet.data.geneSetByTerm?.genes.nodes.map(node => node.symbol),
        description: `Rummagene ${geneSet.data.geneSetByTerm.term}`,
      },
    }),
  })
  const userGeneSet = await req.json()
  if (!userGeneSet.data?.addUserGeneSet?.userGeneSet?.id) return new Response(JSON.stringify({error: 'Failed to Register'}), { status: 500 })
  const searchParams = new URLSearchParams()
  searchParams.append('dataset', userGeneSet.data.addUserGeneSet.userGeneSet.id)
  redirect(`https://rummageo.com/enrich?${searchParams.toString()}`)
}
