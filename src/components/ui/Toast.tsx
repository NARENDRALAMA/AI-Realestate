import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'
import { ToastContext, type ToastTone } from '../../context/toast-context'
import './toast.css'

interface ToastItem {
  id: number
  message: string
  tone: ToastTone
}

const icons = { success: CheckCircle2, error: AlertCircle, info: Info }

/**
 * Provides `useToast().show()`. The live region is always mounted so screen readers
 * reliably announce new messages.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(0)

  const dismiss = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id))
  }, [])

  const show = useCallback(
    (message: string, tone: ToastTone = 'success') => {
      const id = ++nextId.current
      setToasts((t) => [...t.slice(-2), { id, message, tone }])
      window.setTimeout(() => dismiss(id), tone === 'error' ? 6000 : 3500)
    },
    [dismiss],
  )

  const api = useMemo(() => ({ show }), [show])

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-region" role="status" aria-live="polite" aria-relevant="additions">
        {toasts.map((t) => {
          const Icon = icons[t.tone]
          return (
            <div key={t.id} className={`toast toast--${t.tone}`}>
              <Icon className="toast__icon" aria-hidden />
              <p className="toast__message">{t.message}</p>
              <button
                type="button"
                className="toast__close"
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss notification"
              >
                <X aria-hidden />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}
