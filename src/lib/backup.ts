// JSON backup / restore and CSV export.
import { db } from '../db'
import type { Course, Task } from '../types'
import { getSettings, updateSettings, type Settings } from './settings'
import { todayISO } from './dates'

const FORMAT = 'student-task-tracker'
const VERSION = 1

export interface Backup {
  format: typeof FORMAT
  version: number
  exportedAt: string
  courses: Course[]
  tasks: Task[]
  settings: Settings
}

export function download(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const a = Object.assign(document.createElement('a'), { href: url, download: filename })
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function exportBackup() {
  const backup: Backup = {
    format: FORMAT,
    version: VERSION,
    exportedAt: new Date().toISOString(),
    courses: await db.courses.toArray(),
    tasks: await db.tasks.toArray(),
    settings: getSettings(),
  }
  download(`task-tracker-backup-${todayISO()}.json`, JSON.stringify(backup, null, 2), 'application/json')
}

// Checks the file before anything is touched. Throws a readable error if it isn't a valid backup.
export function parseBackup(text: string): Backup {
  let data: Partial<Backup>
  try { data = JSON.parse(text) } catch { throw new Error('This file is not valid JSON.') }
  if (data.format !== FORMAT) throw new Error('This file is not a Task Tracker backup.')
  if ((data.version ?? 0) > VERSION) throw new Error('This backup was made by a newer version of the app.')
  if (!Array.isArray(data.courses) || !Array.isArray(data.tasks)) throw new Error('The backup is missing courses or tasks.')
  const bad = data.tasks.find((t) => !t?.id || !t?.title || !t?.dueDate)
  if (bad) throw new Error('The backup contains a damaged task, so nothing was restored.')
  return data as Backup
}

// "merge": add records whose IDs don't exist yet (existing ones are left alone).
// "replace": wipe everything first. Both run in one transaction, so a failure changes nothing.
export async function restoreBackup(b: Backup, mode: 'merge' | 'replace'): Promise<{ courses: number; tasks: number }> {
  let added = { courses: 0, tasks: 0 }
  await db.transaction('rw', db.courses, db.tasks, async () => {
    if (mode === 'replace') {
      await db.courses.clear()
      await db.tasks.clear()
    }
    const haveCourses = new Set(await db.courses.toCollection().primaryKeys())
    const haveTasks = new Set(await db.tasks.toCollection().primaryKeys())
    const newCourses = b.courses.filter((c) => !haveCourses.has(c.id))
    const newTasks = b.tasks.filter((t) => !haveTasks.has(t.id))
    await db.courses.bulkAdd(newCourses)
    await db.tasks.bulkAdd(newTasks)
    added = { courses: newCourses.length, tasks: newTasks.length }
  })
  if (mode === 'replace' && b.settings) updateSettings(b.settings)
  return added
}

export async function exportCSV() {
  const Papa = (await import('papaparse')).default
  const courses = new Map((await db.courses.toArray()).map((c) => [c.id, c]))
  const tasks = (await db.tasks.toArray()).sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  const csv = Papa.unparse(tasks.map((t) => ({
    'Task Title': t.title,
    'Course Code': courses.get(t.courseId ?? '')?.code ?? '',
    'Course Name': courses.get(t.courseId ?? '')?.name ?? '',
    'Type': t.type,
    'Start Date': t.startDate ?? '',
    'Due Date': t.dueDate,
    'Due Time': t.dueTime ?? '',
    'Status': t.status === 'none' ? '' : t.status === 'completed' ? 'Completed' : 'Postponed',
    'Priority': t.priority,
    'Notes': t.notes,
    'Link': t.link ?? '',
    'Completed At': t.completedAt ?? '',
  })))
  download(`tasks-${todayISO()}.csv`, csv, 'text/csv')
}

export async function deleteAllData() {
  await db.transaction('rw', db.courses, db.tasks, async () => {
    await db.courses.clear()
    await db.tasks.clear()
  })
}
