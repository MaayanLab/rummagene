
import React from 'react'
import Image from 'next/image'
import Stats from '@/app/stats'

export default function Loading() {
  return (
    <>
        <div className="text-center p-5">
        <Image className={'rounded mx-auto'} src={'/images/loading.gif'} width={250} height={250} alt={'Loading...'}/> 
        <p>Rummaging through <Stats bold show_total_gene_sets /> that match your query.</p>
        </div>
    </> 
  )
}




