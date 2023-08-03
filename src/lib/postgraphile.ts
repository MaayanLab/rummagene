import { postgraphile } from 'postgraphile'
import { v4 as uuidv4 } from 'uuid'

const AUTHORIZATION_HEADER = process.env.AUTHORIZATION_HEADER || `Token ${uuidv4()}`

export default postgraphile(
  process.env.DATABASE_URL,
  "app_public",
  {
    enableCors: true,
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
