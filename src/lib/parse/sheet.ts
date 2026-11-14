// Spreadsheet (.xlsx / .csv) import: read the file, find the header row, map columns, make drafts.
import type { Draft } from '../../types'
import { TASK_TYPES } from '../../types'
import { cleanTitle, extractCourse, guessType, makeDraft, parseLooseDate, parseStatus, parseTime } from './common'

export type Cell = unknown
export interface SheetData { name: string; rows: Cell[][] }

export async function readSpreadsheet(file: File): Promise<SheetData[]> {
  if (/\.csv$/i.test(file.name) || file.type === 'text/csv') {
    const Papa = (await import('papaparse')).default
    const result = Papa.parse<string[]>(await file.text(), { skipEmptyLines: false })
    return [{ name: file.name, rows: result.data }]
  }
  const readXlsxFile = (await import('read-excel-file/browser')).default
  const sheets = await readXlsxFile(file)
  return sheets.map((s) => ({ name: s.sheet, rows: s.data as Cell[][] }))
}

// ---------- Column mapping ----------

export const FIELDS = ['title', 'course', 'courseName', 'type', 'dueDate', 'dueTime', 'status', 'notes'] as const
export type Field = (typeof FIELDS)[number]
export type Mapping = Record<Field, number>   // column index, or -1 for "not mapped"

export const FIELD_LABELS: Record<Field, string> = {
  title: 'Task title *', course: 'Course code', courseName: 'Course name', type: 'Task type',
  dueDate: 'Due date *', dueTime: 'Due time', status: 'Status', notes: 'Notes / description',
}

// Header names we recognise, most specific first.
const ALIASES: Record<Field, string[]> = {
  title: ['task title', 'title', 'task', 'assignment', 'assessment', 'name', 'item'],
  course: ['course code', 'course', 'code', 'class'],
  courseName: ['course name', 'course title'],
  type: ['task type', 'type', 'category'],
  dueDate: ['due date', 'due', 'deadline', 'date due', 'end date', 'date'],
  dueTime: ['due time', 'time'],
  status: ['status', 'state'],
  notes: ['notes', 'note', 'description', 'details', 'comments'],
}

const headerText = (c: Cell) => String(c ?? '').trim().toLowerCase()

// The header is the row (in the first 30) that matches the most known column names.
export function findHeaderRow(rows: Cell[][]): number {
  let best = 0, bestScore = 0
  rows.slice(0, 30).forEach((row, i) => {
    const score = row.filter((c) => Object.values(ALIASES).some((a) => a.includes(headerText(c)))).length
    if (score > bestScore) { best = i; bestScore = score }
  })
  return best
}

export function suggestMapping(header: Cell[]): Mapping {
  const used = new Set<number>()
  const mapping = Object.fromEntries(FIELDS.map((f) => [f, -1])) as Mapping
  for (const field of FIELDS) {
    for (const alias of ALIASES[field]) {
      const idx = header.findIndex((c, i) => !used.has(i) && headerText(c) === alias)
      if (idx >= 0) { mapping[field] = idx; used.add(idx); break }
    }
  }
  return mapping
}

export function rowsToDrafts(rows: Cell[][], headerIndex: number, mapping: Mapping, dayFirst: boolean): Draft[] {
  const get = (row: Cell[], f: Field) => (mapping[f] >= 0 ? row[mapping[f]] : undefined)
  const str = (v: Cell) => (v instanceof Date ? '' : String(v ?? '').trim())

  return rows.slice(headerIndex + 1).flatMap((row, i) => {
    const title = cleanTitle(str(get(row, 'title')))
    if (!title) return []   // skip blank rows

    const courseCell = str(get(row, 'course'))
    const parsedCourse = courseCell ? extractCourse(courseCell) : null
    const date = parseLooseDate(get(row, 'dueDate'), dayFirst)
    const time = parseTime(str(get(row, 'dueTime'))) || date?.time || ''
    const typeCell = str(get(row, 'type'))
    const type = TASK_TYPES.find((t) => t.toLowerCase() === typeCell.toLowerCase()) ?? guessType(typeCell || title)

    return [makeDraft({
      title,
      courseCode: parsedCourse?.code ?? courseCell.toUpperCase(),
      courseName: str(get(row, 'courseName')) || parsedCourse?.name || '',
      type,
      dueDate: date?.date ?? '',
      dueTime: time,
      status: parseStatus(get(row, 'status')),
      notes: str(get(row, 'notes')),
      sourceText: `Row ${headerIndex + i + 2}`,
    })]
  })
}
