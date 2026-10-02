import { statusColor } from '../../utils/formatters'

export function StatusBadge({ status }) {
  const c = statusColor(status)
  const label = status.charAt(0).toUpperCase() + status.slice(1)
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${c.bg} ${c.text} ${c.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${c.dot} ${status === 'active' ? 'status-live' : ''}`} />
      {label}
    </span>
  )
}
