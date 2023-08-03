'use client';
import client from "@/lib/apollo-client";
import { useGeneSetLibrariesQuery } from "@/graphql";

export default function Home() {
  const { data: geneSetLibraries } = useGeneSetLibrariesQuery({ client })
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <ul>
        {geneSetLibraries?.geneSetLibraries?.nodes?.map(library => (
          <li key={library.name} className="prose">{library.name}</li>
        )) ?? null}
      </ul>
    </main>
  )
}
