import getItem from "../../item"
import { AddUserGeneSetDocument, AddUserGeneSetMutation, AddUserGeneSetMutationVariables } from "@/graphql"
import { getClient } from "@/lib/apollo/client"
import { redirect } from 'next/navigation'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const geneSet = await getItem(params.id)
  if (!geneSet.data.geneSet) return new Response(JSON.stringify({error: 'Not Found'}), { status: 404 })
  const client = getClient()
  const userGeneSet = await client.mutate<AddUserGeneSetMutation, AddUserGeneSetMutationVariables>({
    mutation: AddUserGeneSetDocument,
    variables: {
      genes: geneSet.data.geneSet?.genes.nodes.map(node => node.symbol),
      description: `Rummagene ${geneSet.data.geneSet.term}`,
    },
  })
  if (!userGeneSet.data?.addUserGeneSet?.userGeneSet?.id) return new Response(JSON.stringify({error: 'Failed to Register'}), { status: 500 })
  const searchParams = new URLSearchParams()
  searchParams.append('dataset', userGeneSet.data.addUserGeneSet.userGeneSet.id)
  redirect(`${process.env.PUBLIC_URL}/enrich?${searchParams.toString()}`)
}
