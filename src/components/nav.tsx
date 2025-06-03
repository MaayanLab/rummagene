'use client'

import Link from "next/link"
import classNames from 'classnames'
import { usePathname } from "next/navigation"

export default function Nav() {
  const pathname = usePathname()
  return (
    <>
      <li>
        <Link
          href="/"
          className={classNames({ 'active': pathname === '/' || pathname === '/enrich' })}
          shallow>Gene set search</Link></li>
      <li>
        <Link
          href="/pubmed-search"
          className={classNames({ 'active': pathname === '/pubmed-search' })}
          shallow>PMC search</Link></li>
      <li>
        <Link
          href="/term-search"
          className={classNames({ 'active': pathname === '/term-search' })}
          shallow>Table title search</Link></li>
      <li>
        <Link
          href="/download"
          className={classNames({ 'active': pathname === '/download' })}
          shallow>Download</Link></li>
      <li>
        <Link
          href="/about"
          className={classNames({ 'active': pathname === '/about' })}
          shallow>About</Link></li>

    </>
  )
}
