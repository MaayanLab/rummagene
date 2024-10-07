import React from 'react'
import { Metadata, ResolvingMetadata } from 'next'
import TermSearchClientPage from './client'

export async function generateMetadata(props: { searchParams?: { q?: string } }, parent: ResolvingMetadata): Promise<Metadata> {
  const parentMetadata = await parent
  return {
    title: `${parentMetadata.title?.absolute} | Term search ${props.searchParams?.q ?? ''}`,
    keywords: [
      ...(props.searchParams?.q ? [props.searchParams.q] : []),
      ...(parentMetadata.keywords ?? []),
    ].join(', '),
  }
}

export default function TermSearchPage(props: { searchParams?: { q?: string, page?: string } }) {
  return <TermSearchClientPage {...props} />
}
