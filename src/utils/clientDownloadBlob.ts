export default function clientDownloadBlob(blob: Blob, filename: string) {
  const a = document.createElement('a')
  a.style.display = 'none'
  document.body.appendChild(a)
  const url = window.URL.createObjectURL(blob)
  a.href = url
  a.download = filename
  a.click()
  window.URL.revokeObjectURL(url)
}