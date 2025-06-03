import './globals.css'
import React from 'react'
import type { Metadata } from 'next'
import { ApolloWrapper } from '@/lib/apollo/provider'
import { RuntimeConfig } from '@/app/runtimeConfig'
import Header from '@/components/header'
import Footer from '@/components/footer'
import Analytics from '@/app/analytics'

export const metadata: Metadata = {
  title: 'Rummagene',
  description: 'Find published gene sets from supporting tables of PubMed Central (PMC) articles',
  keywords: [
    'big data',
    'bioinformatics',
    'bone',
    'cancer',
    'cell line',
    'data ecosystem',
    'data portal',
    'data',
    'dataset',
    'diabetes',
    'disease',
    'drug discovery',
    'drug',
    'enrichment analysis',
    'gene set library',
    'gene set',
    'gene',
    'genomics',
    'heart',
    'kidney',
    'knowledge',
    'literature mining',
    'literature',
    'liver',
    'machine learning',
    'neurons',
    'papers',
    'peturbation',
    'pharmacology',
    'phenotype',
    'pmc',
    'protein',
    'proteomics',
    'publications',
    'pubmed',
    'RNA-seq',
    'RNAseq',
    'scRNA-seq',
    'single cell',
    'skin',
    'systems biology',
    'target discovery',
    'target',
    'therapeutics',
    'tissue',
    'transcriptomics',
  ].join(', '),
  metadataBase: new URL('https://rummagene.com'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Rummagene',
    description: 'Find published gene sets from supporting tables of PubMed Central (PMC) articles',
    url: 'https://rummagene.com',
    siteName: 'Rummagene',
    images: [{
      url: 'https://rummagene.com/images/rummagene_logo.png',
      width: 640,
      height: 671,
    }],
    locale: 'en_US',
    type: 'website',
  },
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: false,
      noimageindex: true,
    },
  },
}

export default function RootLayout({
  children,
  jsonld,
}: {
  children: React.ReactNode,
  jsonld?: React.ReactNode,
}) {
  return (
    <html lang="en" style={{ minWidth: '580px' }}>
      <head>
        {jsonld}
      </head>
      <ApolloWrapper>
        <RuntimeConfig>
          <body className="min-h-screen flex flex-col">
            <React.Suspense fallback={null}>
              <Header />
              <main className="flex-1 flex flex-col justify-stretch mx-8 md:mx-32">
                <React.Suspense fallback={<span className="loading loading-ring loading-lg"></span>}>
                  {children}
                </React.Suspense>
              </main>
              <Footer />
            </React.Suspense>
          </body>
          <Analytics />
        </RuntimeConfig>
      </ApolloWrapper>
    </html>
  )
}
