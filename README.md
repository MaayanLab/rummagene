# SigCom-Lite

This is a "light-weight" implementation of the SigCom backend. Rather than splitting up the meta and data APIs, all functionality is incorporated into a postgres database.

We use postgraphile to serve the database on a graphql endpoint -- this endpoint can then be used for all necessary sigcom functionality, including both metadata search, filtering, and enrichment analysis.

## Usage
```bash
# prepare environment variables
cp .env.example .env
# review & edit .env

# start db/graphql
docker-compose up -d
# visit http://localhost:5000/graphiql

# create db
dbmate up
```

## Provisioning
```bash
python ingest.py -i your-gmt.gmt -n 'Your GMT' -d 'Your description'
```

## Example Queries
```gql
# Perform enrichment analysis against a specific library
query EnrichmentQuery($libraryName: String, $genes: [String]) {
  geneSetLibraries(condition: {name: $libraryName}) {
    nodes {
      enrichFixedBackgroundSize(
        genes: $genes
        pvalueLessThan: 1
        adjPvalueLessThan: 1
        overlapGreaterThan: "0"
        backgroundSize: "20000"
        first: 10
      ) {
        edges {
          node {
            pvalue
            adjPvalue
            oddsRatio
            geneSet {
              term
            }
            overlapGenes {
              nodes {
                symbol
              }
            }
          }
        }
      }
    }
  }
}

# Gene search: find all genesets containing certain gene(s)
query GeneSetGeneSearch($genes: [String]) {
  geneSetGeneSearch(genes: $genes) {
    nodes {
      term
      library {
        name
      }
    }
  }
}

# Term search: find all genesets containing certain term(s)
query GeneSetTermSearch($terms: [String]) {
  geneSetTermSearch(terms: $terms) {
    nodes {
      term
      library {
        name
      }
    }
  }
}
```
