// Shared data types for the whole app.

export const TASK_TYPES = [
  'Assignment', 'Lab', 'Quiz', 'Exam', 'Project', 'Discussion',
  'Presentation', 'Reading', 'Personal', 'Other',
] as const
export type TaskType = (typeof TASK_TYPES)[number]

export const PRIORITIES = ['High', 'Medium', 'Low'] as const
export type Priority = (typeof PRIORITIES)[number]

// Stored status. "Overdue" is NOT stored — it is calculated (see lib/tasks.ts).
export type Status = 'none' | 'postponed' | 'completed'

export type TaskSource = 'manual' | 'pdf' | 'ics' | 'spreadsheet'

export interface Course {
  id: string
  code: string          // e.g. CST8912
  name: string          // e.g. Cloud Solutions Architecture
  instructor?: string
  term?: string
  color: string         // key from lib/colors.ts
  createdAt: string
  updatedAt: string
}

export interface Task {
  id: string
  title: string
  courseId: string | null   // null = "No course"
  type: TaskType
  dueDate: string           // YYYY-MM-DD (stored as text to avoid time-zone bugs)
  dueTime?: string          // HH:MM, 24h. Empty = end of day
  startDate?: string        // YYYY-MM-DD
  priority: Priority
  status: Status
  notes: string
  link?: string
  dateEstimated: boolean    // true when the date was calculated, not stated
  source: TaskSource
  sourceId?: string         // e.g. calendar event UID, used to skip duplicates
  createdAt: string
  updatedAt: string
  completedAt: string | null
}

// A task that came out of an import and is waiting in the review screen.
export interface Draft {
  key: string
  include: boolean
  title: string
  courseCode: string
  courseName: string
  type: TaskType
  dueDate: string
  dueTime: string
  estimated: boolean
  status: Status
  notes: string
  sourceText: string
  sourceId?: string
  warning?: string      // e.g. "Possible duplicate"
}
