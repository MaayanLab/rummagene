'use client'
import { useStatsQuery } from '@/graphql'

export default function Stats({show_sets_analyzed, show_gene_sets, show_pmcs}: {show_sets_analyzed?: boolean, show_gene_sets?: boolean, show_pmcs?: boolean}) {
  const { data } = useStatsQuery({ pollInterval: 601000 })

  if (show_gene_sets) {
    return (data?.geneSets?.totalCount && show_gene_sets) ? <>{Intl.NumberFormat("en-US", {}).format(data.geneSets.totalCount)} gene sets</> : <span className='loading'>loading</span>
  } else if (show_pmcs){
    return (data?.pmcs?.totalCount  ? <span className="font-bold">{Intl.NumberFormat("en-US", {}).format(data.pmcs.totalCount)} publications</span> : <span className='loading'>loading</span>)
  } else return (data?.userGeneSets?.totalCount ? <div><span className="font-bold">{Intl.NumberFormat("en-US", {}).format(data.userGeneSets.totalCount)}</span> sets analyzed</div> : <span className='loading'>loading</span>)
}
