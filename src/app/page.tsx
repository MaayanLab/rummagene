import InputForm from "./inputForm";

export default function Home() {
  return (
    <>
      <div className="hero">
        <div className="hero-content flex-col lg:flex-row">
          <div className="text-center lg:text-left">
            <h1 className="text-2xl font-bold">
              <span className="whitespace-nowrap">Find PMC</span> <span className="whitespace-nowrap">articles</span> that contain tables that match your <span className="whitespace-nowrap">gene set</span></h1>
            <p className="py-4">BioTableMind is a database of massively mined gene sets from Open Access PMC articles tables and supplementary material.</p>
            <p className="py-4">Using this application, you can find papers relevant to your data through a data driven search.</p>
            <p className="py-4">After submitting a gene set, gene sets from the literature will be enriched.</p>
          </div>
          <div className="card flex-shrink-0 max-w-xs shadow-2xl bg-base-100">
            <div className="card-body">
              <InputForm />
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
