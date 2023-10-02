/**
 * Stream response from the backend API
 */
import type { NextApiRequest, NextApiResponse } from 'next'
import { Readable } from 'stream'

async function *yieldReadableStream(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader()
  while (true) {
    const data = await reader.read()
    if (data.value) yield data.value
    if (data.done) break
  }
}

export function toReadable(stream: Readable | ReadableStream<Uint8Array>) {
  if ('pipe' in stream) return stream
  return Readable.from(yieldReadableStream(stream))
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const backendReq = await fetch(`${process.env.ENRICH_URL || 'http://127.0.0.1:8000'}/latest/gmt`)
  if (backendReq.ok && backendReq.body) {
    res.status(200)
    toReadable(backendReq.body).pipe(res)
  }
  else {
    res.status(backendReq.status).end()
  }
}
