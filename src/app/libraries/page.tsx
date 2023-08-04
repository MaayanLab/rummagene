'use client'
import { useSuspenseQuery } from '@apollo/experimental-nextjs-app-support/ssr'
import { GeneSetLibrariesQuery, GeneSetLibrariesDocument } from "@/graphql"

export default function LibrariesPage() {
  const { data } = useSuspenseQuery<GeneSetLibrariesQuery>(GeneSetLibrariesDocument)
  return (
    <div className="mx-64">
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
    </div>
  )
}