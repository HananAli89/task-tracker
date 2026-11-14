// Reads a calendar (.ics) file — e.g. exported from Brightspace — into import drafts.
import type { Draft } from '../../types'
import { toISODate } from '../dates'
import { cleanTitle, extractCourse, makeDraft } from './common'

interface Prop { params: Record<string, string>; value: string }
type Event = Record<string, Prop>

function unescape(v: string): string {
  return v.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1')
}

export function parseEvents(text: string): Event[] {
  // Long lines are "folded": a line starting with a space continues the previous one.
  const lines = text.replace(/\r\n?/g, '\n').replace(/\n[ \t]/g, '').split('\n')
  const events: Event[] = []
  let current: Event | null = null
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') current = {}
    else if (line === 'END:VEVENT') { if (current) events.push(current); current = null }
    else if (current) {
      const colon = line.indexOf(':')
      if (colon < 0) continue
      const [name, ...paramParts] = line.slice(0, colon).split(';')
      const params: Record<string, string> = {}
      for (const p of paramParts) {
        const [k, v] = p.split('=')
        params[k.toUpperCase()] = v ?? ''
      }
      current[name.toUpperCase()] = { params, value: unescape(line.slice(colon + 1)) }
    }
  }
  return events
}

// "20261115T235900Z" (UTC), "20261115T235900" (local) or "20261115" (all-day)
export function parseICSDate(p: Prop): { date: string; time: string; allDay: boolean } | null {
  const m = p.value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?/)
  if (!m) return null
  const [, y, mo, d, hh, mm, , z] = m
  if (!hh) return { date: `${y}-${mo}-${d}`, time: '', allDay: true }
  let dt: Date
  if (z) dt = new Date(Date.UTC(+y, +mo - 1, +d, +hh, +mm))   // convert UTC to this device's time zone
  else dt = new Date(+y, +mo - 1, +d, +hh, +mm)                // already local wall-clock time
  const time = `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`
  return { date: toISODate(dt), time, allDay: false }
}

export function icsToDrafts(text: string): Draft[] {
  return parseEvents(text).map((ev) => {
    const summary = ev.SUMMARY?.value ?? '(untitled)'
    const description = ev.DESCRIPTION?.value ?? ''
    const location = ev.LOCATION?.value ?? ''
    const categories = ev.CATEGORIES?.value ?? ''

    const start = ev.DTSTART ? parseICSDate(ev.DTSTART) : null
    const end = ev.DTEND ? parseICSDate(ev.DTEND) : null
    // All-day events end the *next* day, so use the start; timed events use the end.
    const when = start?.allDay ? start : end ?? start

    // The course can be in the title or any of the other fields.
    const course = extractCourse(summary) ?? extractCourse(location) ?? extractCourse(categories) ?? extractCourse(description)
    let title = summary
    if (course) {
      // Drop the course text from the title if it was embedded there.
      title = title.replace(/\b\d{2}[A-Z]_[A-Z]{3,4}\d{4}_\d{2,3}\b[^\n-]*/, '').replace(new RegExp(`\\b${course.code}\\b`), '')
    }
    const starts = /availability starts|start date|- starts$/i.test(summary)

    return makeDraft({
      title: cleanTitle(title) || cleanTitle(summary),
      courseCode: course?.code ?? '',
      courseName: course?.name ?? '',
      dueDate: when?.date ?? '',
      dueTime: when?.time ?? '',
      sourceText: [summary, location].filter(Boolean).join(' · '),
      sourceId: ev.UID?.value,
      notes: description.trim().slice(0, 2000),
      // "Availability starts" events are not deadlines — shown but unticked.
      include: !starts,
      warning: starts ? 'Start of availability, not a deadline' : undefined,
    })
  })
}
