import Image from "next/image"

export default function About() {
  return (
    <div className="prose p-5">


      <h2 className="title text-xl font-medium mb-3">About Rummagene</h2>
      <div className="flex">
        <div className="flex-col">
          <p className="text-justify">
          Many biomedical research papers are published every day with a portion of them containing supporting tables with 
          data about genes, transcripts, variants, and proteins. For example, supporting tables may contain differentially 
          expressed genes and proteins from transcriptomics and proteomics studies, targets of transcription factors from 
          ChIP-seq experiments, hits from genome-wide CRISPR screens, or genes identified to harbor mutations from GWAS studies. 
          Because these gene sets are commonly buried in the supplemental tables of research publications, they are not widely 
          available for search and reused. Rummagene is a web server application that provides access to thousands of human and
          mouse gene sets extracted from supporting materials of publications listed on PubMed Central (PMC). To created 
          Rummagene, we first developed a softbot that extracts human and mouse gene sets from supporting tables of PMC publications. 
          So far, the softbot scanned 5,448,589 PMC articles to find 121,237 articles that contain 642,389. These gene sets are 
          served for enrichment analysis, free text, table title search. Users of Rummagene can submit their own gene sets to 
          find matching gene sets ranked by their overlap with the input gene set. In addition to providing the extracted gene 
          sets for search, we investigated the massive corpus of these gene sets for statistical patterns. We show how Rummagene 
          can be used for transcription factor and kinase enrichment analyses, for universal predictions of cell types for single 
          cell RNA-seq data, and for gene function predictions. Finally, by combining gene set similarity with abstract similarity, 
          Rummagene can be used to find surprising relationships between unexpected biological processes, concepts, and named entities.  
          </p>
          
          <br></br>
          <p>
            This database is updated weekly to extract gene sets automatically from newly published open access PMC articles.
          </p>
          <br></br>
          <p>
            Developed in <a className='underline cursor' href="https://labs.icahn.mssm.edu/maayanlab/">the Ma&apos;ayan Lab</a>
          </p>
        </div>
        <div className="flex-col p-10">
        <Image className={'rounded'} src={'/images/rummagene_logo.png'} width={8000} height={225} alt={'Rummagene'}></Image>
        </div>
      </div>
      
    </div>
  )
}
