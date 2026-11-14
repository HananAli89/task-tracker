import { useState } from 'react'
import { Link } from 'react-router-dom'
import { byDue, courseMapOf, isActive, isOverdue, useCourses, useTasks } from '../lib/tasks'
import { addDays, todayISO } from '../lib/dates'
import { TaskRow } from '../components/TaskRow'
import { useTaskEditor } from '../components/TaskEditor'
import { EmptyState } from '../components/ui'

export function Dashboard() {
  const tasks = useTasks()
  const courses = useCourses()
  const courseMap = courseMapOf(courses)
  const { newTask } = useTaskEditor()
  const today = todayISO()
  const weekEnd = addDays(today, 7)

  const open = tasks.filter((t) => t.status === 'none')
  const overdue = open.filter((t) => isOverdue(t)).sort(byDue)
  const dueToday = open.filter((t) => t.dueDate === today && !isOverdue(t)).sort(byDue)
  const upcoming = open.filter((t) => t.dueDate > today && t.dueDate <= weekEnd).sort(byDue)
  const completed = tasks.filter((t) => t.status === 'completed')

  const [now] = useState(() => new Date())
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 18 ? 'Good afternoon' : 'Good evening'
  const dateLine = now.toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' })

  if (tasks.length === 0 && courses.length === 0) {
    return (
      <div className="page">
        <header className="page-head"><div><h1>{greeting}</h1><p className="muted">{dateLine}</p></div></header>
        <EmptyState title="Nothing here yet" text="Add your first task, or import your deadlines from a calendar file, PDF or spreadsheet.">
          <button className="btn btn-primary" onClick={() => newTask()}>Add a task</button>
          <Link className="btn" to="/import">Import</Link>
        </EmptyState>
      </div>
    )
  }

  const stats = [
    { label: 'Due today', value: dueToday.length, tone: 'blue', to: '/tasks' },
    { label: 'Next 7 days', value: upcoming.length, tone: 'amber', to: '/tasks' },
    { label: 'Overdue', value: overdue.length, tone: 'red', to: '/tasks?group=overdue' },
    { label: 'Completed', value: completed.length, tone: 'green', to: '/completed' },
  ]

  return (
    <div className="page">
      <header className="page-head"><div><h1>{greeting}</h1><p className="muted">{dateLine}</p></div></header>

      <div className="stats">
        {stats.map((s) => (
          <Link key={s.label} to={s.to} className={`stat stat-${s.tone}`}>
            <span className="stat-value">{s.value}</span>
            <span className="stat-label">{s.label}</span>
          </Link>
        ))}
      </div>

      <div className="dash-grid">
        <section className="card">
          <h2 className="card-title">{overdue.length ? 'Today & overdue' : 'Today'}</h2>
          {overdue.length + dueToday.length === 0
            ? <p className="muted small">Nothing due today.</p>
            : <div className="task-list">{[...overdue, ...dueToday].map((t) => <TaskRow key={t.id} task={t} course={courseMap.get(t.courseId ?? '')} />)}</div>}
        </section>

        <section className="card">
          <h2 className="card-title">Next 7 days</h2>
          {upcoming.length === 0
            ? <p className="muted small">Nothing due in the next week.</p>
            : <div className="task-list">{upcoming.map((t) => <TaskRow key={t.id} task={t} course={courseMap.get(t.courseId ?? '')} />)}</div>}
        </section>
      </div>

      {courses.length > 0 && (
        <section className="card">
          <h2 className="card-title">Courses</h2>
          <div className="course-rows">
            {courses.map((c) => {
              const mine = tasks.filter((t) => t.courseId === c.id)
              const done = mine.filter((t) => !isActive(t)).length
              const late = mine.filter((t) => isOverdue(t)).length
              const pct = mine.length ? Math.round((done / mine.length) * 100) : 0
              return (
                <Link key={c.id} to={`/courses/${c.id}`} className="course-row">
                  <span className={`chip chip-${c.color}`}>{c.code}</span>
                  <span className="course-row-name">{c.name}</span>
                  <span className="course-row-counts">
                    {mine.length - done} active{late > 0 && <span className="text-red"> · {late} overdue</span>} · {done} done
                  </span>
                  <span className="progress" aria-label={`${pct}% complete`}><span style={{ width: `${pct}%` }} /></span>
                </Link>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
