import { describe, expect, it } from 'vitest'
import { icsToDrafts } from './ics'
import { cleanTitle, extractCourse, guessType, markDuplicates, parseLooseDate } from './common'
import { findHeaderRow, rowsToDrafts, suggestMapping } from './sheet'
import { parseOutline, weekDate, type Page } from './pdfParse'
import { isOverdue, groupOf } from '../tasks'
import type { Task } from '../../types'

const ICS = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:abc-1@brightspace
SUMMARY:Lab 9: Understanding WAI-ARIA - Due
DTSTART:20261115T130000Z
DTEND:20261115T130000Z
LOCATION:26F_CST8914_010 Accessible by Design
DESCRIPTION:Submit to the dropbox\\, please.
END:VEVENT
BEGIN:VEVENT
UID:abc-2@brightspace
SUMMARY:Quiz #3 - Availability Starts
DTSTART;VALUE=DATE:20261110
DTEND;VALUE=DATE:20261111
LOCATION:26F_CST8911_300 Introduction to Cloud Computing
END:VEVENT
BEGIN:VEVENT
UID:abc-3
SUMMARY:CST8915 Final Project long tit
 le folded
DTSTART:20261214T235900
END:VEVENT
END:VCALENDAR`

describe('ics', () => {
  const d = icsToDrafts(ICS)
  it('reads events, course and local time', () => {
    expect(d).toHaveLength(3)
    expect(d[0]).toMatchObject({ title: 'Lab 9: Understanding WAI-ARIA', courseCode: 'CST8914', courseName: 'Accessible by Design', type: 'Lab', sourceId: 'abc-1@brightspace' })
    // 13:00 UTC = 8:00 am Toronto (EST)
    expect(d[0].dueDate).toBe('2026-11-15')
    expect(d[0].notes).toBe('Submit to the dropbox, please.')
  })
  it('unticks availability-start events and handles all-day dates', () => {
    expect(d[1]).toMatchObject({ include: false, dueDate: '2026-11-10', dueTime: '' })
  })
  it('unfolds long lines and finds a plain course code in the title', () => {
    expect(d[2]).toMatchObject({ title: 'Final Project long title folded', courseCode: 'CST8915', dueTime: '23:59' })
  })
})

describe('common', () => {
  it('extracts courses', () => {
    expect(extractCourse('26F_CST8912_011 Cloud Solutions Architecture')).toEqual({ code: 'CST8912', name: 'Cloud Solutions Architecture' })
    expect(extractCourse('CST 8913 – Cloud Migration')).toEqual({ code: 'CST8913', name: 'Cloud Migration' })
  })
  it('cleans titles and guesses types', () => {
    expect(cleanTitle('• Quiz 1: ')).toBe('Quiz 1')
    expect(cleanTitle('Assignment #3: Cloud Security - Due')).toBe('Assignment #3: Cloud Security')
    expect(guessType('Midterm Project')).toBe('Project')
    expect(guessType('Final Oral Exam')).toBe('Exam')
    expect(guessType('Graded Class Discussion #2')).toBe('Discussion')
  })
  it('reads loose dates', () => {
    expect(parseLooseDate('2026-10-05', false)?.date).toBe('2026-10-05')
    expect(parseLooseDate('05/10/2026', true)?.date).toBe('2026-10-05')
    expect(parseLooseDate('10/05/2026', false)?.date).toBe('2026-10-05')
    expect(parseLooseDate('25/10/2026', false)?.date).toBe('2026-10-25')
    expect(parseLooseDate('Nov 15, 2026 11:59 PM', false)).toEqual({ date: '2026-11-15', time: '23:59' })
    expect(parseLooseDate(new Date(Date.UTC(2026, 9, 18)), false)?.date).toBe('2026-10-18')
    expect(parseLooseDate(46313, false)?.date).toBe('2026-10-18')
    expect(parseLooseDate('not a date', false)).toBeNull()
  })
})

describe('spreadsheet', () => {
  // Shaped like the Fall 2026 Excel tracker: title rows, then a header at row 5.
  const rows = [
    [], [null, 'Tasks'], [null, 'Your master database'], [],
    [null, 'Course', 'Type', 'Task', 'Week', 'Due Date', 'Date', 'Weight', 'Status', 'Priority', 'Score', 'Days Left', 'Notes'],
    [null, 'CST8913', 'Lab', 'Lab 1', 2, new Date(Date.UTC(2026, 8, 19)), 'Est.', 0.03, 'Submitted', 'Low', null, '', 'Sat 11:59 pm'],
    [null, 'CST8911', 'Quiz', 'Quiz 1', 3, new Date(Date.UTC(2026, 8, 27)), 'Exact', 0.03, 'Not Started', 'Low', null, 4, ''],
    [null, '', '', '', '', '', '', '', '', '', '', '', ''],
  ]
  it('finds the header and maps columns', () => {
    const h = findHeaderRow(rows)
    expect(h).toBe(4)
    const m = suggestMapping(rows[h])
    expect(m).toMatchObject({ title: 3, course: 1, type: 2, dueDate: 5, status: 8, notes: 12 })
    const d = rowsToDrafts(rows, h, m, false)
    expect(d).toHaveLength(2)
    expect(d[0]).toMatchObject({ title: 'Lab 1', courseCode: 'CST8913', type: 'Lab', dueDate: '2026-09-19', status: 'completed' })
    expect(d[1].status).toBe('none')
  })
})

describe('outline', () => {
  it('turns weeks into dates', () => {
    expect(weekDate('2026-09-07', 1, 6)).toBe('2026-09-12')
    expect(weekDate('2026-09-07', 9, 0)).toBe('2026-11-08')
  })
  it('reads the Assessments column, joins hyphenated words, honours "due Sunday of week N"', () => {
    const page: Page = [
      { x: 78, y: 700, s: 'Date' }, { x: 460, y: 700, s: 'Assessments' }, { x: 552, y: 700, s: 'CLRs' },
      { x: 78, y: 650, s: 'Week 3' }, { x: 365, y: 650, s: 'Discuss Lab 2' }, { x: 460, y: 650, s: '•' }, { x: 478, y: 650, s: 'Lab 1 As-' },
      { x: 478, y: 636, s: 'signment' }, { x: 478, y: 622, s: '(4%)' },
      { x: 78, y: 560, s: 'Week 7' }, { x: 460, y: 560, s: 'Graded Lab #6 (3%) due Sunday of week 9 at 11:59pm' },
    ]
    const d = parseOutline([page], { week1Start: '2026-09-07', defaultDueDay: 6, defaultDueTime: '23:59', courseCode: 'CST8915', courseName: '' })
    expect(d.map((x) => [x.title, x.dueDate, x.estimated])).toEqual([
      ['Lab 1 Assignment', '2026-09-26', true],
      ['Graded Lab #6', '2026-11-08', false],
    ])
  })
})

describe('status & duplicates', () => {
  const base: Task = { id: '1', title: 'Lab 1', courseId: 'c1', type: 'Lab', dueDate: '2020-01-01', priority: 'Medium', status: 'none', notes: '', dateEstimated: false, source: 'manual', createdAt: '', updatedAt: '', completedAt: null }
  it('overdue only when open and past due', () => {
    expect(isOverdue(base)).toBe(true)
    expect(isOverdue({ ...base, status: 'postponed' })).toBe(false)
    expect(isOverdue({ ...base, status: 'completed' })).toBe(false)
    expect(isOverdue({ ...base, dueDate: '2999-01-01' })).toBe(false)
    expect(groupOf({ ...base, status: 'postponed' })).toBe('postponed')
  })
  it('flags duplicates against saved tasks and within the batch', () => {
    const courses = [{ id: 'c1', code: 'CST8913', name: '', color: 'blue', createdAt: '', updatedAt: '' }]
    const drafts = icsToDrafts(ICS)
    const out = markDuplicates([
      { ...drafts[0], title: 'Lab 1', courseCode: 'CST8913' },
      { ...drafts[2] },
      { ...drafts[2], key: 'x' },
    ], [base], courses)
    expect(out.map((d) => d.include)).toEqual([false, true, false])
  })
})

describe('course codes', () => {
  it('ignores season/year text', () => {
    expect(extractCourse('WEEKLY SCHEDULE FALL 2026')).toBeNull()
    expect(extractCourse('WEEKLY SCHEDULE FALL 2026 CST8915 Full-stack')?.code).toBe('CST8915')
    expect(extractCourse('26F CST8915 Weekly Schedule pdf')?.code).toBe('CST8915')
  })
})
