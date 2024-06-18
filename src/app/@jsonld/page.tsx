export default function JSONLD() {
  return <script
    type="application/ld+json"
    dangerouslySetInnerHTML={{ __html: JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      'url': 'https://rummagene.com',
      'potentialAction': [
        {
          "@type": "SearchAction",
          "target": "https://rummagene.com/pubmed-search?q={query}",
          "query-input": "required name=query",
          "name": "PMC Search",
          "description": "Query PubMed Central and receive gene sets extracted from the returned paper",
        },
        {
          "@type": "SearchAction",
          "target": "https://rummagene.com/term-search?q={query}",
          "query-input": "required name=query",
          "name": "Table title search",
          "description": "Query extracted gene set table titles to find relevant gene sets",
        }
      ],
    }) }}
  />
}
