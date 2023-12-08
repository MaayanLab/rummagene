import React from 'react'

export default function LinkedTerm({ term }: { term?: string | null }) {
  return (
    <>
        <a
          className="underline cursor-pointer"
          href={`https://www.ncbi.nlm.nih.gov/${term}/`}
        >{term}</a>
    </>
  )
}
