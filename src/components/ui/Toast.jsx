import { useEffect } from 'react'
import { CheckCircle, X } from 'lucide-react'

export function Toast({ visible, title, body, onClose }) {
  useEffect(() => {
    if (!visible) return
    const timer = setTimeout(onClose, 4000)
    return () => clearTimeout(timer)
  }, [visible, onClose])

  return (
    <div
      className="fixed bottom-6 right-6 z-[60] flex items-center gap-3 px-4 py-3.5 rounded-2xl border"
      style={{
        background: 'rgba(15,23,42,0.92)',
        borderColor: 'rgba(34,197,94,0.35)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(34,197,94,0.1)',
        transform: visible ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.95)',
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? 'auto' : 'none',
        transition: 'transform 0.25s cubic-bezier(0.34,1.56,0.64,1), opacity 0.2s ease',
        minWidth: '280px',
        maxWidth: '360px',
      }}
    >
      <div
        className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.25)' }}
      >
        <CheckCircle className="w-4 h-4" style={{ color: '#22C55E' }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold" style={{ color: '#22C55E' }}>{title}</p>
        {body && <p className="text-xs mt-0.5 leading-snug" style={{ color: 'var(--text-3)' }}>{body}</p>}
      </div>
      <button
        onClick={onClose}
        className="p-1 rounded-lg transition-opacity hover:opacity-60 flex-shrink-0"
        style={{ color: 'var(--text-3)' }}
        aria-label="Dismiss"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
