export default function ensureArray<T>(item: T | T[] | undefined): T[] {
  if (typeof item === 'object' && Array.isArray(item)) return item
  else if (typeof item === 'undefined') return []
  else return [item]
}