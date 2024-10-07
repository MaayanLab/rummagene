import React from 'react'
import Image from "next/image"
import Stats from "../stats"
import Link from "next/link"
import { Metadata, ResolvingMetadata } from 'next'

export async function generateMetadata(props: {}, parent: ResolvingMetadata): Promise<Metadata> {
  const parentMetadata = await parent
  return {
    title: `${parentMetadata.title?.absolute} | About`,
    keywords: parentMetadata.keywords,
  }
}

export default async function About() {
  return (
    <div className="prose">
      
      <div className="flex">
        
        <div className="flex-col justify-center mx-auto">
        <h2 className="title text-xl font-medium mb-3">About PFOCRummage</h2>
        <Image className={'rounded float-right ml-5'} src={'/images/PFOCRummageBlack.png'} width={250} height={250} alt={'Rummagene'}></Image>
          <p className="text-justify max-w-5xl">
          Many biomedical research papers are published contain diagrams containing gene symbols representing pathways and biological processes. 
          These diagrams capture the relationships between genes, cells, diseases and other perturbations. The <a  className='underline cursor' href='https://pfocr.wikipathways.org/' target='_blank'>Pathway Figure Optical Character Recognition (PFOCR)</a> 
          <span> </span>is a open science initiative which extracts gene sets from published articles in PubMed Central. Currently PFOCRummage serves <Stats show_gene_sets bold /> from <Stats show_pmcs bold />.
          These gene sets are served for enrichment analysis, free text and term search. Users of PFOCRummage can submit their own gene sets to
          find matching gene sets ranked by their overlap with the input gene set.
          </p>
          
          <br></br>
          <p>
            This database is updated monthly to use the latest human release of <a className='underline cursor' href='https://data.wikipathways.org/pfocr/current' target='_blank'>PFOCR</a>.
          </p>
          <br />
          <p>
            This site is programatically accessible via a <Link href="/graphiql" className="underline cursor-pointer" target="_blank">GraphQL API</Link>.
          </p>
          <br />
          <p>
          This site is based on the <a className='underline cursor' href="https://rummagene.com" target="_blank">Rummagene</a> framework developed by <a className='underline cursor' href="https://labs.icahn.mssm.edu/maayanlab/">the Ma&apos;ayan Lab</a>
          </p>
        </div>
       
      </div>
      
    </div>
  )
}
