import postgraphile from '@/lib/postgraphile'
import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  let { method, body } = req
  res.statusCode = 200
  if (method === 'GET') {
    req.method = 'POST'
    req.body = {
      query: req.query.query,
      operationName: req.query.operationName,
      variables: req.query.variables,
    }
  }
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
  res.end()
}

export const config = {
  api: {
    bodyParser: false,
  }
}