import './globals.css'
import type { Metadata } from 'next'
import Link from "next/link"
import { ApolloWrapper } from '@/lib/apollo/provider'
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
      <body className="min-h-screen flex flex-col">
        <ApolloWrapper>
          <main className="flex-1 flex flex-col">
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
            <div className="mx-auto">
              {children}
            </div>
          </main>
          <footer className="flex-none footer p-10 bg-neutral text-neutral-content flex place-content-evenly">
            <div className="text-center">
              <ul>
                <li><Link href="/">Contact Us</Link></li>
                <li><Link href="/">Usage License</Link></li>
              </ul>
            </div>
            <div className="text-center">
              <p><Link href="https://labs.icahn.mssm.edu/maayanlab/">Ma&apos;yan Lab</Link></p>
            </div>
            <div className="text-center">
              <ul>
                <li><Link href="/">View Source Code</Link></li>
                <li><Link href="/">Submit an Issue</Link></li>
              </ul>
            </div> 
          </footer>
        </ApolloWrapper>
      </body>
    </html>
  )
}
