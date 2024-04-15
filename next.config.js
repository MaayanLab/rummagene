/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: ['*'],
    },
  },
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
    ]
  },
}

module.exports = nextConfig
