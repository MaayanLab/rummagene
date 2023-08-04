'use client'
import { useSuspenseQuery } from '@apollo/experimental-nextjs-app-support/ssr'
import { StatsDocument, StatsQuery } from '@/graphql'
import Link from 'next/link'

export default function Stats() {
  const { data } = useSuspenseQuery<StatsQuery>(StatsDocument)
  return (
    <>
      <div><span className="font-bold">{data?.userGeneSets?.totalCount ?? '?'}</span> sets analyzed</div>
      <div><Link href="/libraries"><span className="font-bold">{data?.geneSets?.totalCount ?? '?'}</span> gene sets</Link></div>
      <div><Link href="/libraries"><span className="font-bold">{data?.geneSetLibraries?.totalCount ?? '?'}</span> libraries</Link></div>
    </>
  )
}
