import { useRef, useState } from 'react'
import { updateSettings, useSettings } from '../lib/settings'
import { deleteAllData, exportBackup, exportCSV, parseBackup, restoreBackup } from '../lib/backup'
import { useCourses, useTasks } from '../lib/tasks'
import { useUI } from '../components/ui'
import { Icon } from '../components/Icon'

export function SettingsPage() {
  const s = useSettings()
  const tasks = useTasks()
  const courses = useCourses()
  const { confirm, toast } = useUI()
  const fileRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState('')

  async function onRestoreFile(file: File) {
    setError('')
    try {
      const backup = parseBackup(await file.text())
      const choice = await confirm({
        title: 'Restore backup',
        message: (
          <>
            <p>This backup has <b>{backup.courses.length} courses</b> and <b>{backup.tasks.length} tasks</b> (saved {new Date(backup.exportedAt).toLocaleString('en-CA')}).</p>
            <p>You currently have {courses.length} courses and {tasks.length} tasks.</p>
            <p><b>Merge</b> adds anything that isn’t already here. <b>Replace</b> deletes your current data first.</p>
          </>
        ),
        choices: [{ label: 'Merge', value: 'merge' }, { label: 'Replace all', value: 'replace', danger: true }],
      })
      if (!choice) return
      if (choice === 'replace') {
        const sure = await confirm({ title: 'Replace everything?', message: `Your current ${tasks.length} tasks and ${courses.length} courses will be deleted and replaced by the backup.`, confirmLabel: 'Replace', danger: true })
        if (!sure) return
      }
      const added = await restoreBackup(backup, choice as 'merge' | 'replace')
      toast(`Restored ${added.tasks} tasks and ${added.courses} courses`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that file.')
    }
  }

  async function wipe() {
    const ok = await confirm({ title: 'Delete all data?', message: `All ${tasks.length} tasks and ${courses.length} courses on this device will be deleted. Export a backup first if you might need them.`, confirmLabel: 'Delete everything', danger: true })
    if (ok) { await deleteAllData(); toast('All data deleted') }
  }

  return (
    <div className="page narrow">
      <header className="page-head"><h1>Settings</h1></header>

      <section className="card settings">
        <h2 className="card-title">Appearance</h2>
        <div className="setting">
          <span>Theme</span>
          <div className="seg">
            {(['system', 'light', 'dark'] as const).map((t) => (
              <button key={t} className={s.theme === t ? 'on' : ''} onClick={() => updateSettings({ theme: t })}>{t[0].toUpperCase() + t.slice(1)}</button>
            ))}
          </div>
        </div>
        <div className="setting">
          <span>Date format</span>
          <select value={s.dateFormat} onChange={(e) => updateSettings({ dateFormat: e.target.value as typeof s.dateFormat })}>
            <option value="YYYY-MM-DD">YYYY-MM-DD</option>
            <option value="DD/MM/YYYY">DD/MM/YYYY</option>
          </select>
        </div>
        <div className="setting">
          <span>Week starts on</span>
          <select value={s.weekStart} onChange={(e) => updateSettings({ weekStart: Number(e.target.value) as 0 | 1 })}>
            <option value={0}>Sunday</option>
            <option value={1}>Monday</option>
          </select>
        </div>
      </section>

      <section className="card settings">
        <h2 className="card-title">Backup &amp; data</h2>
        <p className="muted small">Your data is stored only in this browser on this device. Export a backup regularly, and use it to move your tasks to another device.</p>
        <div className="btn-row">
          <button className="btn btn-primary" onClick={() => exportBackup().then(() => toast('Backup downloaded'))}><Icon name="download" size={16} /> Export backup (JSON)</button>
          <button className="btn" onClick={() => fileRef.current?.click()}><Icon name="upload" size={16} /> Restore backup</button>
          <button className="btn" onClick={() => exportCSV().then(() => toast('CSV downloaded'))}><Icon name="file" size={16} /> Export tasks (CSV)</button>
        </div>
        <input ref={fileRef} type="file" accept=".json,application/json" hidden
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onRestoreFile(f); e.target.value = '' }} />
        {error && <p className="error">{error}</p>}
        <hr />
        <button className="btn btn-ghost-danger" onClick={wipe}><Icon name="trash" size={16} /> Delete all data</button>
      </section>

      <p className="muted small center">{tasks.length} tasks · {courses.length} courses stored on this device</p>
    </div>
  )
}
