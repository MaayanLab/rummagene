import React from 'react'

export default function LinkedTerm({ term }: { term?: string | null }) {
  const { paper, rest } = React.useMemo(() => {
    if (term) {
      const m = /^(PMC\d+)(.+)$/.exec(term)
      if (m) {
        return { paper: m[1], rest: m[2] }
      }
    }
    return { rest: term ?? null }
  }, [term])
  return (
    <>
      {paper ?
        <a
          className="underline cursor-pointer"
          href={`https://www.ncbi.nlm.nih.gov/pmc/articles/${paper}/`}
          target="_blank"
          rel="noreferrer"
        >{paper}</a>
        : null}
      {rest}
    </>
  )
}
