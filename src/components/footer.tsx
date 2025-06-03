'use client'
import React from 'react'
import Link from "next/link"
import Image from 'next/image'

export default function Footer() {
  return (
    <footer className="flex-none footer p-5 mt-5 bg-neutral text-neutral-content flex place-content-evenly">
      <div className="text-center pt-5">
        <ul>
          <li><Link href="mailto:avi.maayan@mssm.edu" target="_blank">Contact Us</Link></li>
          <li>
            <Link href="https://github.com/MaayanLab/rummagene" target="_blank" rel="noopener noreferrer">
              Source Code
            </Link>
          </li>
        </ul>
      </div>
      <div className="text-center">
      <p>
          <Link href="https://labs.icahn.mssm.edu/" target="_blank" rel="noopener noreferrer">
            <Image src={'/images/ismms_white.png'} width={150} height={250} alt={'Ma&apos;ayan Lab'}/>
          </Link>
        </p>
      </div>
      <div className="text-center pt-5">
      <p>
        <Link href="https://labs.icahn.mssm.edu/maayanlab/" target="_blank" rel="noopener noreferrer">
          <Image className={'rounded'} src={'/images/maayanlab_white.png'} width={125} height={250} alt={'Ma&apos;ayan Lab'}/>
        </Link>
        </p>
      </div>
      <div className="text-center pt-5">
        <ul>
          <li>
            <Link href="https://creativecommons.org/licenses/by-nc-sa/4.0/" target="_blank">
              <Image src="/images/cc-by-nc-sa.png" alt="CC-by-NC-SA" width={117} height={41} />
            </Link>
          </li>
        </ul>
      </div> 
    </footer>
  )
}