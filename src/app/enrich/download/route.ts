import { EnrichmentQueryDocument, EnrichmentQueryQuery, FetchUserGeneSetDocument, FetchUserGeneSetQuery } from "@/graphql"
import { getClient } from "@/lib/apollo/client"
import ensureArray from "@/utils/ensureArray"
import partition from "@/utils/partition"
import streamTsv from "@/utils/streamTsv"

export const dynamic = 'force-dynamic'
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const dataset = searchParams.get('dataset')
  const term = searchParams.get('q') || ''
  const { data: userGeneSet, error: userGeneSetError } = await getClient().query<FetchUserGeneSetQuery>({
    query: FetchUserGeneSetDocument,
    variables: { id: dataset },
  })
  if (userGeneSetError) throw new Error(userGeneSetError.message)
  const genes = ensureArray(userGeneSet.userGeneSet?.genes).filter((gene): gene is string => !!gene).map(gene => gene.toUpperCase())
  const { data: enrichmentResults, error: enrichmentResultsError } = await getClient().query<EnrichmentQueryQuery>({
    query: EnrichmentQueryDocument,
    variables: {
      genes,
      filterTerm: term,
      offset: 0,
      first: null,
    },
  })
  if (enrichmentResultsError) throw new Error(enrichmentResultsError.message)
  const nodes = enrichmentResults.currentBackground?.enrich?.nodes
  if (!nodes) throw new Error('No results')

  return new Response(
    streamTsv(['pmcid', 'pmcidTitle', 'table', 'column', 'description', 'geneSetSize', 'nOverlap', 'oddsRatio', 'pvalue', 'adjPvalue', 'geneSetHash'],
      nodes.flatMap(node => node?.geneSets.nodes.map(geneSet => ({
        geneSetHash: node.geneSetHash,
        geneSet,
        pvalue: node.pvalue,
        adjPvalue: node.adjPvalue,
        nOverlap: node.nOverlap,
        oddsRatio: node.oddsRatio,
      }))),
      item => {
      if (!item?.geneSet) return
      const [pmcid, _, term] = partition(item.geneSet.term, '-')
      const m = term ? /^(.+?\.\w+)-+(.+)$/.exec(term) : null
      const table = m ? m[1] : null
      const column = m ? m[2] : term
      return {
        pmcid,
        pmcidTitle: item.geneSet.geneSetPmcsById.nodes[0].pmcInfoByPmcid?.title,
        table,
        column,
        description: item.geneSet.description,
        geneSetSize: item.geneSet.nGeneIds,
        nOverlap: item.nOverlap,
        oddsRatio: item.oddsRatio,
        pvalue: item.pvalue,
        adjPvalue: item.adjPvalue,
        geneSetHash: item.geneSetHash,
      }
    }),
    {
      headers: {
        'Content-Type': 'text/tab-separated-values',
      },
    },
  )
}
