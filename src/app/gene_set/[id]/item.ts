'use server'
import { ViewGeneSet3Document, ViewGeneSet3Query, ViewGeneSet3QueryVariables } from "@/graphql"
import { getClient } from "@/lib/apollo/client"
import React from "react"

const getItem = React.cache(async (term: string) => {
  const client = getClient()
  const geneSet = await client.query<ViewGeneSet3Query, ViewGeneSet3QueryVariables>({
    query: ViewGeneSet3Document,
    variables: { term },
  })
  return geneSet
})
export default getItem
