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
