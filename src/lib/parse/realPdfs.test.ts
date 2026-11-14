// Runs the PDF parser on real PDFs kept OUTSIDE the repo.
// Usage: PDF_FIXTURES=/path/to/folder npx vitest run realPdfs
import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { detectKind, parseCalendarList, parseOutline, suggestWeek1, totalTextLength, type Page } from './pdfParse'

const dir = process.env.PDF_FIXTURES
const run = dir ? describe : describe.skip

async function load(file: string): Promise<Page[]> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  pdfjs.GlobalWorkerOptions.workerSrc = path.resolve('node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs')
  const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(path.join(dir!, file))) }).promise
  const pages: Page[] = []
  for (let n = 1; n <= doc.numPages; n++) {
    const c = await (await doc.getPage(n)).getTextContent()
    pages.push(c.items.flatMap((it) => ('str' in it && it.str.trim() ? [{ x: it.transform[4], y: it.transform[5], s: it.str }] : [])))
  }
  return pages
}

const opts = (week1Start: string, code: string) => ({ week1Start, defaultDueDay: 6, defaultDueTime: '23:59', courseCode: code, courseName: '' })

run('real PDFs', () => {
  it('calendar list (text PDF)', async () => {
    const pages = await load('cal.pdf')
    expect(detectKind(pages)).toBe('calendar')
    const d = parseCalendarList(pages)
    console.table(d.map((x) => [x.title, x.courseCode, x.courseName, x.dueDate, x.dueTime, x.include]))
    expect(d).toHaveLength(7)
    expect(d[0]).toMatchObject({ title: 'Lab 9: Understanding WAI-ARIA', courseCode: 'CST8914', dueDate: '2026-11-15', dueTime: '08:00' })
    expect(d[3]).toMatchObject({ title: 'Quiz #3', courseCode: 'CST8911', dueTime: '23:59', type: 'Quiz' })
    expect(d[5].include).toBe(false)
  })

  it('image-only PDF has no text', async () => {
    expect(totalTextLength(await load('todo_image.pdf'))).toBeLessThan(20)
  })

  for (const [file, code] of [['26F_CST8915_Weekly-Schedule.pdf', 'CST8915'], ['26F_CST8916_Weekly-Schedule.pdf', 'CST8916']]) {
    it(`outline ${code}`, async () => {
      const pages = await load(file)
      expect(detectKind(pages)).toBe('outline')
      const w1 = suggestWeek1(pages, new Date(2026, 10, 1))
      const d = parseOutline(pages, opts(w1, code))
      console.log(code, 'week1', w1)
      console.table(d.map((x) => [x.title, x.type, x.dueDate, x.estimated, x.sourceText.slice(0, 50)]))
      expect(w1).toBe('2026-09-07')
      expect(d.length).toBeGreaterThan(5)
    })
  }
})
