// The review screen every import goes through. Nothing is saved until "Import selected".
import { useMemo, useState } from 'react'
import { TASK_TYPES, type Draft, type TaskType } from '../types'
import { db, newId, nowStamp } from '../db'
import { nextColor } from '../lib/colors'
import { isValidISODate } from '../lib/dates'
import { makeDraft } from '../lib/parse/common'
import { useCourses } from '../lib/tasks'
import { useUI } from './ui'
import { Icon } from './Icon'

export function ImportReview({ initial, source, onCancel, onDone }: {
  initial: Draft[]
  source: 'pdf' | 'ics' | 'spreadsheet'
  onCancel: () => void
  onDone: (summary: string) => void
}) {
  const courses = useCourses()
  const { confirm } = useUI()
  const [drafts, setDrafts] = useState(initial)
  const [excluded, setExcluded] = useState<Set<string>>(new Set())
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const update = (key: string, patch: Partial<Draft>) => setDrafts((ds) => ds.map((d) => (d.key === key ? { ...d, ...patch } : d)))
  const remove = (key: string) => setDrafts((ds) => ds.filter((d) => d.key !== key))

  // Course codes in this import, with their task counts.
  const codes = useMemo(() => {
    const m = new Map<string, number>()
    drafts.forEach((d) => m.set(d.courseCode.toUpperCase(), (m.get(d.courseCode.toUpperCase()) ?? 0) + 1))
    return [...m.entries()].sort()
  }, [drafts])

  const existingCodes = new Set(courses.map((c) => c.code))
  const chosen = drafts.filter((d) => d.include && !excluded.has(d.courseCode.toUpperCase()))
  const newCodes = [...new Set(chosen.map((d) => d.courseCode.trim().toUpperCase()).filter((c) => c && !existingCodes.has(c)))]
  const invalid = (d: Draft) => !d.title.trim() || !isValidISODate(d.dueDate)

  const setAll = (include: boolean) => setDrafts((ds) => ds.map((d) => ({ ...d, include })))

  async function doImport() {
    setError('')
    const bad = chosen.filter(invalid)
    if (bad.length) { setError(`${bad.length} selected row${bad.length === 1 ? ' needs' : 's need'} a title and a valid due date (highlighted in red), or untick them.`); return }
    if (!chosen.length) { setError('No rows selected.'); return }
    if (newCodes.length) {
      const ok = await confirm({ title: 'Create new courses?', message: `These courses don’t exist yet and will be created: ${newCodes.join(', ')}.`, confirmLabel: 'Create and import' })
      if (!ok) return
    }
    setSaving(true)
    try {
      await db.transaction('rw', db.courses, db.tasks, async () => {
        const all = await db.courses.toArray()
        const idByCode = new Map(all.map((c) => [c.code, c.id]))
        const usedColors = all.map((c) => c.color)
        for (const code of newCodes) {
          const name = chosen.find((d) => d.courseCode.trim().toUpperCase() === code && d.courseName)?.courseName ?? ''
          const id = newId()
          const color = nextColor(usedColors)
          usedColors.push(color)
          await db.courses.add({ id, code, name, color, createdAt: nowStamp(), updatedAt: nowStamp() })
          idByCode.set(code, id)
        }
        const stamp = nowStamp()
        await db.tasks.bulkAdd(chosen.map((d) => ({
          id: newId(),
          title: d.title.trim(),
          courseId: idByCode.get(d.courseCode.trim().toUpperCase()) ?? null,
          type: d.type,
          dueDate: d.dueDate,
          dueTime: d.dueTime || undefined,
          priority: 'Medium' as const,
          status: d.status,
          notes: d.notes,
          dateEstimated: d.estimated,
          source,
          sourceId: d.sourceId,
          createdAt: stamp,
          updatedAt: stamp,
          completedAt: d.status === 'completed' ? stamp : null,
        })))
      })
      const skipped = drafts.length - chosen.length
      onDone(`Imported ${chosen.length} task${chosen.length === 1 ? '' : 's'}${skipped ? `, skipped ${skipped}` : ''}${newCodes.length ? `, created ${newCodes.length} course${newCodes.length === 1 ? '' : 's'}` : ''}.`)
    } catch (e) {
      setError(`Import failed, nothing was saved: ${e instanceof Error ? e.message : e}`)
    } finally {
      setSaving(false)
    }
  }

  const dupCount = drafts.filter((d) => d.warning === 'Possible duplicate').length
  const estCount = chosen.filter((d) => d.estimated).length

  return (
    <div className="review">
      <div className="card review-summary">
        <div>
          <h2 className="card-title">Review {drafts.length} found item{drafts.length === 1 ? '' : 's'}</h2>
          <p className="muted small">
            Edit anything that looks wrong and untick what you don’t want.
            {dupCount > 0 && <> {dupCount} possible duplicate{dupCount === 1 ? ' was' : 's were'} unticked.</>}
            {estCount > 0 && <> {estCount} selected date{estCount === 1 ? ' is' : 's are'} <span className="est">est.</span> (calculated, not stated).</>}
          </p>
        </div>
        <div className="btn-row">
          <button className="btn btn-sm" onClick={() => setAll(true)}>Select all</button>
          <button className="btn btn-sm" onClick={() => setAll(false)}>Select none</button>
        </div>
        {codes.length > 1 && (
          <div className="course-filter">
            <span className="small muted">Courses:</span>
            {codes.map(([code, n]) => (
              <label key={code} className="pill-check">
                <input type="checkbox" checked={!excluded.has(code)} onChange={(e) => setExcluded((s) => {
                  const next = new Set(s); if (e.target.checked) next.delete(code); else next.add(code); return next
                })} />
                {code || 'No course'} <span className="muted">({n})</span>
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="draft-list">
        {drafts.map((d) => {
          const off = excluded.has(d.courseCode.toUpperCase())
          return (
            <div key={d.key} className={`draft card ${d.include && !off ? '' : 'draft-off'} ${d.include && !off && invalid(d) ? 'draft-bad' : ''}`}>
              <input type="checkbox" className="draft-check" checked={d.include && !off} disabled={off}
                onChange={(e) => update(d.key, { include: e.target.checked })} aria-label={`Include ${d.title}`} />
              <div className="draft-fields">
                <input className="draft-title" value={d.title} onChange={(e) => update(d.key, { title: e.target.value })} aria-label="Title" placeholder="Title" />
                <div className="draft-row">
                  <input className="draft-code" value={d.courseCode} onChange={(e) => update(d.key, { courseCode: e.target.value.toUpperCase() })} aria-label="Course code" placeholder="Course" />
                  <select value={d.type} onChange={(e) => update(d.key, { type: e.target.value as TaskType })} aria-label="Type">
                    {TASK_TYPES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                  <input type="date" value={d.dueDate} onChange={(e) => update(d.key, { dueDate: e.target.value, estimated: false })} aria-label="Due date" />
                  <input type="time" value={d.dueTime} onChange={(e) => update(d.key, { dueTime: e.target.value })} aria-label="Due time" />
                  {d.estimated && <span className="est" title="Calculated from a week number — check it">est.</span>}
                  {d.status === 'completed' && <span className="badge badge-done">Completed</span>}
                  {d.status === 'postponed' && <span className="badge badge-postponed">Postponed</span>}
                </div>
                {(d.sourceText || d.warning) && (
                  <div className="draft-source">
                    {d.warning && <span className="badge badge-warn"><Icon name="alert" size={12} /> {d.warning}</span>}
                    <span className="muted">{d.sourceText}</span>
                  </div>
                )}
              </div>
              <button className="icon-btn" onClick={() => remove(d.key)} aria-label="Remove row"><Icon name="x" size={16} /></button>
            </div>
          )
        })}
        <button className="btn add-row" onClick={() => setDrafts((ds) => [...ds, makeDraft({ title: '', courseCode: ds[ds.length - 1]?.courseCode ?? '' })])}>
          <Icon name="plus" size={16} /> Add a row by hand
        </button>
      </div>

      <div className="review-bar">
        {error && <p className="error">{error}</p>}
        <div className="btn-row">
          <button className="btn" onClick={onCancel}>Cancel</button>
          <button className="btn btn-primary" onClick={doImport} disabled={saving}>Import {chosen.length} selected</button>
        </div>
      </div>
    </div>
  )
}
