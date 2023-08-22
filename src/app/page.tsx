import InputForm from "./inputForm";
import Image from "next/image";

export default function Home() {
  return (
    <>
      <div className="hero">
        <div className="hero-content flex-col lg:flex-row justify-center">
          <div className="card flex-shrink-0 max-w-xs shadow-2xl bg-base-100">
            <div className="card-body">
              <InputForm />
            </div>
          </div>
          <div className="text-center p-10">
            <h2 className="text-2xl font-bold p-2">
              Rummagene
            </h2>
            <div className='inline-flex'>
              <Image className={'rounded'} src={'/images/rummagene_logo.png'} width={225} height={225} alt={'Rummagene'}></Image>
            </div>
            <h1 className="text-2xl font-bold">
              <span className="whitespace-nowrap"> Rummage through 642,389 gene sets </span>
            </h1>
            <div>
            <span className="whitespace-nowrap">extracted from supporting tables of</span>
            <span className="whitespace-nowrap"> 121,237 publications</span>
            </div>
            <p>to find the most similar gene sets that match your query.</p>
            <div className="mt-5">
              <span className="whitespace-nowrap">We scanned supporting materials from <span className="font-bold">5,448,589 </span>listed on </span>
              <div>PubMed Central (PMC) to identify and extract gene sets.</div>
            </div>
            </div>
        </div>
      </div>
    </>
  )
}
