export function unique<T>(arr: T[]): T[] {
  const seen = new Set()
  const uniqArr = [] as T[]
  arr.forEach(el => {
    if (!seen.has(el)) {
      seen.add(el)
      uniqArr.push(el)
    }
  })
  return uniqArr
}

export function ensure<T>(item: T | T[] | undefined): T[] {
  if (typeof item === 'object' && Array.isArray(item)) return item
  else if (typeof item === 'undefined') return []
  else return [item]
}

/**
 * Equivalent to python's str.partition method
 */
export function partition(str: string, sep: string) {
  const i = str.indexOf(sep)
  if (i === -1) return [str, undefined, undefined] as const
  return [str.substring(0, i), sep, str.substring(i+sep.length)] as const
}

export function interpolate<T>(L: T[], sep: T) {
  const I: T[] = []
  I.push(L[0])
  for (let i = 1; i < L.length; i++) {
    I.push(sep)
    I.push(L[i])
  }
  return I
}

export function even_chunk(text: string, size = 8) {
  const chunks: string[] = []
  let i = 0
  let r = (text.length % size)/size < 0.5 ? text.length % size : 0
  while (i < text.length) {
    if (r > 0) {
      chunks.push(text.slice(i, i+size+1))
      i += 1
      r -= 1
    } else {
      chunks.push(text.slice(i, i+size))
    }
    i += size
  }
  return chunks
}
