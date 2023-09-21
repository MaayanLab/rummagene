import Stats from "@/app/stats";

export default function Download() {
  return (
    <div className="prose">
      <h2 className="title text-xl font-medium mb-3">Downloads</h2>
      <br />
      <p>
        This database is updated weekly to extract gene sets automatically from newly published open access PMC articles.
      </p>
      <br />
      <div className="flex flex-col items-center">
        <a href="/download.gmt" className="btn btn-lg p-12 flex flex-col flex-nowrap" download="download.gmt">
          <span>Download</span>
          <span><Stats show_gene_sets /></span>
          <span>(approx 700MB)</span>
        </a>
      </div>
      <br />
      <p>
        Developed in <a className='underline cursor' href="https://labs.icahn.mssm.edu/maayanlab/">the Ma&apos;ayan Lab</a>
      </p>
      
    </div>
  )
}
