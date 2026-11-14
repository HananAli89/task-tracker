// Pulls positioned text out of a PDF in the browser using pdf.js.
// pdf.js is loaded only when needed, so it doesn't slow down the rest of the app.
import type { Page } from './pdfParse'

export async function readPdf(file: File): Promise<Page[]> {
  const pdfjs = await import('pdfjs-dist')
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default

  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) })
  const doc = await task.promise
  const pages: Page[] = []
  for (let n = 1; n <= doc.numPages; n++) {
    const content = await (await doc.getPage(n)).getTextContent()
    const items: Page = []
    for (const it of content.items) {
      if ('str' in it && it.str.trim()) items.push({ x: it.transform[4], y: it.transform[5], s: it.str })
    }
    pages.push(items)
  }
  await task.destroy()   // frees the worker
  return pages
}
