import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PRIORITIES, TASK_TYPES, type Task } from '../types'
import { byDue, courseMapOf, GROUP_LABELS, groupOf, isOverdue, useCourses, useTasks, type Group } from '../lib/tasks'
import { TaskRow } from '../components/TaskRow'
import { EmptyState } from '../components/ui'
import { Icon } from '../components/Icon'

const GROUP_ORDER: Group[] = ['overdue', 'today', 'week', 'later', 'postponed']
const PRIORITY_RANK = { High: 0, Medium: 1, Low: 2 }

export function TasksPage() {
  const tasks = useTasks()
  const courses = useCourses()
  const courseMap = courseMapOf(courses)
  const [params, setParams] = useSearchParams()

  const [query, setQuery] = useState('')
  const course = params.get('course') ?? ''
  const status = params.get('group') === 'overdue' ? 'overdue' : (params.get('status') ?? '')
  const [priority, setPriority] = useState('')
  const [type, setType] = useState('')
  const [sort, setSort] = useState<'due' | 'priority' | 'course' | 'created'>('due')
  const [grouped, setGrouped] = useState(true)

  const setParam = (k: string, v: string) => {
    const next = new URLSearchParams(params)
    next.delete('group')
    if (v) next.set(k, v); else next.delete(k)
    setParams(next, { replace: true })
  }

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = tasks.filter((t) => {
      if (t.status === 'completed') return false
      if (course && (course === 'none' ? t.courseId : t.courseId !== course)) return false
      if (status === 'overdue' && !isOverdue(t)) return false
      if (status === 'postponed' && t.status !== 'postponed') return false
      if (status === 'none' && (t.status !== 'none' || isOverdue(t))) return false
      if (priority && t.priority !== priority) return false
      if (type && t.type !== type) return false
      if (q) {
        const c = courseMap.get(t.courseId ?? '')
        const hay = `${t.title} ${t.notes} ${c?.code ?? ''} ${c?.name ?? ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
    const cmp: Record<typeof sort, (a: Task, b: Task) => number> = {
      due: byDue,
      priority: (a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || byDue(a, b),
      course: (a, b) => (courseMap.get(a.courseId ?? '')?.code ?? 'zzz').localeCompare(courseMap.get(b.courseId ?? '')?.code ?? 'zzz') || byDue(a, b),
      created: (a, b) => b.createdAt.localeCompare(a.createdAt),
    }
    return list.sort(cmp[sort])
  }, [tasks, query, course, status, priority, type, sort, courseMap])

  const filtersOn = Boolean(query || course || status || priority || type)
  const clear = () => { setQuery(''); setPriority(''); setType(''); setParams({}, { replace: true }) }
  const row = (t: Task) => <TaskRow key={t.id} task={t} course={courseMap.get(t.courseId ?? '')} />

  return (
    <div className="page">
      <header className="page-head">
        <h1>Tasks</h1>
        <div className="seg" role="group" aria-label="View">
          <button className={grouped ? 'on' : ''} onClick={() => setGrouped(true)}>Grouped</button>
          <button className={!grouped ? 'on' : ''} onClick={() => setGrouped(false)}>List</button>
        </div>
      </header>

      <div className="toolbar">
        <label className="search">
          <Icon name="search" size={16} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search title, notes, course code…" aria-label="Search tasks" />
        </label>
        <div className="filters">
          <select value={course} onChange={(e) => setParam('course', e.target.value)} aria-label="Course">
            <option value="">All courses</option>
            {courses.map((c) => <option key={c.id} value={c.id}>{c.code} – {c.name}</option>)}
            <option value="none">No course</option>
          </select>
          <select value={status} onChange={(e) => setParam('status', e.target.value)} aria-label="Status">
            <option value="">Any status</option>
            <option value="none">Open (not overdue)</option>
            <option value="overdue">Overdue</option>
            <option value="postponed">Postponed</option>
          </select>
          <select value={priority} onChange={(e) => setPriority(e.target.value)} aria-label="Priority">
            <option value="">Any priority</option>
            {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
          </select>
          <select value={type} onChange={(e) => setType(e.target.value)} aria-label="Type">
            <option value="">Any type</option>
            {TASK_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Sort">
            <option value="due">Sort: due date</option>
            <option value="priority">Sort: priority</option>
            <option value="course">Sort: course</option>
            <option value="created">Sort: newest</option>
          </select>
          {filtersOn && <button className="link-btn" onClick={clear}>Clear</button>}
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState title={filtersOn ? 'No tasks match these filters' : 'No open tasks'} text={filtersOn ? 'Try clearing a filter or searching for something else.' : 'Everything is done — nice.'}>
          {filtersOn && <button className="btn" onClick={clear}>Clear filters</button>}
        </EmptyState>
      ) : grouped ? (
        GROUP_ORDER.map((g) => {
          const items = visible.filter((t) => groupOf(t) === g)
          if (!items.length) return null
          return (
            <section key={g} className="group">
              <h2 className={`group-title group-${g}`}>{GROUP_LABELS[g]} <span className="count">{items.length}</span></h2>
              <div className="card task-list">{items.map(row)}</div>
            </section>
          )
        })
      ) : (
        <div className="card task-list">{visible.map(row)}</div>
      )}
    </div>
  )
}
