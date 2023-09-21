/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/graphql',
        destination: '/api/graphql',
      },
      {
        source: '/graphiql',
        destination: '/api/graphiql',
      },
      {
        source: '/download.gmt',
        destination: '/api/download.gmt',
      },
    ]
  },
}

module.exports = nextConfig
