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
  const req = await fetch({
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
        genes: geneSet.data.geneSet?.genes.nodes.map(node => node.symbol),
        description: `Rummagene Gene Set ${params.id}`,
      },
    }),
  })
  const userGeneSet = await req.json()
  if (!userGeneSet.data?.addUserGeneSet?.userGeneSet?.id) return new Response(JSON.stringify({error: 'Failed to Register'}), { status: 500 })
  redirect(`https://rummageo.com/enrich?dataset=${userGeneSet.data.addUserGeneSet.userGeneSet.id}`)
}
