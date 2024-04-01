import { AddUserGeneSetDocument, AddUserGeneSetMutation, AddUserGeneSetMutationVariables, ViewGeneSetDocument, ViewGeneSetQuery, ViewGeneSetQueryVariables } from "@/graphql"
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
  const userGeneSet = await client.mutate<AddUserGeneSetMutation, AddUserGeneSetMutationVariables>({
    mutation: AddUserGeneSetDocument,
    variables: {
      genes: geneSet.data.geneSet?.genes.nodes.map(node => node.symbol),
      description: `Rummagene Gene Set ${params.id}`,
    },
  })
  if (!userGeneSet.data?.addUserGeneSet?.userGeneSet?.id) return new Response(JSON.stringify({error: 'Failed to Register'}), { status: 500 })
  redirect(`https://${request.headers.get('Host')}/enrich?dataset=${userGeneSet.data.addUserGeneSet.userGeneSet.id}`)
}
