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
          shallow>Analyze</Link></li>
      <li>
        <Link
          href="/libraries"
          className={classNames({ 'active': pathname === '/libraries' })}
          shallow>Libraries</Link></li>
      <li>
        <Link
          href="/gene-search"
          className={classNames({ 'active': pathname === '/gene-search' })}
          shallow>Gene search</Link></li>
      <li>
        <Link
          href="/term-search"
          className={classNames({ 'active': pathname === '/term-search' })}
          shallow>Term search</Link></li>
      <li>
        <Link
          href="/about"
          className={classNames({ 'active': pathname === '/about' })}
          shallow>About</Link></li>
    </>
  )
}
