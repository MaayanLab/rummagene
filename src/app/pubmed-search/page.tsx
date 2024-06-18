import React from 'react'
import { Metadata, ResolvingMetadata } from 'next'
import PubMedSearchClientPage from './client'

export async function generateMetadata(props: { searchParams?: { q?: string } }, parent: ResolvingMetadata): Promise<Metadata> {
  const parentMetadata = await parent
  return {
    title: `${parentMetadata.title?.absolute} | PMC search ${props.searchParams?.q ?? ''}`,
    keywords: [
      ...(props.searchParams?.q ? [props.searchParams.q] : []),
      ...(parentMetadata.keywords ?? []),
    ].join(', '),
  }
}

export default function PubMedSearchPage(props: { searchParams?: { q?: string, page?: string } }) {
  return <PubMedSearchClientPage {...props} />
}
