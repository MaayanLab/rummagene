'use client'
import client from '@/lib/apollo-client'
import { useGeneSetLibrariesQuery } from "@/graphql"

export default function LibrariesPage() {
  const { data } = useGeneSetLibrariesQuery({ client })
  return (
    <div className="overflow-x">
      <table className="table table-sm">
        <thead>
          <tr>
            <th>Gene-set Library</th>
            <th>Terms</th>
            <th>Gene Coverage</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {data?.geneSetLibraries?.nodes.map(library => (
            <tr key={library.name}>
              <td>{library.name}</td>
              <td>{library.geneSetsByLibraryId.totalCount}</td>
              <td>{library.backgroundGenes.totalCount}</td>
              <td><button className="btn btn-ghost text-4xl">⭳</button></td>
            </tr>
          )) ?? null}
        </tbody>
      </table>
    </div>
  )
}