import type { Course, Task } from '../types'
import { completeTask, isOverdue, reopenTask } from '../lib/tasks'
import { daysBetween, formatDate, formatTime, friendlyDate, todayISO } from '../lib/dates'
import { useSettings } from '../lib/settings'
import { useTaskEditor } from './TaskEditor'
import { useUI } from './ui'
import { Icon } from './Icon'

export function CourseChip({ course, short }: { course?: Course; short?: boolean }) {
  if (!course) return <span className="chip chip-gray">No course</span>
  return <span className={`chip chip-${course.color}`} title={course.name}>{short ? course.code : `${course.code}`}</span>
}

// "Today 11:59 pm", "Tomorrow", "Thu", "3 days overdue", "Mon, Nov 30"
export function dueText(t: Task, fmt: ReturnType<typeof useSettings>['dateFormat']): string {
  const today = todayISO()
  const diff = daysBetween(today, t.dueDate)
  const time = t.dueTime ? ` ${formatTime(t.dueTime)}` : ''
  if (t.status === 'completed') return `Due ${formatDate(t.dueDate, fmt)}`
  if (isOverdue(t)) return diff === 0 ? `Overdue (was due${time})` : `${-diff} day${diff === -1 ? '' : 's'} overdue`
  if (diff === 0) return `Today${time}`
  if (diff === 1) return `Tomorrow${time}`
  if (diff > 1 && diff < 7) return `${friendlyDate(t.dueDate).split(',')[0]}${time}`
  return `${friendlyDate(t.dueDate)}${time}`
}

export function TaskRow({ task, course, showCourse = true }: { task: Task; course?: Course; showCourse?: boolean }) {
  const settings = useSettings()
  const { openTask } = useTaskEditor()
  const { toast } = useUI()
  const overdue = isOverdue(task)
  const done = task.status === 'completed'
  const tone = done ? 'done' : overdue ? 'overdue' : task.status === 'postponed' ? 'postponed' : ''

  const toggle = async () => {
    if (done) {
      await reopenTask(task.id)
      toast('Task reopened')
    } else {
      await completeTask(task.id)
      toast(`Completed “${task.title}”`, { label: 'Undo', run: () => reopenTask(task.id) })
    }
  }

  return (
    <div className={`task-row ${tone}`}>
      <button className={`check ${done ? 'checked' : ''}`} onClick={toggle}
        aria-label={done ? `Reopen ${task.title}` : `Mark ${task.title} complete`} title={done ? 'Reopen' : 'Mark complete'}>
        {done && <Icon name="check" size={14} />}
      </button>
      <button className="task-main" onClick={() => openTask(task)}>
        <span className="task-title">{task.title}</span>
        <span className="task-meta">
          {showCourse && <CourseChip course={course} />}
          <span className={`due ${tone}`}>{dueText(task, settings.dateFormat)}</span>
          {task.dateEstimated && !done && <span className="est" title="Estimated date — not confirmed in the source">est.</span>}
          {task.status === 'postponed' && <span className="badge badge-postponed">Postponed</span>}
          {task.priority === 'High' && !done && <span className="badge badge-high">High</span>}
          <span className="task-type">{task.type}</span>
        </span>
      </button>
    </div>
  )
}
