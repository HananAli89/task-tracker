import { useSyncExternalStore } from 'react'
import type { DateFormat } from './dates'

// Lightweight preferences, kept in localStorage.
export interface Settings {
  theme: 'system' | 'light' | 'dark'
  dateFormat: DateFormat
  weekStart: 0 | 1                 // 0 = Sunday, 1 = Monday
  week1Start: string               // last "Week 1 start" used in PDF import
  defaultDueDay: number            // 0-6, for undated outline items (6 = Saturday)
  defaultDueTime: string           // HH:MM
}

const KEY = 'tt-settings'
const DEFAULTS: Settings = {
  theme: 'system',
  dateFormat: 'YYYY-MM-DD',
  weekStart: 0,
  week1Start: '',
  defaultDueDay: 6,
  defaultDueTime: '23:59',
}

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS
  } catch {
    return DEFAULTS
  }
}

let current = load()
const listeners = new Set<() => void>()

export function getSettings(): Settings {
  return current
}

export function updateSettings(patch: Partial<Settings>) {
  current = { ...current, ...patch }
  try { localStorage.setItem(KEY, JSON.stringify(current)) } catch { /* storage unavailable */ }
  listeners.forEach((l) => l())
}

export function useSettings(): Settings {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb) },
    () => current,
  )
}
