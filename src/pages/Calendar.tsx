import { useState } from 'react'
import { byDue, courseMapOf, isOverdue, useCourses, useTasks } from '../lib/tasks'
import { addDays, friendlyDate, monthLabel, toISODate, todayISO } from '../lib/dates'
import { useSettings } from '../lib/settings'
import { useTaskEditor } from '../components/TaskEditor'
import { TaskRow } from '../components/TaskRow'
import { Icon } from '../components/Icon'

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function CalendarPage() {
  const tasks = useTasks()
  const courseMap = courseMapOf(useCourses())
  const { weekStart } = useSettings()
  const { openTask, newTask } = useTaskEditor()
  const today = todayISO()
  const [cursor, setCursor] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() } })
  const [selected, setSelected] = useState(today)

  // First cell = the start of the week that contains the 1st of the month.
  const first = new Date(cursor.y, cursor.m, 1)
  const gridStart = addDays(toISODate(first), -((first.getDay() - weekStart + 7) % 7))
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i))
  const weeks = days[35].slice(0, 7) === `${cursor.y}-${String(cursor.m + 1).padStart(2, '0')}` ? 6 : 5
  const shown = days.slice(0, weeks * 7)

  const byDay = new Map<string, typeof tasks>()
  for (const t of [...tasks].sort(byDue)) {
    const list = byDay.get(t.dueDate) ?? []
    list.push(t)
    byDay.set(t.dueDate, list)
  }

  const move = (delta: number) => setCursor(({ y, m }) => {
    const d = new Date(y, m + delta, 1)
    return { y: d.getFullYear(), m: d.getMonth() }
  })
  const goToday = () => { const d = new Date(); setCursor({ y: d.getFullYear(), m: d.getMonth() }); setSelected(today) }
  const selectedTasks = byDay.get(selected) ?? []

  return (
    <div className="page">
      <header className="page-head">
        <h1>{monthLabel(cursor.y, cursor.m)}</h1>
        <div className="cal-nav">
          <button className="icon-btn" onClick={() => move(-1)} aria-label="Previous month"><Icon name="left" /></button>
          <button className="btn btn-sm" onClick={goToday}>Today</button>
          <button className="icon-btn" onClick={() => move(1)} aria-label="Next month"><Icon name="right" /></button>
        </div>
      </header>

      <div className="card cal">
        <div className="cal-head">
          {Array.from({ length: 7 }, (_, i) => <div key={i}>{DAY_NAMES[(i + weekStart) % 7]}</div>)}
        </div>
        <div className="cal-grid">
          {shown.map((iso) => {
            const list = byDay.get(iso) ?? []
            const inMonth = Number(iso.slice(5, 7)) === cursor.m + 1
            return (
              <div key={iso} className={`cal-day ${inMonth ? '' : 'out'} ${iso === today ? 'today' : ''} ${iso === selected ? 'selected' : ''}`}
                onClick={() => setSelected(iso)}>
                <span className="cal-num">{Number(iso.slice(8))}</span>
                <div className="cal-chips">
                  {list.slice(0, 3).map((t) => {
                    const c = courseMap.get(t.courseId ?? '')
                    const tone = t.status === 'completed' ? 'done' : isOverdue(t) ? 'overdue' : t.status === 'postponed' ? 'postponed' : ''
                    return (
                      <button key={t.id} className={`cal-chip chip-${c?.color ?? 'gray'} ${tone}`} title={`${c?.code ?? ''} ${t.title}`}
                        onClick={(e) => { e.stopPropagation(); openTask(t) }}>
                        {tone === 'overdue' && <span className="dot-red" />}{c ? `${c.code} ` : ''}{t.title}
                      </button>
                    )
                  })}
                  {list.length > 3 && <span className="cal-more">+{list.length - 3} more</span>}
                </div>
                {/* On phones the chips are hidden and dots shown instead */}
                {list.length > 0 && (
                  <div className="cal-dots">
                    {list.slice(0, 4).map((t) => <span key={t.id} className={`cal-dot chip-${courseMap.get(t.courseId ?? '')?.color ?? 'gray'} ${isOverdue(t) ? 'overdue' : ''}`} />)}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <section className="card">
        <div className="card-title-row">
          <h2 className="card-title">{friendlyDate(selected)}</h2>
          <button className="btn btn-sm" onClick={() => newTask({ dueDate: selected })}><Icon name="plus" size={14} /> Add</button>
        </div>
        {selectedTasks.length === 0
          ? <p className="muted small">Nothing due this day.</p>
          : <div className="task-list">{selectedTasks.map((t) => <TaskRow key={t.id} task={t} course={courseMap.get(t.courseId ?? '')} />)}</div>}
      </section>
    </div>
  )
}
