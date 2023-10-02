import type { NextApiRequest, NextApiResponse } from "next"

export default function runtimeConfig(req: NextApiRequest, res: NextApiResponse) {
  const runtimeConfig: Record<string, string> = {}
  Object.keys(process.env)
    .filter(key => key.startsWith('NEXT_PUBLIC_'))
    .forEach(key => {
      runtimeConfig[key] = process.env[key] as string
    })
  res.status(200).json(runtimeConfig)
}
