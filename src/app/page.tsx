import InputForm from "./inputForm";

export default function Home() {
  return (
    <>
      <div className="hero">
        <div className="hero-content flex-col lg:flex-row">
          <div className="card flex-shrink-0 max-w-xs shadow-2xl bg-base-100">
            <div className="card-body">
              <InputForm />
            </div>
          </div>
          <div className="text-center lg:text-center p-5">
            <h1 className="text-2xl font-bold">
              <span className="whitespace-nowrap"> Rummage through 642,389 gene sets
              </span> </h1><span className="whitespace-nowrap">extracted from supporting tables of</span>
              <span className="whitespace-nowrap"> 121,237 publications</span>
              <p>to find the most similar gene sets that match your query.</p>
          </div>
        </div>
      </div>
    </>
  )
}
