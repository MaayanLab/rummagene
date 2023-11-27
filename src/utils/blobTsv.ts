export default function blobTsv<I, K extends string, O extends Record<K, string | number | null | undefined>>(columns: K[], items: I[], itemTransform: (item: I) => O | null | undefined) {
  let content = columns.join('\t') + '\n'
  items.forEach(item => {
    const itemTransformed = itemTransform(item)
    if (!itemTransformed) return
    content += columns.map(col => `${itemTransformed[col] ?? ''}`).join('\t') + '\n'
  })
  return new Blob([content], {type: 'text/tab-separated-values'})
}