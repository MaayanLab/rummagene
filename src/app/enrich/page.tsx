import React from 'react'
import { Metadata, ResolvingMetadata } from 'next'
import EnrichClientPage from './client'

export async function generateMetadata(props: { searchParams: { dataset: string | string[] | undefined } }, parent: ResolvingMetadata): Promise<Metadata> {
  const parentMetadata = await parent
  return {
    title: `${parentMetadata.title?.absolute} | Gene set search`,
    keywords: parentMetadata.keywords,
  }
}

export default function EnrichPage(props: { searchParams: { dataset: string | string[] | undefined } }) {
  return <EnrichClientPage {...props} />
}
