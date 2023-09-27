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
      <div className="grid lg:grid-cols-2 gap-4 my-4">
        <a className="stats shadow" href="https://s3.dev.maayanlab.cloud/biotablemind/table-mining.gmt.gz" download="table-mining.gmt.gz">
          <div className="stat gap-2">
            <div className="stat-title">table-mining.gmt.gz</div>
            <div className="stat-value">729,968 columns</div>
            <div className="stat-desc whitespace-normal">
            <span className="whitespace-nowrap">2GB compressed</span>, <span className="whitespace-nowrap">5GB uncompressed</span>, <span className="whitespace-nowrap">Last Updated Mon Aug 7 2023</span>
            </div>
          </div>
        </a>
        <a className="stats shadow" href="https://s3.dev.maayanlab.cloud/biotablemind/table-mining-clean.gmt.gz" download="table-mining-clean.gmt.gz">
          <div className="stat gap-2">
            <div className="stat-title">table-mining-clean.gmt.gz</div>
            <div className="stat-value">642,389 gene sets</div>
            <div className="stat-desc whitespace-normal">
              <span className="whitespace-nowrap">231MB compressed</span>, <span className="whitespace-nowrap">624MB uncompressed</span>, <span className="whitespace-nowrap">Last Updated Mon Aug 7 2023</span>
            </div>
          </div>
        </a>
        <a className="stats shadow" href="/download.gmt" download="download.gmt">
          <div className="stat gap-2">
            <div className="stat-title">latest.gmt</div>
            <div className="stat-value"><Stats show_gene_sets /></div>
            <div className="stat-desc whitespace-normal">
              <span className="whitespace-nowrap">Approx 700MB</span>, <span className="whitespace-nowrap">Last Updated {latest_release_date}</span>
            </div>
          </div>
        </a>
      </div>
      <p>
        Developed in <a className='underline cursor' href="https://labs.icahn.mssm.edu/maayanlab/">the Ma&apos;ayan Lab</a>
      </p>
      
    </div>
  )
}
