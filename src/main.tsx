import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'

// Ask the browser to keep our IndexedDB data even when storage runs low.
navigator.storage?.persist?.().catch(() => {})

// Service worker: makes the app work offline and installable. Updates apply automatically.
registerSW({ immediate: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
