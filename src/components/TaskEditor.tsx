// The add/edit task form. Open it from anywhere with useTaskEditor().
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { PRIORITIES, TASK_TYPES, type Priority, type Task, type TaskType } from '../types'
import {
  addCourse, addTask, completeTask, deleteTask, duplicateTask, postponeTask, reopenTask,
  unpostponeTask, updateTask, useCourses,
} from '../lib/tasks'
import { addDays, isValidISODate, todayISO } from '../lib/dates'
import { guessType } from '../lib/parse/common'
import { Modal, useUI } from './ui'
import { Icon } from './Icon'

type Defaults = Partial<Pick<Task, 'courseId' | 'dueDate'>>
const EditorContext = createContext<{ openTask: (t: Task) => void; newTask: (d?: Defaults) => void } | null>(null)

export function useTaskEditor() {
  const ctx = useContext(EditorContext)
  if (!ctx) throw new Error('useTaskEditor must be inside TaskEditorProvider')
  return ctx
}

export function TaskEditorProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ task?: Task; defaults?: Defaults; key: number } | null>(null)
  const openTask = useCallback((task: Task) => setState({ task, key: Date.now() }), [])
  const newTask = useCallback((defaults?: Defaults) => setState({ defaults, key: Date.now() }), [])
  return (
    <EditorContext.Provider value={{ openTask, newTask }}>
      {children}
      {state && <TaskForm key={state.key} task={state.task} defaults={state.defaults} onClose={() => setState(null)} />}
    </EditorContext.Provider>
  )
}

const NEW_COURSE = '__new__'

