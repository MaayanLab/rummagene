import postgraphile from '@/lib/postgraphile'
import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.statusCode = 200
  await new Promise<void>((resolve, reject) => postgraphile(req, res, (err) => { if (err) { reject(err) } else { resolve() } }))
  res.end()
}

export const config = {
  api: {
    bodyParser: false,
  }
}