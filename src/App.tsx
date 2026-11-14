import { useEffect } from 'react'
import { HashRouter, Route, Routes } from 'react-router-dom'
import { useSettings } from './lib/settings'
import { UIProvider } from './components/ui'
import { TaskEditorProvider } from './components/TaskEditor'
import { Layout, MorePage } from './components/Layout'
import { Dashboard } from './pages/Dashboard'
import { TasksPage } from './pages/Tasks'
import { CalendarPage } from './pages/Calendar'
import { CourseDetail, CoursesPage } from './pages/Courses'
import { CompletedPage } from './pages/Completed'
import { ImportPage } from './pages/Import'
import { SettingsPage } from './pages/Settings'

function useTheme() {
  const { theme } = useSettings()
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && media.matches)
      document.documentElement.dataset.theme = dark ? 'dark' : 'light'
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#191919' : '#fbfbfa')
    }
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [theme])
}

export default function App() {
  useTheme()
  // HashRouter keeps links working on GitHub Pages (no server-side routing needed).
  return (
    <HashRouter>
      <UIProvider>
        <TaskEditorProvider>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="tasks" element={<TasksPage />} />
              <Route path="calendar" element={<CalendarPage />} />
              <Route path="courses" element={<CoursesPage />} />
              <Route path="courses/:id" element={<CourseDetail />} />
              <Route path="completed" element={<CompletedPage />} />
              <Route path="import" element={<ImportPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="more" element={<MorePage />} />
              <Route path="*" element={<Dashboard />} />
            </Route>
          </Routes>
        </TaskEditorProvider>
      </UIProvider>
    </HashRouter>
  )
}
