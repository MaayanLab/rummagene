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

## Example Queries
```gql
# Add a gene set library to the database
mutation ImportGeneSetLibrary($downloadUrl: String, $name: String, $description: String) {
  importGeneSetLibrary(
    input: {downloadUrl: $downloadUrl, name: $name, description: $description}
  ) {
    geneSetLibrary {
      id
    }
  }
}

# Perform enrichment analysis against a specific library
query EnrichmentQuery($libraryName: String, $genes: [String]) {
  allGeneSetLibraries(condition: {name: $libraryName}) {
    nodes {
      enrich(genes: $genes, returnOverlapGeneIds: true) {
        nodes {
          pvalue
          adjPvalue
          overlap
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

# Gene search: find all genesets containing certain gene(s)
query GeneSetGeneSearch($genes: [String]) {
  geneSetGeneSearch(genes: $genes) {
    nodes {
      term
      geneSetLibraryByLibraryId {
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
      geneSetLibraryByLibraryId {
        name
      }
    }
  }
}

```