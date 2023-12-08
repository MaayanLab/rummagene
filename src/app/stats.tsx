'use client'
import { useStatsQuery } from '@/graphql'
import classNames from 'classnames'

export default function Stats({
  bold,
  show_sets_analyzed,
  show_human_gene_sets,
  show_mouse_gene_sets,
  show_total_gene_sets,
  show_gses
}: {
  bold?: boolean,
  show_sets_analyzed?: boolean,
  show_human_gene_sets?: boolean,
  show_mouse_gene_sets?: boolean,
  show_total_gene_sets?: boolean,
  show_gses?: boolean,
}) {
  const { data } = useStatsQuery({ pollInterval: 60000 })

  if (show_human_gene_sets) {
    return (data?.humanGeneSets?.totalCount !== undefined && show_human_gene_sets) ? <><span className={classNames({'font-bold': bold})}>{Intl.NumberFormat("en-US", {}).format(data.humanGeneSets.totalCount)}</span>&nbsp;human gene sets</> : <span className='loading'>loading</span>
  } else if (show_mouse_gene_sets) {
    return (data?.mouseGeneSets?.totalCount !== undefined && show_mouse_gene_sets) ? <><span className={classNames({'font-bold': bold})}>{Intl.NumberFormat("en-US", {}).format(data.mouseGeneSets.totalCount)}</span>&nbsp;mouse gene sets</> : <span className='loading'>loading</span>
  } else if (show_total_gene_sets) {
    return (data?.totalGeneSets?.totalCount !== undefined && show_total_gene_sets) ? <><span className={classNames({'font-bold': bold})}>{Intl.NumberFormat("en-US", {}).format(data.totalGeneSets.totalCount)}</span>&nbsp;gene sets</> : <span className='loading'>loading</span>
  } else if (show_gses){
    return (data?.gses?.totalCount !== undefined ? <><span className={classNames({'font-bold': bold})}>{Intl.NumberFormat("en-US", {}).format(data.gses.totalCount)}</span>&nbsp;GEO studies</> : <span className='loading'>loading</span>)
  } else if (show_sets_analyzed) {
    return (data?.userGeneSets?.totalCount !== undefined ? <><span className={classNames({'font-bold': bold})}>{Intl.NumberFormat("en-US", {}).format(data.userGeneSets.totalCount)}</span>&nbsp;sets analyzed</> : <span className='loading'>loading</span>)
  } else{
    return null
  }
}
