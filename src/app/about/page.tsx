import Image from "next/image"
import Stats from "../stats"
import Link from "next/link"

export default function About() {
  return (
    <div className="prose">
      <h2 className="title text-xl font-medium mb-3">About Rummageo</h2>
      <div className="flex">
        <div className="flex-col">
        <Image className={'rounded float-right ml-5'} src={'/images/rummageo_logo.png'} width={250} height={250} alt={'Rummagene'}></Image>
          <p className="text-justify">
            Rummageo is a tool for searching through automatically generated signatures from GEO. 
            We performed automatic identification of conditions from uniformly aligned GEO studies available from <Link href="https://maayanlab.cloud/archs4/" className="underline cursor-pointer" target="_blank">ARCHS4</Link> to 
            compute differential expression signatures and extract gene sets. In total we extracted <Stats show_human_gene_sets bold/> and <Stats show_mouse_gene_sets bold/> from <Stats show_gses bold/> GEO studies. 
            We considered any GEO study aligned in ARCHS4 with at least 3 samples per condition with at least 6 samples total and less than 50 samples total. Samples were grouped using metadata provided in the GEO study, 
            specifically using K-means clustering on the embedding of concatenated sample <span style={{fontStyle: "italic"}}>title</span>, <span style={{fontStyle: "italic"}}>characteristic_ch1</span>, and <span style={{fontStyle: "italic"}}>source_ch1</span> fields 
            and assuming the number of conditions (clusters) was equal to the total samples divided by 4 though this can converge to a smaller amount of clusters based upon the similarity of the metadata string embeddings. 
            To create condition titles, common words across all samples for each condition were retained. Limma voom was used to compute differential expression signatures for each condition against all other conditions in the study. Additionally for each study, we attempted to first identify any control conditions based upon meta data and discrete list of keywords. If one was identified it was used to compare to the other conditions first.
          </p>
          
          <br></br>
          <p>
            This database is updated with new releases of <Link href="https://maayanlab.cloud/archs4/index.html" className="underline cursor-pointer" target="_blank">ARCHS4</Link>.
          </p>
          <br />
          <p>
            This site is programatically accessible via a <Link href="/graphiql" className="underline cursor-pointer" target="_blank">GraphQL API</Link>.
          </p>
          <br />
          <>
          Rummagene is actively being developed by <a className='underline cursor' href="https://labs.icahn.mssm.edu/maayanlab/">the Ma&apos;ayan Lab</a>
          </>
        </div>
       
      </div>
      
    </div>
  )
}
