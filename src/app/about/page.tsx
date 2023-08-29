export default function About() {
  return (
    <div className="prose">


      <h2 className="title text-xl font-medium mb-3">About Rummagene
      </h2>
      <p>
        Many biomedical research papers are published every day with a portion of them containing supporting tables with data about 
        genes, transcripts, and proteins. For example, supporting tables may contain differentially expressed genes and proteins 
        from proteomics and transcriptomics studies, targets of transcription factors from ChIP-seq experiments, hits from 
        genome-wide CRISPR screens, or genes identified to harbor mutations from GWAS studies. Because these gene sets are buried 
        in these supplemental tables, they are not widely available for search and reused. Rummagene is a web server application 
        that provides access to thousands of human and mouse gene sets extracted from publications listed on PubMed Central (PMC). 
        To created Rummagene, we developed a web crawler softbot that extracts human and mouse gene sets from supporting tables of 
        PMC publications. So far, the softbot scanned 5,448,589 PMC articles to find 121,237 articles that contain 642,389. These 
        gene sets are served for search and enrichment analysis. Users of Rummagene can submit their own gene sets to find matching 
        gene sets ranked by their overlap with the input gene set. In addition to providing the extracted gene set for search, we 
        investigated the massive corpus of gene sets for statistical patterns and utility for other applications. We show how the 
        Rummagene can be used for transcription factor and kinase enrichment analyses, universal predictions of cell types for single 
        cell RNA-seq data, and for gene function predictions. Finally, by combining gene set similarity with abstract similarity, 
        Rummagene can be used to find surprising relationships between unexpected biological processes, concepts, and entities. 
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
  )
}
