import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type { Course } from '../types'
import { byDue, deleteCourse, isOverdue, useCourses, useTasks } from '../lib/tasks'
import { CourseEditor } from '../components/CourseEditor'
import { TaskRow } from '../components/TaskRow'
import { useTaskEditor } from '../components/TaskEditor'
import { EmptyState, useUI } from '../components/ui'
import { Icon } from '../components/Icon'

export function CoursesPage() {
  const courses = useCourses()
  const tasks = useTasks()
  const [editing, setEditing] = useState<Course | 'new' | null>(null)

  return (
    <div className="page">
      <header className="page-head">
        <h1>Courses</h1>
        <button className="btn btn-primary" onClick={() => setEditing('new')}><Icon name="plus" size={16} /> New course</button>
      </header>

      {courses.length === 0 ? (
        <EmptyState title="No courses yet" text="Add a course, or import tasks and courses will be created for you.">
          <button className="btn btn-primary" onClick={() => setEditing('new')}>Add a course</button>
          <Link className="btn" to="/import">Import</Link>
        </EmptyState>
      ) : (
        <div className="course-grid">
          {courses.map((c) => {
            const mine = tasks.filter((t) => t.courseId === c.id)
            const done = mine.filter((t) => t.status === 'completed').length
            const late = mine.filter((t) => isOverdue(t)).length
            const pct = mine.length ? Math.round((done / mine.length) * 100) : 0
            return (
              <Link key={c.id} to={`/courses/${c.id}`} className={`card course-card accent-${c.color}`}>
                <span className={`chip chip-${c.color}`}>{c.code}</span>
                <h3>{c.name || c.code}</h3>
                {c.instructor && <p className="muted small">{c.instructor}</p>}
                <p className="small">{mine.length - done} active · {done} done{late > 0 && <span className="text-red"> · {late} overdue</span>}</p>
                <span className="progress"><span style={{ width: `${pct}%` }} /></span>
              </Link>
            )
          })}
        </div>
      )}
      {editing && <CourseEditor course={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

export function CourseDetail() {
  const { id } = useParams()
  const courses = useCourses()
  const tasks = useTasks()
  const navigate = useNavigate()
  const { confirm, toast } = useUI()
  const { newTask } = useTaskEditor()
  const [editing, setEditing] = useState(false)
  const course = courses.find((c) => c.id === id)

  if (!course) return <div className="page"><EmptyState title="Course not found"><Link className="btn" to="/courses">Back to courses</Link></EmptyState></div>

  const mine = tasks.filter((t) => t.courseId === course.id).sort(byDue)
  const overdue = mine.filter((t) => isOverdue(t))
  const upcoming = mine.filter((t) => t.status !== 'completed' && !isOverdue(t))
  const completed = mine.filter((t) => t.status === 'completed').reverse()
  const pct = mine.length ? Math.round((completed.length / mine.length) * 100) : 0

  async function remove() {
    if (!course) return
    const choice = await confirm({
      title: `Delete ${course.code}?`,
      message: mine.length
        ? `This course has ${mine.length} task${mine.length === 1 ? '' : 's'}. What should happen to them?`
        : 'This course has no tasks.',
      choices: mine.length
        ? [{ label: 'Keep tasks (no course)', value: 'keep' }, { label: 'Delete tasks too', value: 'delete', danger: true }]
        : [{ label: 'Delete course', value: 'keep', danger: true }],
    })
    if (!choice) return
    await deleteCourse(course.id, choice === 'delete')
    toast(`${course.code} deleted`)
    navigate('/courses')
  }

  const section = (title: string, list: typeof mine, tone = '') => (
    <section className="group">
      <h2 className={`group-title ${tone}`}>{title} <span className="count">{list.length}</span></h2>
      {list.length === 0 ? <p className="muted small">None.</p> : <div className="card task-list">{list.map((t) => <TaskRow key={t.id} task={t} course={course} showCourse={false} />)}</div>}
    </section>
  )

  return (
    <div className="page">
      <Link to="/courses" className="back"><Icon name="left" size={16} /> Courses</Link>
      <header className="page-head">
        <div>
          <span className={`chip chip-${course.color}`}>{course.code}</span>
          <h1 className="mt-sm">{course.name || course.code}</h1>
          <p className="muted small">{[course.instructor, course.term].filter(Boolean).join(' · ')}</p>
        </div>
        <div className="head-actions">
          <button className="btn" onClick={() => newTask({ courseId: course.id })}><Icon name="plus" size={16} /> Task</button>
          <button className="icon-btn" onClick={() => setEditing(true)} aria-label="Edit course"><Icon name="edit" /></button>
          <button className="icon-btn" onClick={remove} aria-label="Delete course"><Icon name="trash" /></button>
        </div>
      </header>

      <div className="card progress-card">
        <span>{completed.length} of {mine.length} done</span>
        <span className="progress big"><span style={{ width: `${pct}%` }} /></span>
        <span>{pct}%</span>
      </div>

      {overdue.length > 0 && section('Overdue', overdue, 'group-overdue')}
      {section('Upcoming', upcoming)}
      {section('Completed', completed, 'group-done')}

      {editing && <CourseEditor course={course} onClose={() => setEditing(false)} />}
    </div>
  )
}
