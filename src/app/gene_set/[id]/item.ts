'use server'
import { ViewGeneSet2Document, ViewGeneSet2Query, ViewGeneSet2QueryVariables } from "@/graphql"
import { getClient } from "@/lib/apollo/client"
import React from "react"

const getItem = React.cache(async (id: string) => {
  const client = getClient()
  const geneSet = await client.query<ViewGeneSet2Query, ViewGeneSet2QueryVariables>({
    query: ViewGeneSet2Document,
    variables: { id },
  })
  return geneSet
})
export default getItem
