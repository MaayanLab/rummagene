/**
 * Equivalent to python's str.partition method
 */
export default function partition(str: string, sep: string) {
  const i = str.indexOf(sep)
  if (i === -1) return [str, undefined, undefined] as const
  return [str.substring(0, i), sep, str.substring(i+sep.length)] as const
}
