import { useLiveQuery } from 'dexie-react-hooks'
import { db, newId, nowStamp } from '../db'
import type { Course, Task } from '../types'
import { addDays, fromISODate, todayISO } from './dates'
import { nextColor } from './colors'

// ---------- Reading data (re-renders automatically when the DB changes) ----------

export function useTasks(): Task[] {
  return useLiveQuery(() => db.tasks.toArray(), [], [])
}

export function useCourses(): Course[] {
  return useLiveQuery(() => db.courses.orderBy('code').toArray(), [], [])
}

export function courseMapOf(courses: Course[]): Map<string, Course> {
  return new Map(courses.map((c) => [c.id, c]))
}

// ---------- Status logic ----------

// Overdue = past the due date/time AND not completed or postponed.
export function isOverdue(t: Task, now = new Date()): boolean {
  if (t.status !== 'none') return false
  const due = fromISODate(t.dueDate)
  const [h, m] = (t.dueTime || '23:59').split(':').map(Number)
  due.setHours(h, m, 59)
  return due.getTime() < now.getTime()
}

export const isActive = (t: Task) => t.status !== 'completed'

export type Group = 'overdue' | 'today' | 'week' | 'later' | 'postponed'
export const GROUP_LABELS: Record<Group, string> = {
  overdue: 'Overdue', today: 'Today', week: 'This week', later: 'Later', postponed: 'Postponed',
}

export function groupOf(t: Task, today = todayISO()): Group {
  if (t.status === 'postponed') return 'postponed'
  if (isOverdue(t)) return 'overdue'
  if (t.dueDate <= today) return 'today'
  if (t.dueDate <= addDays(today, 7)) return 'week'
  return 'later'
}

export function byDue(a: Task, b: Task): number {
  return (a.dueDate + (a.dueTime || '23:59')).localeCompare(b.dueDate + (b.dueTime || '23:59'))
}

// ---------- Writing data ----------

export type TaskInput = Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'completedAt'> & { completedAt?: string | null }

export async function addTask(input: TaskInput): Promise<string> {
  const id = newId()
  const stamp = nowStamp()
  await db.tasks.add({ completedAt: null, ...input, id, createdAt: stamp, updatedAt: stamp })
  return id
}

export async function updateTask(id: string, patch: Partial<Task>) {
  await db.tasks.update(id, { ...patch, updatedAt: nowStamp() })
}

export const completeTask = (id: string) => updateTask(id, { status: 'completed', completedAt: nowStamp() })
export const reopenTask = (id: string) => updateTask(id, { status: 'none', completedAt: null })
export const postponeTask = (id: string, newDate: string) =>
  updateTask(id, { status: 'postponed', dueDate: newDate, dateEstimated: false })
export const unpostponeTask = (id: string) => updateTask(id, { status: 'none' })
export const deleteTask = (id: string) => db.tasks.delete(id)

export async function duplicateTask(t: Task): Promise<string> {
  const { id: _id, createdAt: _c, updatedAt: _u, completedAt: _d, sourceId: _s, ...rest } = t
  return addTask({ ...rest, title: `${t.title} (copy)`, status: 'none', source: 'manual' })
}

export async function addCourse(input: { code: string; name: string; instructor?: string; term?: string; color?: string }): Promise<string> {
  const used = (await db.courses.toArray()).map((c) => c.color)
  const id = newId()
  const stamp = nowStamp()
  await db.courses.add({
    id,
    code: input.code.trim().toUpperCase(),
    name: input.name.trim(),
    instructor: input.instructor?.trim() || undefined,
    term: input.term?.trim() || undefined,
    color: input.color || nextColor(used),
    createdAt: stamp,
    updatedAt: stamp,
  })
  return id
}

export async function updateCourse(id: string, patch: Partial<Course>) {
  await db.courses.update(id, { ...patch, updatedAt: nowStamp() })
}

// When a course is deleted, its tasks are either deleted too or kept as "No course".
export async function deleteCourse(id: string, deleteItsTasks: boolean) {
  await db.transaction('rw', db.courses, db.tasks, async () => {
    if (deleteItsTasks) await db.tasks.where('courseId').equals(id).delete()
    else await db.tasks.where('courseId').equals(id).modify({ courseId: null, updatedAt: nowStamp() })
    await db.courses.delete(id)
  })
}
