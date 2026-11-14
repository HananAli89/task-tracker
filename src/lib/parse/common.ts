// Helpers shared by all importers: course codes, task types, dates, titles, duplicates.
import type { Course, Draft, Status, Task, TaskType } from '../../types'
import { isValidISODate, toISODate } from '../dates'

// ---------- Courses ----------

// "26F_CST8914_010 Accessible by Design" → { code: CST8914, name: "Accessible by Design" }
const BRIGHTSPACE_COURSE = /\b\d{2}[A-Z]_([A-Z]{3,4}\d{4})_\d{2,3}\b[ \t]*([^\n]*)/
const PLAIN_CODE = /\b([A-Z]{3,4})[ -]?(\d{4})\b/g
// Words that look like a course code next to a year ("FALL 2026") but aren't.
const NOT_A_CODE = /^(FALL|WINT|SPRI|SUMM|TERM|YEAR|WEEK|PAGE|JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|SEPT|OCT|NOV|DEC|DUE|THE|AND|FOR)$/

export function extractCourse(text: string): { code: string; name: string } | null {
  const bs = text.match(BRIGHTSPACE_COURSE)
  if (bs) return { code: bs[1], name: bs[2].trim() }
  for (const plain of text.matchAll(PLAIN_CODE)) {
    if (NOT_A_CODE.test(plain[1])) continue
    const code = plain[1] + plain[2]
    const after = text.slice((plain.index ?? 0) + plain[0].length).replace(/^[\s\-–—:]+/, '').trim()
    return { code, name: after }
  }
  return null
}

// ---------- Task types ----------

const TYPE_RULES: [RegExp, TaskType][] = [
  [/\bquiz/i, 'Quiz'],
  [/\blab\b/i, 'Lab'],
  [/\bproject/i, 'Project'],
  [/\b(midterm|final exam|exam|test|oral)\b/i, 'Exam'],
  [/\bdiscussion/i, 'Discussion'],
  [/\bpresentation/i, 'Presentation'],
  [/\b(assignment|report|paper|essay)/i, 'Assignment'],
  [/\b(read|reading|chapter)\b/i, 'Reading'],
]

export function guessType(title: string): TaskType {
  for (const [re, type] of TYPE_RULES) if (re.test(title)) return type
  return 'Other'
}

// ---------- Titles ----------

export function cleanTitle(raw: string): string {
  return raw
    .replace(/\s+-\s+(Due|Availability Ends|Availability Starts|Due Date|End Date|Start Date|Ends|Starts)\s*$/i, '')
    .replace(/^[\s•▪·\-–—*]+/, '')
    .replace(/[\s:;,–—-]+$/, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

// ---------- Dates & times ----------

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
}
export const MONTH_DAY =
  /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sept?(?:ember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b(?:,?\s+(\d{4}))?/i
const TIME = /\b(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m\.?\b/i

// Year guessed from a reference date when the text has none ("Oct 18").
function inferYear(month: number, ref: Date): number {
  let year = ref.getFullYear()
  if (month - ref.getMonth() > 6) year -= 1
  if (ref.getMonth() - month > 6) year += 1
  return year
}

export function parseMonthDay(text: string, ref = new Date()): { date: string; index: number; length: number } | null {
  const m = text.match(MONTH_DAY)
  if (!m) return null
  const month = MONTHS[m[1].slice(0, 3).toLowerCase()]
  const day = Number(m[2])
  const year = m[3] ? Number(m[3]) : inferYear(month, ref)
  const d = new Date(year, month, day)
  if (d.getMonth() !== month) return null
  return { date: toISODate(d), index: m.index ?? 0, length: m[0].length }
}

export function parseTime(text: string): string {
  const m = text.match(TIME)
  if (!m) return ''
  let h = Number(m[1]) % 12
  if (m[3].toLowerCase() === 'p') h += 12
  return `${String(h).padStart(2, '0')}:${m[2] ?? '00'}`
}

// Flexible date reader for spreadsheet cells.
export function parseLooseDate(value: unknown, dayFirst: boolean): { date: string; time: string } | null {
  if (value instanceof Date && !isNaN(value.getTime())) {
    // Spreadsheet dates arrive as UTC midnight; read the UTC parts so the day doesn't shift.
    const d = new Date(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate())
    const hh = value.getUTCHours(), mm = value.getUTCMinutes()
    return { date: toISODate(d), time: hh || mm ? `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}` : '' }
  }
  if (typeof value === 'number' && value > 20000 && value < 80000) {
    // Excel serial number (days since 1899-12-30)
    const d = new Date(Date.UTC(1899, 11, 30) + value * 86_400_000)
    return parseLooseDate(d, dayFirst)
  }
  if (typeof value !== 'string') return null
  const s = value.trim()
  if (!s) return null
  const time = parseTime(s)

  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/)
  if (m) {
    const iso = `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
    return isValidISODate(iso) ? { date: iso, time } : null
  }
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/)
  if (m) {
    let a = Number(m[1]), b = Number(m[2])
    const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])
    // a > 12 means it must be the day; otherwise follow the user's date-format setting
    if (a > 12 || (dayFirst && b <= 12)) [a, b] = [b, a]
    const iso = `${y}-${String(a).padStart(2, '0')}-${String(b).padStart(2, '0')}`
    return isValidISODate(iso) ? { date: iso, time } : null
  }
  const md = parseMonthDay(s)
  return md ? { date: md.date, time } : null
}

export function parseStatus(value: unknown): Status {
  const s = String(value ?? '').toLowerCase()
  if (/(complete|done|submitted|graded|finished)/.test(s)) return 'completed'
  if (/postpone/.test(s)) return 'postponed'
  return 'none'
}

// ---------- Drafts & duplicates ----------

let counter = 0
export function makeDraft(p: Partial<Draft> & { title: string }): Draft {
  return {
    key: `d${++counter}`,
    include: true,
    courseCode: '',
    courseName: '',
    type: guessType(p.title),
    dueDate: '',
    dueTime: '',
    estimated: false,
    status: 'none',
    notes: '',
    sourceText: '',
    ...p,
  }
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

// Marks drafts that match an existing task or an earlier draft, and unticks them.
export function markDuplicates(drafts: Draft[], tasks: Task[], courses: Course[]): Draft[] {
  const codeOf = new Map(courses.map((c) => [c.id, c.code]))
  const seenSource = new Set<string>()
  const seenCourseTitle = new Set<string>()
  const seenTitleDate = new Set<string>()
  for (const t of tasks) {
    if (t.sourceId) seenSource.add(t.sourceId)
    seenCourseTitle.add(`${codeOf.get(t.courseId ?? '') ?? ''}|${norm(t.title)}`)
    seenTitleDate.add(`${norm(t.title)}|${t.dueDate}`)
  }
  return drafts.map((d) => {
    const ct = `${d.courseCode.toUpperCase()}|${norm(d.title)}`
    const td = `${norm(d.title)}|${d.dueDate}`
    const dup = (d.sourceId && seenSource.has(d.sourceId)) || seenCourseTitle.has(ct) || seenTitleDate.has(td)
    if (d.sourceId) seenSource.add(d.sourceId)
    seenCourseTitle.add(ct)
    seenTitleDate.add(td)
    return dup ? { ...d, include: false, warning: 'Possible duplicate' } : d
  })
}
