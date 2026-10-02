import { severityColor } from '../../utils/formatters'

export function SeverityBadge({ severity }) {
  const c = severityColor(severity)
  const label = severity.charAt(0).toUpperCase() + severity.slice(1)
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold tracking-wide border ${c.bg} ${c.text} ${c.border}`}>
      {label}
    </span>
  )
}
