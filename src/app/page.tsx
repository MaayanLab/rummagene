import React from "react";
import InputForm from "./inputForm";
import Image from "next/image";
import Stats from "./stats";

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
            <React.Suspense fallback={<div className="text-center p-5"><Image className={'rounded mx-auto'} src={'/images/loading.gif'} width={125} height={250} alt={'Loading...'}/> </div>}>
            <h1 className="text-2xl font-bold">
              <span className="whitespace-nowrap"> Rummage through <Stats show_gene_sets={true} /></span>
            </h1>
            <div>
              <span className="whitespace-nowrap">extracted from supporting tables of</span>
              <span className="whitespace-nowrap"> <Stats show_pmcs={true} /></span>
              <p> to find the most similar gene sets that match your query.</p>
            </div>
            <div className="mt-5">
              <span className="whitespace-nowrap">We scanned supporting materials from <span className="font-bold">5,448,589 </span>publications </span>
              <div><span className="whitespace-nowrap">listed on PubMed Central (PMC) to identify and extract gene sets.</span></div>
            </div>
            </React.Suspense>
          </div>
        </div>
      </div>
    </>
  )
}
