import { useState } from 'react'
import type { Course } from '../types'
import { COURSE_COLORS } from '../lib/colors'
import { addCourse, updateCourse, useCourses } from '../lib/tasks'
import { Modal, useUI } from './ui'

export function CourseEditor({ course, onClose }: { course?: Course; onClose: () => void }) {
  const courses = useCourses()
  const { toast } = useUI()
  const [code, setCode] = useState(course?.code ?? '')
  const [name, setName] = useState(course?.name ?? '')
  const [instructor, setInstructor] = useState(course?.instructor ?? '')
  const [term, setTerm] = useState(course?.term ?? '')
  const [color, setColor] = useState(course?.color ?? '')
  const [error, setError] = useState('')

  async function save() {
    const c = code.trim().toUpperCase()
    if (!c) return setError('Enter a course code.')
    if (courses.some((x) => x.code === c && x.id !== course?.id)) return setError(`${c} already exists.`)
    if (course) await updateCourse(course.id, { code: c, name: name.trim(), instructor: instructor.trim() || undefined, term: term.trim() || undefined, color: color || course.color })
    else await addCourse({ code: c, name, instructor, term, color: color || undefined })
    toast(course ? 'Course saved' : 'Course added')
    onClose()
  }

  return (
    <Modal title={course ? 'Edit course' : 'New course'} onClose={onClose} footer={
      <><span className="spacer" /><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={save}>Save</button></>
    }>
      <form className="form" onSubmit={(e) => { e.preventDefault(); save() }}>
        <div className="field-row">
          <label className="field field-sm"><span>Code</span><input value={code} onChange={(e) => setCode(e.target.value)} placeholder="CST8912" autoFocus /></label>
          <label className="field"><span>Name</span><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Cloud Solutions Architecture" /></label>
        </div>
        {error && <small className="error">{error}</small>}
        <div className="field-row">
          <label className="field"><span>Instructor <em>(optional)</em></span><input value={instructor} onChange={(e) => setInstructor(e.target.value)} /></label>
          <label className="field"><span>Term <em>(optional)</em></span><input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Fall 2026" /></label>
        </div>
        <div className="field">
          <span>Colour</span>
          <div className="swatches">
            {COURSE_COLORS.map((c) => (
              <button type="button" key={c} className={`swatch chip-${c} ${(color || course?.color) === c ? 'selected' : ''}`}
                onClick={() => setColor(c)} aria-label={c} title={c} />
            ))}
          </div>
        </div>
        <button type="submit" hidden />
      </form>
    </Modal>
  )
}
