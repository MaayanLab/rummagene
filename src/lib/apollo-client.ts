import { ApolloClient, InMemoryCache } from "@apollo/client"

const client = new ApolloClient({
  uri: `${typeof window === 'undefined' ? 'http://localhost:3000' : ''}/graphql`,
  cache: new InMemoryCache(),
})

export default client