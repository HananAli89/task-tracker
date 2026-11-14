import Dexie, { type EntityTable } from 'dexie'
import type { Course, Task } from './types'

// IndexedDB database. Every change is written here immediately.
export const db = new Dexie('student-task-tracker') as Dexie & {
  courses: EntityTable<Course, 'id'>
  tasks: EntityTable<Task, 'id'>
}

// Only the fields listed here are indexed (searchable quickly). Other fields are still stored.
db.version(1).stores({
  courses: 'id, code',
  tasks: 'id, courseId, dueDate, status, sourceId',
})

export const newId = () => crypto.randomUUID()
export const nowStamp = () => new Date().toISOString()
