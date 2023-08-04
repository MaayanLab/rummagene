'use client'
import { useSuspenseQuery } from '@apollo/experimental-nextjs-app-support/ssr'
import { StatsDocument, StatsQuery } from '@/graphql'

export default function Stats() {
  const { data } = useSuspenseQuery<StatsQuery>(StatsDocument)
  return (
    <>
      <div><span className="font-bold">{data?.userGeneSets?.totalCount ?? '?'}</span> sets analyzed</div>
      <div><span className="font-bold">{data?.geneSets?.totalCount ?? '?'}</span> gene sets</div>
      <div><span className="font-bold">{data?.pmcs?.totalCount ?? '?'}</span> papers</div>
    </>
  )
}
