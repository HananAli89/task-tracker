import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { Draft } from '../types'
import { db } from '../db'
import { markDuplicates, extractCourse } from '../lib/parse/common'
import { icsToDrafts } from '../lib/parse/ics'
import { detectKind, pageToLines, parseCalendarList, parseOutline, suggestWeek1, totalTextLength, type Page, type PdfKind } from '../lib/parse/pdfParse'
import { readPdf } from '../lib/parse/pdf'
import { FIELDS, FIELD_LABELS, findHeaderRow, readSpreadsheet, rowsToDrafts, suggestMapping, type Mapping, type SheetData } from '../lib/parse/sheet'
import { getSettings, updateSettings, useSettings } from '../lib/settings'
import { useCourses } from '../lib/tasks'
import { ImportReview } from '../components/ImportReview'
import { useUI } from '../components/ui'
import { Icon } from '../components/Icon'

type Tab = 'ics' | 'pdf' | 'spreadsheet'
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function ImportPage() {
  const [tab, setTab] = useState<Tab>('ics')
  const [review, setReview] = useState<Draft[] | null>(null)
  const [done, setDone] = useState('')
  const { toast } = useUI()

  // Every importer ends here: flag duplicates against what's already saved, then review.
  async function toReview(drafts: Draft[]) {
    const [tasks, courses] = await Promise.all([db.tasks.toArray(), db.courses.toArray()])
    setDone('')
    setReview(markDuplicates(drafts, tasks, courses))
  }

  if (review) {
    return (
      <div className="page">
        <header className="page-head"><h1>Review import</h1></header>
        <ImportReview initial={review} source={tab} onCancel={() => setReview(null)}
          onDone={(msg) => { setReview(null); setDone(msg); toast(msg) }} />
      </div>
    )
  }

  return (
    <div className="page narrow">
      <header className="page-head"><h1>Import</h1></header>
      {done && <div className="card success-box"><Icon name="checkCircle" /> {done} <Link to="/tasks">View tasks</Link></div>}

      <div className="tabs" role="tablist">
        {([['ics', 'Calendar (.ics)'], ['pdf', 'PDF'], ['spreadsheet', 'Spreadsheet']] as const).map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{label}</button>
        ))}
      </div>

      {tab === 'ics' && <IcsImport onDrafts={toReview} />}
      {tab === 'pdf' && <PdfImport onDrafts={toReview} />}
      {tab === 'spreadsheet' && <SheetImport onDrafts={toReview} />}
    </div>
  )
}

