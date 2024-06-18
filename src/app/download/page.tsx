import React from 'react'
import { Metadata, ResolvingMetadata } from 'next'
import DownloadClientPage from './client'

export async function generateMetadata(props: {}, parent: ResolvingMetadata): Promise<Metadata> {
  const parentMetadata = await parent
  return {
    title: `${parentMetadata.title?.absolute} | Downloads`,
    keywords: parentMetadata.keywords,
  }
}

export default function DownloadPage() {
  return <DownloadClientPage />
}
