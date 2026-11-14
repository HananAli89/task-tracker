import { NavLink, Outlet } from 'react-router-dom'
import { Icon, type IconName } from './Icon'
import { useTaskEditor } from './TaskEditor'

const NAV: { to: string; label: string; icon: IconName; mobile?: boolean }[] = [
  { to: '/', label: 'Dashboard', icon: 'home', mobile: true },
  { to: '/tasks', label: 'Tasks', icon: 'list', mobile: true },
  { to: '/calendar', label: 'Calendar', icon: 'calendar', mobile: true },
  { to: '/courses', label: 'Courses', icon: 'book', mobile: true },
  { to: '/completed', label: 'Completed', icon: 'checkCircle' },
  { to: '/import', label: 'Import', icon: 'upload' },
  { to: '/settings', label: 'Settings', icon: 'settings' },
]

export function Layout() {
  const { newTask } = useTaskEditor()
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark"><Icon name="check" size={16} /></span> Task Tracker</div>
        <button className="btn btn-primary add-btn" onClick={() => newTask()}><Icon name="plus" size={16} /> Add task</button>
        <nav>
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'} className="nav-link">
              <Icon name={n.icon} /> {n.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="main"><Outlet /></main>

      <button className="fab" onClick={() => newTask()} aria-label="Add task"><Icon name="plus" size={24} /></button>
      <nav className="bottom-nav">
        {NAV.filter((n) => n.mobile).map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === '/'} className="bottom-link">
            <Icon name={n.icon} size={20} /><span>{n.label}</span>
          </NavLink>
        ))}
        <NavLink to="/more" className="bottom-link"><Icon name="more" size={20} /><span>More</span></NavLink>
      </nav>
    </div>
  )
}

export function MorePage() {
  return (
    <div className="page">
      <header className="page-head"><h1>More</h1></header>
      <div className="card more-list">
        {NAV.filter((n) => !n.mobile).map((n) => (
          <NavLink key={n.to} to={n.to} className="more-link"><Icon name={n.icon} /> {n.label} <span className="spacer" /><Icon name="right" size={16} /></NavLink>
        ))}
      </div>
    </div>
  )
}
