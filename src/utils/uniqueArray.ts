export default function uniqueArray<T>(arr: T[]): T[] {
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