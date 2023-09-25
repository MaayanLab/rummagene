'use client'
import React from 'react'
import Stats from "@/app/stats";
import { useLatestReleaseQuery } from "@/graphql";

export default function Download() {
  const { data } = useLatestReleaseQuery()
  const latest_release_date = React.useMemo(() => {
    const date = new Date(data?.releases?.nodes[0]?.created)
    return date.toDateString()
  }, [data])
  return (
    <div className="prose">
      <h2 className="title text-xl font-medium mb-3">Downloads</h2>
      <br />
      <p>
        This database is updated weekly to extract gene sets automatically from newly published open access PMC articles.
      </p>
      <br />
      <a href="/download.gmt" className="stats shadow" download="download.gmt">
        <div className="stat">
          <div className="stat-title">Rummagene GMT</div>
          <div className="stat-value my-2"><Stats show_gene_sets /></div>
          <div className="stat-desc">Approx 700MB, Last Updated {latest_release_date}</div>
        </div>
      </a>
      <br />
      <br />
      <p>
        Developed in <a className='underline cursor' href="https://labs.icahn.mssm.edu/maayanlab/">the Ma&apos;ayan Lab</a>
      </p>
      
    </div>
  )
}
