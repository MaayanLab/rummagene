'use client'
import { useStatsQuery } from '@/graphql'

export default function Stats() {
  const { data } = useStatsQuery({ pollInterval: 601000 })
  return (
    <>
      {data?.userGeneSets?.totalCount ? <div><span className="font-bold">{data.userGeneSets.totalCount}</span> sets analyzed</div> : null}
      {/* {data?.geneSets?.totalCount ? <div><span className="font-bold">{data.geneSets.totalCount}</span> gene sets</div> : null}
      {data?.pmcs?.totalCount ? <div><span className="font-bold">{data.pmcs.totalCount}</span> papers</div> : null} */}
    </>
  )
}
