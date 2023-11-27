export default function streamTsv<I, K extends string, O extends Record<K, string | number | null | undefined>>(columns: K[], items: I[], itemTransform: (item: I) => O | null | undefined) {
  return (new ReadableStream({
    async pull(controller) {
      controller.enqueue(columns.join('\t') + '\n')
      items.forEach(item => {
        const itemTransformed = itemTransform(item)
        if (!itemTransformed) return
        controller.enqueue(columns.map(col => `${itemTransformed[col] ?? ''}`).join('\t') + '\n')
      })
      controller.close()
    },
  })).pipeThrough(new TextEncoderStream())
}
