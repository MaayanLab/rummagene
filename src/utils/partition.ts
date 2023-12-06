/**
 * Equivalent to python's str.partition method
 */
export default function partition(str: string) {
  const parts = str.split(/[-\s]/);
  return parts;
}
