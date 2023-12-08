# Rummagene

<https://rummageo.com/>

This is a webserver for gene set enrichment analysis on a very large gene set -- one constructed by extracting gene sets from uniformly aligned GEO samples from ARCHS4.

## Development
Rather than splitting up the meta and data APIs, all functionality is incorporated into a postgres database.

We use postgraphile to serve the database on a graphql endpoint -- this endpoint can then be used for all necessary functionality, including both metadata search, filtering, and enrichment analysis. For speed purposes, enrichment is done through a companion API written in rust, the database itself communicates with this API, it is transparent to the application or users of the database.

### Usage
```bash
# prepare environment variables
cp .env.example .env
# review & edit .env

# start db
docker-compose up -d rummageo-postgres

# create db/ensure it's fully migrated
dbmate up

# start companion API
docker-compose up -d rummageo-enrich

# start app (production)
docker-compose up -d rummageo-app
# start app (development)
npm run dev
```

### Provisioning
```bash
python ./bot/helper.py ingest -i your-gmt.gmt
python ./bot/helper.py ingest-gse-info
python ./bot/helper.py ingest-pb-info
```

### Writing Queries
See `src/graphql/core.graphql`
These can be tested/developed at <http://localhost:3000/graphiql>
