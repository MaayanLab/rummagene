'use client'
import client from '@/lib/apollo-client'
import { useStatsQuery } from "@/graphql"
import classNames from 'classnames'
import Link from 'next/link'

export default function Stats() {
  const { data, loading } = useStatsQuery({ client })
  return (
    <>
      <div><span className="font-bold">{data?.userGeneSets?.totalCount ?? '?'}</span> sets analyzed</div>
      <div><Link href="/libraries"><span className="font-bold">{data?.geneSets?.totalCount ?? '?'}</span> gene sets</Link></div>
      <div><Link href="/libraries"><span className="font-bold">{data?.geneSetLibraries?.totalCount ?? '?'}</span> libraries</Link></div>
      <progress className={classNames("progress", { 'hidden': !loading })}></progress>
    </>
  )
}
