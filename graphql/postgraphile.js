const http = require("http")
const { postgraphile } = require("postgraphile")
const { v4: uuidv4 } = require('uuid')

const AUTHORIZATION_HEADER = process.env.AUTHORIZATION_HEADER || `Token ${uuidv4()}`

http
  .createServer(
    postgraphile(
      process.env.DATABASE_URL,
      "app_public",
      {
        retryOnInitFail: process.env.NODE_ENV === 'production' ? true : false,
        dynamicJson: true,
        watchPg: process.env.NODE_ENV === 'production' ? false : true,
        setofFunctionsContainNulls: false,
        disableDefaultMutations: true,
        ignoreRBAC: false,
        ignoreIndexes: false,
        extendedErrors: process.env.NODE_ENV === 'production' ? ['errcode'] : ['hint', 'detail', 'errcode'],
        showErrorStack: process.env.NODE_ENV === 'production' ? undefined : 'json',
        appendPlugins: [require("@graphile-contrib/pg-simplify-inflector")],
        graphiql: true,
        enhanceGraphiql: true,
        enableQueryBatching: true,
        disableQueryLog: process.env.NODE_ENV === 'production',
        legacyRelations: 'omit',
        allowExplain(req) {
          return process.env.NODE_ENV !== 'production'
        },
        pgSettings(req) {
          const role = req.headers.authorization === AUTHORIZATION_HEADER ? 'authenticated' : 'guest'
          return { role }
        }
      }
    )
  )
  .listen(5000, '0.0.0.0', () => {
    console.log('listening on http://0.0.0.0:5000')
  })
