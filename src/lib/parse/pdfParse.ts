// Turns text pulled out of a PDF into import drafts. No PDF library here, so it's easy to test.
//
// Two layouts are supported:
//  A. Calendar / to-do lists (e.g. Brightspace calendar printed to PDF):
//       "Lab 9: Understanding WAI-ARIA - Due      Nov 15, 2026 8:00 AM"
//       "26F_CST8914_010 Accessible by Design"
//  B. Course outlines with a weekly schedule table, where deadlines are given as
//     week numbers: "Week 9 ... • Lab 5 Assignment (4%)", "due Sunday of week 9".
import type { Draft } from '../../types'
import { addDays, fromISODate } from '../dates'
import { cleanTitle, extractCourse, makeDraft, MONTH_DAY, parseMonthDay, parseTime } from './common'

export interface TextItem { x: number; y: number; s: string }   // y grows upward (PDF coordinates)
export type Page = TextItem[]

// ---------- Grouping text pieces into lines ----------

export function pageToLines(items: Page): string[] {
  const rows: { y: number; items: TextItem[] }[] = []
  for (const it of items) {
    if (!it.s.trim()) continue
    let row = rows.find((r) => Math.abs(r.y - it.y) < 3)
    if (!row) { row = { y: it.y, items: [] }; rows.push(row) }
    row.items.push(it)
  }
  rows.sort((a, b) => b.y - a.y)
  return rows.map((r) => r.items.sort((a, b) => a.x - b.x).map((i) => i.s.trim()).join('  '))
}

// ---------- Layout detection ----------

const DATETIME = new RegExp(`${MONTH_DAY.source}\\s*,?\\s*(?:@\\s*)?\\d{1,2}(?::\\d{2})?\\s*[AaPp]\\.?[Mm]`, 'i')

export type PdfKind = 'calendar' | 'outline'

export function detectKind(pages: Page[]): PdfKind {
  const lines = pages.flatMap(pageToLines)
  const dated = lines.filter((l) => DATETIME.test(l) && MONTH_DAY.exec(l)?.[3]).length
  return dated >= 2 ? 'calendar' : 'outline'
}

// ---------- A. Calendar / to-do lists ----------

// Page headers/footers added by the browser when printing.
const NOISE = /(^\d{1,2}\/\d{1,2}\/\d{2,4},\s*\d)|(\bPrint\s+-\s)|(https?:\/\/)|(^\d+\s*\/\s*\d+$)|(^Events between)/i

export function parseCalendarList(pages: Page[]): Draft[] {
  const lines = pages.flatMap(pageToLines).map((l) => l.trim()).filter((l) => l && !NOISE.test(l))
  const drafts: Draft[] = []
  const used = new Set<number>()

  lines.forEach((line, i) => {
    const m = line.match(DATETIME)
    if (!m || m.index === undefined) return
    const md = parseMonthDay(m[0])
    if (!md) return

    // Title: text before the date on the same line, otherwise the previous line.
    let title = line.slice(0, m.index).trim()
    if (!title && i > 0 && !used.has(i - 1) && !DATETIME.test(lines[i - 1])) {
      title = lines[i - 1]
      used.add(i - 1)
    }
    // Course: the next line or two (stop at the next dated line).
    let course = extractCourse(line.slice(m.index + m[0].length))
    for (let j = i + 1; !course && j < Math.min(i + 4, lines.length) && !DATETIME.test(lines[j]); j++) {
      course = extractCourse(lines[j])
      if (course) used.add(j)
    }
    if (!title) return
    const starts = /availability starts|start date/i.test(title)
    drafts.push(makeDraft({
      title: cleanTitle(title),
      courseCode: course?.code ?? '',
      courseName: course?.name ?? '',
      dueDate: md.date,
      dueTime: parseTime(m[0]),
      estimated: false,
      sourceText: `${title} — ${m[0]}`,
      include: !starts,
      warning: starts ? 'Start of availability, not a deadline' : undefined,
    }))
  })
  return drafts
}

// ---------- B. Course outlines (week-based) ----------

export interface OutlineOptions {
  week1Start: string        // YYYY-MM-DD of Week 1
  defaultDueDay: number     // 0-6
  defaultDueTime: string    // HH:MM
  courseCode: string
  courseName: string
}

const WEEK_MARKER = /^week\s*(\d{1,2})$/i
const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
const ASSESSMENT = /\b(lab|quiz|assignment|project|midterm|final|test|exam|presentation|report|discussion|activity|paper)\b/i

export function weekDate(week1Start: string, week: number, dayOfWeek: number): string {
  const weekStart = addDays(week1Start, (week - 1) * 7)
  const startDow = fromISODate(weekStart).getDay()
  return addDays(weekStart, (dayOfWeek - startDow + 7) % 7)
}

interface WeekBlock { week: number; items: TextItem[]; dateText: string }

