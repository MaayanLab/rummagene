'use client'
import client from '@/lib/apollo-client'
import { useStatsQuery } from "@/graphql"
import classNames from 'classnames'

export default function Stats() {
  const { data, loading } = useStatsQuery({ client })
  return (
    <>
      <div>{data?.userGeneSets?.totalCount ?? '?'} sets analyzed</div>
      <div>{data?.geneSets?.totalCount ?? '?'} gene sets</div>
      <div>{data?.geneSetLibraries?.totalCount ?? '?'} libraries</div>
      <progress className={classNames("progress", { 'hidden': !loading })}></progress>
    </>
  )
}
