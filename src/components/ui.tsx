// Shared UI building blocks: modal, confirm dialog, toasts.
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { Icon } from './Icon'

// ---------- Modal ----------

export function Modal({ title, onClose, children, footer, wide }: {
  title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    ref.current?.querySelector<HTMLElement>('input, select, textarea, button')?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  )
}

// ---------- Confirm dialog & toasts (available anywhere through useUI) ----------

interface ConfirmOptions { title: string; message: ReactNode; confirmLabel?: string; danger?: boolean; choices?: { label: string; value: string; danger?: boolean }[] }
interface Toast { id: number; text: string; action?: { label: string; run: () => void } }

const UIContext = createContext<{
  confirm: (o: ConfirmOptions) => Promise<string | null>
  toast: (text: string, action?: Toast['action']) => void
} | null>(null)

export function useUI() {
  const ctx = useContext(UIContext)
  if (!ctx) throw new Error('useUI must be inside UIProvider')
  return ctx
}

export function UIProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<(ConfirmOptions & { resolve: (v: string | null) => void }) | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])

  // Resolves to the chosen value ("yes" for a simple confirm) or null when cancelled.
  const confirm = useCallback((o: ConfirmOptions) => new Promise<string | null>((resolve) => setDialog({ ...o, resolve })), [])

  const toast = useCallback((text: string, action?: Toast['action']) => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t.slice(-2), { id, text, action }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000)
  }, [])

  const close = (v: string | null) => { dialog?.resolve(v); setDialog(null) }

  return (
    <UIContext.Provider value={{ confirm, toast }}>
      {children}
      {dialog && (
        <Modal title={dialog.title} onClose={() => close(null)} footer={
          <>
            <button className="btn" onClick={() => close(null)}>Cancel</button>
            {(dialog.choices ?? [{ label: dialog.confirmLabel ?? 'Confirm', value: 'yes', danger: dialog.danger }]).map((c) => (
              <button key={c.value} className={`btn ${c.danger ? 'btn-danger' : 'btn-primary'}`} onClick={() => close(c.value)}>{c.label}</button>
            ))}
          </>
        }>
          <div className="confirm-text">{dialog.message}</div>
        </Modal>
      )}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="toast">
            <span>{t.text}</span>
            {t.action && (
              <button className="toast-action" onClick={() => { t.action!.run(); setToasts((x) => x.filter((y) => y.id !== t.id)) }}>
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </UIContext.Provider>
  )
}

export function EmptyState({ title, text, children }: { title: string; text?: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {children && <div className="empty-actions">{children}</div>}
    </div>
  )
}
