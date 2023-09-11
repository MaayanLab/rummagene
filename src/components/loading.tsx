
import React from 'react'
import Image from 'next/image'
import Stats from '@/app/stats'

export default function Loading() {
  return (
    <>
        <div className="text-center p-5">
        <Image className={'rounded mx-auto'} src={'/images/loading.gif'} width={125} height={250} alt={'Loading...'}/> 
        <p>Rummaging through <Stats show_gene_sets={true}/> gene sets extracted from supporting tables of <Stats show_pmcs={true}/> to find the most similar gene sets that match your query.</p>
        </div>
    </> 
  )
}




