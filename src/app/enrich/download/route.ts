import { EnrichmentQueryDocument, EnrichmentQueryQuery, FetchUserGeneSetDocument, FetchUserGeneSetQuery, GetBackgroundsDocument, GetBackgroundsQuery } from "@/graphql"
import { getClient } from "@/lib/apollo/client"
import determineSpecies from "@/utils/determineSpecies"
import ensureArray from "@/utils/ensureArray"
import partition from "@/utils/partition"
import streamTsv from "@/utils/streamTsv"
import React from "react"

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
  const genes = ensureArray(userGeneSet.userGeneSet?.genes).filter((gene): gene is string => !!gene).map(gene => gene)

  const { data: backgrounds, error: backgroundIdsError } = await getClient().query<GetBackgroundsQuery>({
    query: GetBackgroundsDocument,
    variables: {},
  })

  if (backgroundIdsError) throw new Error(backgroundIdsError.message)

  var backgroundIds: Record<string, string> = {};
  backgrounds?.backgrounds?.nodes?.forEach(background => {
    backgroundIds[background?.species ?? ''] = background?.id ?? ''
  })

  const species = determineSpecies(genes[0] || '')

  const backgroundId = backgroundIds[species] ?? null
  console.log('backgroundId', backgroundId)
  const { data: enrichmentResults, error: enrichmentResultsError } = await getClient().query<EnrichmentQueryQuery>({
    query: EnrichmentQueryDocument,
    variables: {
      genes,
      filterTerm: term,
      offset: 0,
      first: null,
      id: backgroundId,
    },
  })

  if (enrichmentResultsError) throw new Error(enrichmentResultsError.message)
  console.log('enrichmentResults', enrichmentResults)
  const nodes = enrichmentResults.background?.enrich?.nodes
  if (!nodes) throw new Error('No results')

  return new Response(
    streamTsv(['gse', 'pmid', 'condition1Title', 'condition2Title', 'condition1Samples', 'condition2Samples', 'direction', 'platform', 'date', 'geneSetSize', 'overlap', 'oddsRatio', 'pValue', 'adjPValue'], nodes, item => {
      if (!item?.geneSet) return
      const [gse, cond1, _, cond2, __, dir] = partition(item?.geneSet?.term)

      var pmid = item?.geneSet?.geneSetPmidsById?.nodes[0]?.pmid ?? ''
      if (pmid?.includes(',')) {
        pmid = JSON.parse(pmid.replace(/'/g, '"')).join(',')
      }
      var platform = item?.geneSet?.geneSetPmidsById?.nodes[0]?.platform ?? ''
      if (platform?.includes(',')) {
        platform = JSON.parse(platform.replace(/'/g, '"')).join(',')
      }
      return {
        gse: gse,
        pmid: pmid,
        title: item?.geneSet?.geneSetPmidsById?.nodes[0]?.title ?? '',
        condition1Title: item?.geneSet?.geneSetPmidsById?.nodes[0]?.sampleGroups['titles'][cond1] ?? '',
        condition2Title: item?.geneSet?.geneSetPmidsById?.nodes[0]?.sampleGroups['titles'][cond2] ?? '',
        condition1Samples: item?.geneSet?.geneSetPmidsById?.nodes[0]?.sampleGroups['samples'][cond1] ?? '',
        condition2Samples: item?.geneSet?.geneSetPmidsById?.nodes[0]?.sampleGroups['samples'][cond2] ?? '',
        direction: dir,
        platform: item?.geneSet?.geneSetPmidsById?.nodes[0]?.platform ?? '',
        date: item?.geneSet?.geneSetPmidsById?.nodes[0]?.publishedDate ?? '',
        geneSetSize: item?.geneSet?.nGeneIds ?? 0,
        overlap: item?.nOverlap ?? 0,
        oddsRatio: item?.oddsRatio ?? 0,
        pValue: item?.pvalue ?? 0,
        adjPValue: item?.adjPvalue ?? 0,
      }
    }),
    {
      headers: {
        'Content-Type': 'text/tab-separated-values',
      },
    },
  )
}
