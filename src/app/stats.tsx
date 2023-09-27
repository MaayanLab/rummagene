'use client'
import { useStatsQuery } from '@/graphql'
import classNames from 'classnames'

export default function Stats({
  bold,
  show_sets_analyzed,
  show_gene_sets,
  show_pmcs,
  show_publications,
}: {
  bold?: boolean,
  show_sets_analyzed?: boolean,
  show_gene_sets?: boolean,
  show_pmcs?: boolean,
  show_publications?: boolean
}) {
  const { data } = useStatsQuery({ pollInterval: 60000 })

  if (show_gene_sets) {
    return (data?.geneSets?.totalCount !== undefined && show_gene_sets) ? <><span className={classNames({'font-bold': bold})}>{Intl.NumberFormat("en-US", {}).format(data.geneSets.totalCount)}</span>&nbsp;gene sets</> : <span className='loading'>loading</span>
  } else if (show_pmcs){
    return (data?.pmcs?.totalCount !== undefined ? <><span className={classNames({'font-bold': bold})}>{Intl.NumberFormat("en-US", {}).format(data.pmcs.totalCount)}</span>&nbsp;articles</> : <span className='loading'>loading</span>)
  } else if (show_publications) {
    return (data?.pmcStats?.nPublicationsProcessed !== undefined ? <><span className={classNames({'font-bold': bold})}>{Intl.NumberFormat("en-US", {}).format(data.pmcStats.nPublicationsProcessed)}</span>&nbsp;PMC articles</> : <span className='loading'>loading</span>) 
  } else if (show_sets_analyzed) {
    return (data?.userGeneSets?.totalCount !== undefined ? <><span className={classNames({'font-bold': bold})}>{Intl.NumberFormat("en-US", {}).format(data.userGeneSets.totalCount)}</span>&nbsp;sets analyzed</> : <span className='loading'>loading</span>)
  } else{
    return null
  }
}
