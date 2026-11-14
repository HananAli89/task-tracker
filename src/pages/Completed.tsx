import { useState } from 'react'
import { courseMapOf, deleteTask, reopenTask, useCourses, useTasks } from '../lib/tasks'
import { formatDate } from '../lib/dates'
import { useSettings } from '../lib/settings'
import { CourseChip } from '../components/TaskRow'
import { useTaskEditor } from '../components/TaskEditor'
import { EmptyState, useUI } from '../components/ui'
import { Icon } from '../components/Icon'

export function CompletedPage() {
  const tasks = useTasks()
  const courses = useCourses()
  const courseMap = courseMapOf(courses)
  const { dateFormat } = useSettings()
  const { openTask } = useTaskEditor()
  const { confirm, toast } = useUI()
  const [query, setQuery] = useState('')
  const [course, setCourse] = useState('')

  const q = query.trim().toLowerCase()
  const done = tasks
    .filter((t) => t.status === 'completed')
    .filter((t) => !course || t.courseId === course)
    .filter((t) => {
      if (!q) return true
      const c = courseMap.get(t.courseId ?? '')
      return `${t.title} ${t.notes} ${c?.code ?? ''} ${c?.name ?? ''}`.toLowerCase().includes(q)
    })
    .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))

  async function remove(id: string, title: string) {
    if (await confirm({ title: 'Delete permanently?', message: `“${title}” will be removed from your history. This can’t be undone.`, confirmLabel: 'Delete', danger: true })) {
      await deleteTask(id)
      toast('Task deleted')
    }
  }

  return (
    <div className="page">
      <header className="page-head"><h1>Completed</h1><span className="muted">{done.length} task{done.length === 1 ? '' : 's'}</span></header>
      <div className="toolbar">
        <label className="search"><Icon name="search" size={16} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search completed tasks…" aria-label="Search completed" /></label>
        <div className="filters">
          <select value={course} onChange={(e) => setCourse(e.target.value)} aria-label="Course">
            <option value="">All courses</option>
            {courses.map((c) => <option key={c.id} value={c.id}>{c.code} – {c.name}</option>)}
          </select>
        </div>
      </div>

      {done.length === 0 ? (
        <EmptyState title={q || course ? 'No matches' : 'No completed tasks yet'} text={q || course ? 'Try a different search.' : 'Tick a task off and it will show up here.'} />
      ) : (
        <div className="card task-list">
          {done.map((t) => (
            <div key={t.id} className="task-row done">
              <button className="task-main" onClick={() => openTask(t)}>
                <span className="task-title">{t.title}</span>
                <span className="task-meta">
                  <CourseChip course={courseMap.get(t.courseId ?? '')} />
                  <span className="due">Completed {t.completedAt ? formatDate(t.completedAt.slice(0, 10), dateFormat) : ''}</span>
                  <span className="task-type">Due {formatDate(t.dueDate, dateFormat)}</span>
                </span>
              </button>
              <div className="row-actions">
                <button className="btn btn-sm" onClick={async () => { await reopenTask(t.id); toast('Task reopened') }}><Icon name="undo" size={14} /> Reopen</button>
                <button className="icon-btn" onClick={() => remove(t.id, t.title)} aria-label={`Delete ${t.title}`}><Icon name="trash" size={16} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
