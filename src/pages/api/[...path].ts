import postgraphile from '@/lib/postgraphile'
import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  let { method, body } = req
  const path = Array.isArray(req.query.path) ? req.query.path.join('/') : req.query.path ?? ''
  if (path === 'graphql' && method === 'GET') {
    req.method = 'POST'
    req.body = {
      query: req.query.query,
      operationName: req.query.operationName,
      variables: req.query.variables,
    }
  }
  try {
    await new Promise<void>(
      (resolve, reject) => postgraphile(req, res,
        (err) => {
          req.method = method
          req.body = body
          if (err) {
            reject(err)
          } else {
            resolve()
          }
        }
      )
    )
    res.statusCode = 200
  } catch (e) {
    res.statusCode = 500
  } finally {
    res.end()
  }
}

export const config = {
  api: {
    bodyParser: false,
  }
}