// Splits the pages into blocks that start at each "Week N" cell.
function weekBlocks(pages: Page[]): { blocks: WeekBlock[]; assessX: [number, number] | null } {
  const blocks: WeekBlock[] = []
  let assessX: [number, number] | null = null
  let current: WeekBlock | null = null

  for (const page of pages) {
    const sorted = [...page].filter((i) => i.s.trim()).sort((a, b) => b.y - a.y || a.x - b.x)
    // Find the "Assessments" column from the table header, if there is one.
    // Only trust the header of the weekly table (its row also has a "Date" column),
    // not the grade-breakdown table, which also has an "Assessment" column.
    const header = sorted.find((i) => /^assessments?\b/i.test(i.s.trim()) &&
      sorted.some((o) => Math.abs(o.y - i.y) < 3 && /^(date|week)$/i.test(o.s.trim())))
    if (header) {
      const right = sorted
        .filter((i) => Math.abs(i.y - header.y) < 3 && i.x > header.x + 5)
        .sort((a, b) => a.x - b.x)[0]
      assessX = [header.x - 25, right ? right.x - 2 : Infinity]
    }
    // "Week N" cells in the first column start a new block.
    const markers = sorted
      .filter((i) => i.x < 130 && WEEK_MARKER.test(i.s.trim()))
      .map((i) => ({ y: i.y, block: { week: Number(i.s.trim().match(WEEK_MARKER)![1]), items: [], dateText: '' } as WeekBlock }))
    const carry = current   // rows at the top of a page continue the previous page's week
    for (const m of markers) blocks.push(m.block)
    if (markers.length) current = markers[markers.length - 1].block

    for (const it of sorted) {
      if (markers.some((m) => m.block.week === Number(it.s.trim().match(WEEK_MARKER)?.[1]) && m.y === it.y)) continue
      // The block is the nearest marker level with or above this item (4pt tolerance).
      // Markers are sorted top-to-bottom, so search from the bottom up.
      const owner = [...markers].reverse().find((m) => m.y >= it.y - 4)?.block ?? carry
      if (!owner) continue
      // A date right under "Week N" in the first column (e.g. "Sep 07") tells us the week's start.
      if (!owner.dateText && it.x < 90 && MONTH_DAY.test(it.s)) owner.dateText = it.s
      owner.items.push(it)
    }
  }
  return { blocks, assessX }
}

// Suggest a Week 1 start date from dates printed in the outline's first column.
export function suggestWeek1(pages: Page[], ref = new Date()): string {
  for (const b of weekBlocks(pages).blocks) {
    const md = b.dateText ? parseMonthDay(b.dateText, ref) : null
    if (md) return addDays(md.date, -(b.week - 1) * 7)
  }
  return ''
}

const joinText = (items: TextItem[]) =>
  items.map((i) => i.s.trim()).join(' ')
    .replace(/(\w)-\s+(\w)/g, '$1$2')     // re-join hyphenated words: "As- signment"
    .replace(/\s{2,}/g, ' ')

export function parseOutline(pages: Page[], opts: OutlineOptions): Draft[] {
  const { blocks, assessX } = weekBlocks(pages)
  const drafts: Draft[] = []

  for (const block of blocks) {
    // Use only the Assessments column when we found it; otherwise the whole row.
    const cells = (assessX ? block.items.filter((i) => i.x >= assessX[0] && i.x < assessX[1]) : block.items)
      .filter((i) => !/^(assessments?|\(%\)|due date|\(%\) due date)$/i.test(i.s.trim()))   // repeated table headers
    const text = joinText(cells)
    if (/^\s*break\b/i.test(text) && !ASSESSMENT.test(text)) continue

    // Each bullet point is a candidate. Only keep ones that look like graded work: "(4%)".
    for (const piece of text.split(/•|▪|•|(?=\b(?:Graded|Group)\s)/)) {
      const pct = piece.match(/\(\s*(\d+(?:\.\d+)?)\s*%\s*\)/)
      if (!pct || !ASSESSMENT.test(piece)) continue
      const rawTitle = piece.slice(0, pct.index)
      const title = cleanTitle(rawTitle.replace(/\bdue\b.*$/i, ''))
      if (!title) continue
      const rest = piece.slice((pct.index ?? 0) + pct[0].length)

      // Explicit deadline text wins: "due Sunday of week 9", "due Friday week 6", "Oct 18".
      let dueDate = ''
      let estimated = true
      let dueTime = parseTime(rest) || opts.defaultDueTime
      const dueWeekday = rest.match(/\b(sun|mon|tue|wed|thu|fri|sat)[a-z]*\.?\s+(?:of\s+)?week\s*(\d{1,2})/i)
      const dueWeek = rest.match(/\bweek\s*(\d{1,2})/i)
      const explicit = parseMonthDay(rest, fromISODate(opts.week1Start || '2000-01-01'))
      if (explicit) {
        dueDate = explicit.date
        estimated = false
      } else if (dueWeekday && opts.week1Start) {
        dueDate = weekDate(opts.week1Start, Number(dueWeekday[2]), DAYS.indexOf(dueWeekday[1].slice(0, 3).toLowerCase()))
        estimated = false
      } else if (opts.week1Start) {
        const week = dueWeek ? Number(dueWeek[1]) : block.week
        dueDate = weekDate(opts.week1Start, week, opts.defaultDueDay)
        dueTime = opts.defaultDueTime
      }

      drafts.push(makeDraft({
        title,
        courseCode: opts.courseCode,
        courseName: opts.courseName,
        dueDate,
        dueTime,
        estimated,
        sourceText: `Week ${block.week}: ${piece.trim().slice(0, 140)}`,
        notes: `Worth ${pct[1]}%`,
      }))
    }
  }

  // The same item can appear in more than one table — keep the first.
  const seen = new Set<string>()
  return drafts.filter((d) => {
    const k = d.title.toLowerCase().replace(/[^a-z0-9]/g, '')
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

export function totalTextLength(pages: Page[]): number {
  return pages.reduce((n, p) => n + p.reduce((m, i) => m + i.s.trim().length, 0), 0)
}