function FilePick({ accept, label, onFile }: { accept: string; label: string; onFile: (f: File) => void }) {
  const [over, setOver] = useState(false)
  return (
    <label className={`dropzone ${over ? 'over' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setOver(true) }} onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files[0]; if (f) onFile(f) }}>
      <Icon name="upload" size={24} />
      <span>{label}</span>
      <span className="muted small">Click to choose, or drop a file here</span>
      <input type="file" accept={accept} hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = '' }} />
    </label>
  )
}

// ---------- .ics ----------

function IcsImport({ onDrafts }: { onDrafts: (d: Draft[]) => void }) {
  const [error, setError] = useState('')
  async function onFile(f: File) {
    setError('')
    const text = await f.text()
    if (!text.includes('BEGIN:VCALENDAR')) return setError('That doesn’t look like a calendar (.ics) file.')
    const drafts = icsToDrafts(text)
    if (!drafts.length) return setError('No events were found in that file.')
    onDrafts(drafts)
  }
  return (
    <div className="card">
      <p className="small">The most accurate way to import: exact dates and times for every course.</p>
      <ol className="steps small">
        <li>In Brightspace, open <b>Calendar</b>.</li>
        <li>Click <b>Subscribe</b> (or the settings/export option) and download the <b>.ics</b> file. If you only get a link, paste it into your browser to download the file.</li>
        <li>Choose the file below.</li>
      </ol>
      <FilePick accept=".ics,text/calendar" label="Choose a .ics file" onFile={onFile} />
      {error && <p className="error">{error}</p>}
    </div>
  )
}

// ---------- PDF ----------

function PdfImport({ onDrafts }: { onDrafts: (d: Draft[]) => void }) {
  const settings = useSettings()
  const courses = useCourses()
  const [pages, setPages] = useState<Page[] | null>(null)
  const [fileName, setFileName] = useState('')
  const [kind, setKind] = useState<PdfKind>('calendar')
  const [noText, setNoText] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [week1, setWeek1] = useState(settings.week1Start)

  async function onFile(f: File) {
    setError(''); setNoText(false); setPages(null); setBusy(true); setFileName(f.name)
    try {
      const p = await readPdf(f)
      if (totalTextLength(p) < 20) { setNoText(true); return }
      setPages(p)
      setKind(detectKind(p))
      // Try to fill in the course and Week 1 date from the PDF itself.
      // The file name often has it ("26F_CST8915_Weekly-Schedule.pdf"); the full name is usually on page 1.
      const firstLines = p.slice(0, 1).flatMap(pageToLines).slice(0, 25)
      const fromName = extractCourse(f.name.replace(/[_.-]/g, ' '))
      const fromText = firstLines.map((l) => extractCourse(l)).find((c) => c && (!fromName || c.code === fromName.code))
      const found = fromName ?? fromText
      if (found) {
        const existing = courses.find((c) => c.code === found.code)
        setCode(found.code)
        setName(existing?.name ?? (fromText?.code === found.code ? fromText.name : '').slice(0, 80))
      } else { setCode(''); setName('') }
      const suggested = suggestWeek1(p)
      if (suggested) setWeek1(suggested)
    } catch (e) {
      setError(`Couldn’t read that PDF: ${e instanceof Error ? e.message : e}`)
    } finally {
      setBusy(false)
    }
  }

  function findTasks() {
    if (!pages) return
    setError('')
    if (kind === 'calendar') {
      const drafts = parseCalendarList(pages)
      if (!drafts.length) return setError('No dated items were found. Try “Course outline” instead, or enter tasks by hand.')
      return onDrafts(drafts)
    }
    if (!code.trim()) return setError('Enter the course code for this outline.')
    if (!week1) return setError('Enter the date Week 1 starts so week numbers can be turned into dates.')
    updateSettings({ week1Start: week1 })
    const drafts = parseOutline(pages, {
      week1Start: week1, defaultDueDay: getSettings().defaultDueDay, defaultDueTime: getSettings().defaultDueTime,
      courseCode: code.trim().toUpperCase(), courseName: name.trim(),
    })
    if (!drafts.length) return setError('No graded items like “Lab 3 (4%)” were found in this outline. You can still add tasks by hand.')
    onDrafts(drafts)
  }

  return (
    <div className="card">
      <p className="small">Works with text PDFs: a Brightspace calendar list, or a course outline with a weekly schedule. Everything is read on your device.</p>
      <FilePick accept=".pdf,application/pdf" label={busy ? 'Reading…' : fileName || 'Choose a PDF'} onFile={onFile} />
      {error && <p className="error">{error}</p>}

      {noText && (
        <div className="notice">
          <Icon name="alert" />
          <div>
            <b>This PDF has no readable text</b> — it’s made of images (for example, saved with “Microsoft Print to PDF” or scanned), so nothing can be extracted without guessing.
            <ul className="small">
              <li>Print the page again in Chrome and choose <b>Save as PDF</b> as the destination, then import that file.</li>
              <li>Or use the <b>Calendar (.ics)</b> tab, which is the most accurate option.</li>
              <li>Or add the tasks by hand with <b>+ Add task</b>.</li>
            </ul>
          </div>
        </div>
      )}

      {pages && (
        <div className="form pdf-options">
          <label className="field">
            <span>What kind of PDF is this?</span>
            <select value={kind} onChange={(e) => setKind(e.target.value as PdfKind)}>
              <option value="calendar">Calendar / to-do list (dates listed per item)</option>
              <option value="outline">Course outline (weekly schedule)</option>
            </select>
          </label>
          {kind === 'outline' && (
            <>
              <div className="field-row">
                <label className="field field-sm"><span>Course code</span>
                  <input list="course-codes" value={code} onChange={(e) => setCode(e.target.value)} placeholder="CST8915" />
                  <datalist id="course-codes">{courses.map((c) => <option key={c.id} value={c.code}>{c.name}</option>)}</datalist>
                </label>
                <label className="field"><span>Course name</span><input value={name} onChange={(e) => setName(e.target.value)} /></label>
              </div>
              <div className="field-row">
                <label className="field"><span>Week 1 starts</span><input type="date" value={week1} onChange={(e) => setWeek1(e.target.value)} /></label>
                <label className="field"><span>Undated items due on</span>
                  <select value={settings.defaultDueDay} onChange={(e) => updateSettings({ defaultDueDay: Number(e.target.value) })}>
                    {DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
                  </select>
                </label>
                <label className="field field-sm"><span>at</span><input type="time" value={settings.defaultDueTime} onChange={(e) => updateSettings({ defaultDueTime: e.target.value })} /></label>
              </div>
              <p className="hint small">Only items with a weight, like “Lab 3 Assignment (4%)”, are picked up. Dates worked out from a week number are marked <span className="est">est.</span></p>
            </>
          )}
          <button className="btn btn-primary" onClick={findTasks}>Find tasks</button>
        </div>
      )}
    </div>
  )
}

// ---------- Spreadsheet ----------

function SheetImport({ onDrafts }: { onDrafts: (d: Draft[]) => void }) {
  const { dateFormat } = useSettings()
  const [sheets, setSheets] = useState<SheetData[] | null>(null)
  const [sheetIdx, setSheetIdx] = useState(0)
  const [headerRow, setHeaderRow] = useState(0)
  const [mapping, setMapping] = useState<Mapping | null>(null)
  const [error, setError] = useState('')

  function chooseSheet(all: SheetData[], i: number) {
    const h = findHeaderRow(all[i].rows)
    setSheetIdx(i); setHeaderRow(h); setMapping(suggestMapping(all[i].rows[h] ?? []))
  }

  async function onFile(f: File) {
    setError('')
    try {
      const all = (await readSpreadsheet(f)).filter((s) => s.rows.length > 0)
      if (!all.length) return setError('That file has no data.')
      setSheets(all)
      // Pick the sheet that looks most like a task list.
      let best = 0, bestScore = -1
      all.forEach((s, i) => {
        const m = suggestMapping(s.rows[findHeaderRow(s.rows)] ?? [])
        const score = Object.values(m).filter((v) => v >= 0).length
        if (score > bestScore) { best = i; bestScore = score }
      })
      chooseSheet(all, best)
    } catch (e) {
      setError(`Couldn’t read that file: ${e instanceof Error ? e.message : e}`)
    }
  }

  const rows = sheets?.[sheetIdx]?.rows ?? []
  const header = rows[headerRow] ?? []
  const colName = (i: number) => `${String.fromCharCode(65 + (i % 26))}: ${String(header[i] ?? '').trim() || '(blank)'}`

  function next() {
    if (!mapping) return
    if (mapping.title < 0 || mapping.dueDate < 0) return setError('Map at least the task title and due date columns.')
    const drafts = rowsToDrafts(rows, headerRow, mapping, dateFormat === 'DD/MM/YYYY')
    if (!drafts.length) return setError('No rows with a title were found below the header row.')
    onDrafts(drafts)
  }

  return (
    <div className="card">
      <p className="small">Import from Excel (.xlsx) or CSV. Column names don’t need to match — you’ll map them next.</p>
      <FilePick accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" label="Choose a spreadsheet" onFile={onFile} />
      {error && <p className="error">{error}</p>}

      {sheets && mapping && (
        <div className="form">
          <div className="field-row">
            {sheets.length > 1 && (
              <label className="field"><span>Sheet</span>
                <select value={sheetIdx} onChange={(e) => chooseSheet(sheets, Number(e.target.value))}>
                  {sheets.map((s, i) => <option key={i} value={i}>{s.name}</option>)}
                </select>
              </label>
            )}
            <label className="field field-sm"><span>Header row</span>
              <input type="number" min={1} max={rows.length} value={headerRow + 1}
                onChange={(e) => { const h = Math.max(0, Number(e.target.value) - 1); setHeaderRow(h); setMapping(suggestMapping(rows[h] ?? [])) }} />
            </label>
          </div>
          <div className="mapping">
            {FIELDS.map((f) => (
              <label key={f} className="field">
                <span>{FIELD_LABELS[f]}</span>
                <select value={mapping[f]} onChange={(e) => setMapping({ ...mapping, [f]: Number(e.target.value) })}>
                  <option value={-1}>— not in this file —</option>
                  {header.map((_, i) => <option key={i} value={i}>{colName(i)}</option>)}
                </select>
              </label>
            ))}
          </div>
          <p className="muted small">{Math.max(0, rows.length - headerRow - 1)} rows below the header.</p>
          <button className="btn btn-primary" onClick={next}>Preview tasks</button>
        </div>
      )}
    </div>
  )
}
