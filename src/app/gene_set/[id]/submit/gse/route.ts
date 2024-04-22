import getItem from "../../item"
import { redirect } from 'next/navigation'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const geneSet = await getItem(params.id)
  if (!geneSet.data.geneSetByTerm) return new Response(JSON.stringify({error: 'Not Found'}), { status: 404 })
  const formData = new FormData()
  formData.append('list', geneSet.data.geneSetByTerm.genes.nodes.map(gene => gene.symbol).join('\n'))
  formData.append('description', `Rummagene ${geneSet.data.geneSetByTerm.term}`)
  const req = await fetch('https://maayanlab.cloud/Enrichr/addList', {
    headers: {
      'Accept': 'application/json',
    },
    method: 'POST',
    body: formData,
  })
  const res = await req.json()
  if (!res.shortId) return new Response(JSON.stringify({error: 'Failed to Register Gene Set'}), { status: 500 })
  const searchParams = new URLSearchParams()
  searchParams.append('q', JSON.stringify({
    "userListId": res.userListId.toString(),
    "min_lib": 1,
    "libraries":[
      {"name":"LINCS_L1000_Chem_Pert_Consensus_Sigs","limit":5},
      {"name":"HuBMAP_ASCTplusB_augmented_2022","limit":5},
      {"name":"MoTrPAC_2023","limit":5},
      {"name":"Metabolomics_Workbench_Metabolites_2022","limit":5},
      {"name":"LINCS_L1000_CRISPR_KO_Consensus_Sigs","limit":5},
      {"name":"GTEx_Tissues_V8_2023","limit":5},
      {"name":"GlyGen_Glycosylated_Proteins_2022","limit":5},
      {"name":"IDG_Drug_Targets_2022","limit":5},
      {"name":"KOMP2_Mouse_Phenotypes_2022","limit":5},
      {"name":"GTEx_Aging_Signatures_2021","limit":5}
    ],
    "gene_limit":200,
    "search":true,
  }))
  redirect(`https://gse.cfde.cloud/?${searchParams.toString()}`)
}