function TaskForm({ task, defaults, onClose }: { task?: Task; defaults?: Defaults; onClose: () => void }) {
  const courses = useCourses()
  const { confirm, toast } = useUI()
  const editing = Boolean(task)

  const [title, setTitle] = useState(task?.title ?? '')
  const [courseId, setCourseId] = useState(task?.courseId ?? defaults?.courseId ?? '')
  const [newCode, setNewCode] = useState('')
  const [newName, setNewName] = useState('')
  const [dueDate, setDueDate] = useState(task?.dueDate ?? defaults?.dueDate ?? todayISO())
  const [dueTime, setDueTime] = useState(task?.dueTime ?? '')
  const [type, setType] = useState<TaskType | ''>(task?.type ?? '')
  const [priority, setPriority] = useState<Priority>(task?.priority ?? 'Medium')
  const [startDate, setStartDate] = useState(task?.startDate ?? '')
  const [notes, setNotes] = useState(task?.notes ?? '')
  const [link, setLink] = useState(task?.link ?? '')
  const [showMore, setShowMore] = useState(Boolean(task?.notes || task?.startDate || task?.link))
  const [postponeTo, setPostponeTo] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  function validate() {
    const e: Record<string, string> = {}
    if (!title.trim()) e.title = 'Give the task a title.'
    if (!isValidISODate(dueDate)) e.dueDate = 'Pick a valid due date.'
    if (startDate && !isValidISODate(startDate)) e.startDate = 'Pick a valid start date or leave it empty.'
    if (startDate && isValidISODate(dueDate) && startDate > dueDate) e.startDate = 'Start date can’t be after the due date.'
    if (courseId === NEW_COURSE && !newCode.trim()) e.course = 'Enter a course code (e.g. CST8912).'
    if (link && !/^https?:\/\/\S+$/i.test(link.trim())) e.link = 'Links should start with http:// or https://'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function save() {
    if (!validate()) return
    let cid: string | null = courseId || null
    if (courseId === NEW_COURSE) {
      const existing = courses.find((c) => c.code === newCode.trim().toUpperCase())
      cid = existing ? existing.id : await addCourse({ code: newCode, name: newName })
    }
    const data = {
      title: title.trim(),
      courseId: cid,
      dueDate,
      dueTime: dueTime || undefined,
      type: type || guessType(title),
      priority,
      startDate: startDate || undefined,
      notes,
      link: link.trim() || undefined,
    }
    if (task) {
      // Changing the date by hand means it's no longer an estimate.
      await updateTask(task.id, { ...data, dateEstimated: task.dueDate === dueDate ? task.dateEstimated : false })
      toast('Task saved')
    } else {
      await addTask({ ...data, status: 'none', dateEstimated: false, source: 'manual' })
      toast('Task added')
    }
    onClose()
  }

  async function remove() {
    if (!task) return
    const ok = await confirm({ title: 'Delete task?', message: `“${task.title}” will be permanently deleted.`, confirmLabel: 'Delete', danger: true })
    if (!ok) return
    await deleteTask(task.id)
    toast('Task deleted')
    onClose()
  }

  async function doPostpone() {
    if (!task || !postponeTo) return
    if (!isValidISODate(postponeTo)) { setErrors({ postpone: 'Pick a valid date.' }); return }
    await postponeTask(task.id, postponeTo)
    toast(`Postponed to ${postponeTo}`)
    onClose()
  }

  const run = (fn: () => Promise<unknown>, msg: string) => async () => { await fn(); toast(msg); onClose() }

  return (
    <Modal title={editing ? 'Edit task' : 'New task'} onClose={onClose} footer={
      <>
        {editing && <button className="btn btn-ghost-danger" onClick={remove}><Icon name="trash" size={16} /> Delete</button>}
        <span className="spacer" />
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={save}>{editing ? 'Save' : 'Add task'}</button>
      </>
    }>
      <form onSubmit={(e) => { e.preventDefault(); save() }} className="form">
        <label className="field">
          <span>Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Lab 7 – Kubernetes" autoFocus />
          {errors.title && <small className="error">{errors.title}</small>}
        </label>

        <div className="field-row">
          <label className="field">
            <span>Course</span>
            <select value={courseId} onChange={(e) => setCourseId(e.target.value)}>
              <option value="">No course</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.code} – {c.name}</option>)}
              <option value={NEW_COURSE}>+ New course…</option>
            </select>
            {errors.course && <small className="error">{errors.course}</small>}
          </label>
          <label className="field">
            <span>Due date</span>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            {errors.dueDate && <small className="error">{errors.dueDate}</small>}
          </label>
          <label className="field field-sm">
            <span>Time</span>
            <input type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} />
          </label>
        </div>

        {courseId === NEW_COURSE && (
          <div className="field-row inline-new">
            <label className="field field-sm"><span>Code</span><input value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder="CST8912" /></label>
            <label className="field"><span>Name</span><input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Cloud Solutions Architecture" /></label>
          </div>
        )}

        {task?.dateEstimated && <p className="hint"><Icon name="alert" size={14} /> This date was estimated during import. Changing it marks it as confirmed.</p>}

        <button type="button" className="link-btn" onClick={() => setShowMore((s) => !s)}>
          {showMore ? 'Hide details' : 'More details'}
        </button>

        {showMore && (
          <>
            <div className="field-row">
              <label className="field">
                <span>Type</span>
                <select value={type} onChange={(e) => setType(e.target.value as TaskType)}>
                  <option value="">Auto ({guessType(title)})</option>
                  {TASK_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </label>
              <label className="field">
                <span>Priority</span>
                <select value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
                  {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
                </select>
              </label>
              <label className="field">
                <span>Start date <em>(optional)</em></span>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                {errors.startDate && <small className="error">{errors.startDate}</small>}
              </label>
            </div>
            <label className="field">
              <span>Notes</span>
              <textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Instructions, reminders, requirements…" />
            </label>
            <label className="field">
              <span>Link</span>
              <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://brightspace.algonquincollege.com/…" />
              {errors.link && <small className="error">{errors.link}</small>}
            </label>
            {task?.link && /^https?:\/\//.test(task.link) && <a href={task.link} target="_blank" rel="noreferrer" className="link-out"><Icon name="link" size={14} /> Open link</a>}
          </>
        )}

        {editing && task && (
          <div className="task-actions">
            {task.status === 'completed'
              ? <button type="button" className="btn" onClick={run(() => reopenTask(task.id), 'Task reopened')}><Icon name="undo" size={16} /> Reopen</button>
              : <button type="button" className="btn btn-success" onClick={run(() => completeTask(task.id), 'Task completed')}><Icon name="check" size={16} /> Mark complete</button>}
            {task.status === 'postponed'
              ? <button type="button" className="btn" onClick={run(() => unpostponeTask(task.id), 'No longer postponed')}>Un-postpone</button>
              : task.status !== 'completed' && <button type="button" className="btn" onClick={() => setPostponeTo(addDays(task.dueDate < todayISO() ? todayISO() : task.dueDate, 7))}><Icon name="pause" size={16} /> Postpone…</button>}
            <button type="button" className="btn" onClick={run(() => duplicateTask(task), 'Task duplicated')}><Icon name="copy" size={16} /> Duplicate</button>
          </div>
        )}
        {postponeTo !== null && (
          <div className="postpone-box">
            <label className="field">
              <span>Postpone to</span>
              <input type="date" value={postponeTo} onChange={(e) => setPostponeTo(e.target.value)} />
              {errors.postpone && <small className="error">{errors.postpone}</small>}
            </label>
            <button type="button" className="btn btn-warn" onClick={doPostpone}>Postpone</button>
          </div>
        )}
        <button type="submit" hidden />
      </form>
    </Modal>
  )
}
