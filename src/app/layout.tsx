import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'PMC Enrichr',
  description: 'Enrich PMC Articles',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
