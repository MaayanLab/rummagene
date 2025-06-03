'use client'
import React from 'react'
import Nav from '@/components/nav'
import Stats from '@/components/stats'
import { useSearchParams } from 'next/navigation'

export default function Header() {
  const searchParams = useSearchParams()
  if (searchParams?.get('embed') !== null) return null
  return (
    <header>
      <div className="navbar block text-center">
        <div className="navbar-center">
          <ul className="menu menu-horizontal gap-3 text-lg justify-center">
            <Nav />
          </ul>
        </div>
        <div className="navbar-center ml-5">
          <React.Suspense fallback={<span className="loading loading-ring loading-lg"></span>}>
            <Stats bold show_sets_analyzed />
          </React.Suspense>
        </div>
      </div>
    </header>
  )
}