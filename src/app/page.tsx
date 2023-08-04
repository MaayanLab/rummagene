import InputForm from "./inputForm";

export default function Home() {
  return (
    <>
      <div className="hero">
        <div className="hero-content flex-col lg:flex-row">
          <div className="text-center lg:text-left">
            <h1 className="text-4xl font-bold">
              <span className="whitespace-nowrap">Find PMC</span> <span className="whitespace-nowrap">Articles</span> by <span className="whitespace-nowrap">Gene Set</span></h1>
            <p className="py-6">BioTableMind is a database of massively mined gene sets from Open Access PMC articles tables and supplementary material.</p>
            <p>Using this application, you can find papers relevant to your data through a data driven search.</p>
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
