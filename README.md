# BioTableMind

<https://biotablemind.dev.maayanlab.cloud/>

This is a webserver for gene set enrichment analysis on a very large gene set -- one constructed by extracting gene sets from PMC OA, see <https://github.com/MaayanLab/TableMining> for that.

Rather than splitting up the meta and data APIs, all functionality is incorporated into a postgres database.

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
See `src/graphql/core.graphql`

## Next Steps
- [ ] ingest metadata about the PMCs  (<https://ftp.ncbi.nlm.nih.gov/pub/pmc/>)
  - `PMC-ids.csv.gz` has info like PMIDs/DOIs, Journal, Date of Publication, and more for PMCs
  - DOIs can be used to extract more information with datacite
  - [ ] use this information to enrich the website
- [ ] proper pagination support throughout the UI

## Future Directions
I expect to work on this when I get back - daniel

- [ ] originally I was using gene_ids in a jsonb field, I want to go back to this since it's simpler, faster to load, & performs better, the only reason I moved to fully normalized was in an attempt to speed up enrichment analysis, but in the end I don't think it helped.
- [ ] I have code for very fast queries using precomputed bitvectors, just need to work out computation of those bitvectors on ingest, keeping them up to date, and using them for enrichment queries.
