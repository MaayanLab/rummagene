import './globals.css'
import type { Metadata } from 'next'
import Link from "next/link"
import Nav from './nav'
import Stats from './stats'

export const metadata: Metadata = {
  title: 'BioTableMind',
  description: 'Find published gene sets',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode,
}) {
  return (
    <html lang="en">
      <body>
        <main className="flex flex-col">
          <div className="navbar">
            <div className="flex flex-col items-start">
              <Link
                className="btn btn-ghost normal-case text-xl"
                href="/"
              >BioTableMind</Link>
              <ul className="menu menu-horizontal gap-3">
                <Nav />
              </ul>
            </div>
            <div className="flex-1"></div>
            <div className="flex-none flex-col place-items-end">
              <Stats />
            </div>
          </div>
          <div className="container mx-auto">
            {children}
          </div>
        </main>
      </body>
    </html>
  )
}
