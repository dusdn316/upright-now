import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

export interface Toast {
  id: number
  title: string
  description?: string
  tone: 'success' | 'info' | 'warning'
}

interface ToastContextValue {
  toasts: Toast[]
  push: (toast: Omit<Toast, 'id'>) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const seq = useRef(0)

  const push = useCallback((toast: Omit<Toast, 'id'>) => {
    seq.current += 1
    const id = seq.current
    setToasts((prev) => [...prev, { ...toast, id }])
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 3200)
  }, [])

  const value = useMemo(() => ({ toasts, push }), [toasts, push])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} />
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx
}

const TONE_CLASS: Record<Toast['tone'], string> = {
  success: 'border-pink bg-pink-soft',
  info: 'border-blue bg-blue-soft',
  warning: 'border-line bg-yellow-soft',
}

function ToastViewport({ toasts }: { toasts: Toast[] }) {
  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed bottom-6 left-1/2 z-50 flex w-[min(420px,90vw)] -translate-x-1/2 flex-col gap-2"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`anim-toast-in rounded-2xl border px-4 py-3 shadow-card ${TONE_CLASS[toast.tone]}`}
        >
          <p className="text-sm font-bold text-ink">{toast.title}</p>
          {toast.description && (
            <p className="mt-0.5 text-xs text-ink-soft">{toast.description}</p>
          )}
        </div>
      ))}
    </div>
  )
}
