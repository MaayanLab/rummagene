import Image from 'next/image'
import React from 'react'
import Stats from '@/components/stats'

export default function HomeLayout({ children }: React.PropsWithChildren<{}>) {
  return (
    <div className="flex justify-center">
      <div className="flex flex-col lg:flex-row items-center justify-center">
        <div className="card max-w-xs shadow-2xl bg-base-100 flex-shrink-0">
          <div className="card-body">
            {children}
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
            <span className="whitespace-nowrap"> Rummage through <Stats bold show_gene_sets /></span>
          </h1>
          <div>
            <span className="whitespace-nowrap">extracted from supporting tables of</span>
            <span className="whitespace-nowrap"> <Stats bold show_pmcs /></span>
            <p> to find the most similar gene sets that match your query.</p>
          </div>
          <div className="mt-5">
            <span className="whitespace-nowrap">We scanned supporting materials from <Stats bold show_publications /> </span>
            <div><span className="whitespace-nowrap">listed on PubMed Central (PMC) to identify and extract gene sets.</span></div>
          </div>
          </React.Suspense>
        </div>
      </div>
    </div>
  )
}