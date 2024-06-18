'use client'
import React from 'react'
import Stats from "@/app/stats";
import { useLatestReleaseQuery } from "@/graphql";

// TODO: have downloads as a table in the database
const downloads = [
  {
    url: 'https://s3.amazonaws.com/maayanlab-public/rummagene/table-mining.gmt.gz',
    filename: 'table-mining.gmt.gz',
    title: 'table-mining.gmt.gz',
    value: '729,968 columns',
    size: <><span className="whitespace-nowrap">2GB compressed</span>, <span className="whitespace-nowrap">5GB uncompressed</span></>,
    updated: new Date('Aug 7 2023'),
  },
  {
    url: 'https://s3.amazonaws.com/maayanlab-public/rummagene/table-mining-clean-with-desc.gmt.gz',
    filename: 'table-mining-clean-with-desc.gmt.gz',
    title: 'table-mining-clean-with-desc.gmt.gz',
    value: '642,389 gene sets',
    size: <><span className="whitespace-nowrap">253MB compressed</span>, <span className="whitespace-nowrap">752MB uncompressed</span></>,
    updated: new Date('Jan 5 2024'),
  },
  {
    url: 'https://s3.amazonaws.com/maayanlab-public/rummagene/table-mining-clean.gmt.gz',
    filename: 'table-mining-clean.gmt.gz',
    title: 'table-mining-clean.gmt.gz',
    value: '642,389 gene sets',
    size: <><span className="whitespace-nowrap">231MB compressed</span>, <span className="whitespace-nowrap">624MB uncompressed</span></>,
    updated: new Date('Aug 7 2023'),
  },
  {
    url: 'https://s3.amazonaws.com/maayanlab-public/rummagene/umap.tsv.gz',
    filename: 'umap.tsv.gz',
    title: 'umap.tsv.gz',
    value: '642,389 points',
    size: <><span className="whitespace-nowrap">12.4MB compressed</span>, <span className="whitespace-nowrap">51.3MB uncompressed</span></>,
    updated: new Date('Oct 2 2023'),
  },
]

export default function DownloadClientPage() {
  const { data } = useLatestReleaseQuery()
  const latest_release_date = React.useMemo(() => new Date(data?.releases?.nodes[0]?.created), [data])
  const downloads_with_latest = React.useMemo(() => {
    const downloads_with_latest = [
      ...downloads,
      {
        url: '/latest.gmt',
        filename: 'latest.gmt',
        title: 'latest.gmt',
        value: <Stats show_gene_sets />,
        size: <><span className="whitespace-nowrap">Approx 700MB</span></>,
        updated: latest_release_date,
      },
    ]
    downloads_with_latest.sort((a, b) => a.updated < b.updated ? 1 : -1)
    return downloads_with_latest
  }, [latest_release_date])
  return (
    <div className="prose">
      <h2 className="title text-xl font-medium mb-3">Downloads</h2>
      <br />
      <p>
        This database is updated weekly to extract gene sets automatically from newly published open access PMC articles.
      </p>
      <div className="grid lg:grid-cols-2 gap-4 my-4">
        {downloads_with_latest.map(download => (
          <a key={download.url} className="stats shadow" href={download.url} download={download.filename}>
            <div className="stat gap-2">
              <div className="stat-title">{download.title}</div>
              <div className="stat-value">{download.value}</div>
              <div className="stat-desc whitespace-normal">
                {download.size}, <span className="whitespace-nowrap">Last Updated {download.updated.toDateString()}</span>
              </div>
            </div>
          </a>
        ))}
      </div>
      <p>
        Developed in <a className='underline cursor' href="https://labs.icahn.mssm.edu/maayanlab/">the Ma&apos;ayan Lab</a>
      </p>
      
    </div>
  )
}
