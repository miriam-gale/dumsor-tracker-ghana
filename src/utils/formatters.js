export function timeAgo(isoString) {
  const now = Date.now()
  const then = new Date(isoString).getTime()
  const diff = Math.floor((now - then) / 1000)

  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export function formatDate(isoString) {
  return new Date(isoString).toLocaleDateString('en-GH', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export function severityColor(severity) {
  switch (severity) {
    case 'critical': return {
      bg: 'bg-red-500/15',
      text: 'text-red-400',
      dot: 'bg-red-500',
      border: 'border-red-500/30',
    }
    case 'high': return {
      bg: 'bg-orange-500/15',
      text: 'text-orange-400',
      dot: 'bg-orange-500',
      border: 'border-orange-500/30',
    }
    case 'medium': return {
      bg: 'bg-amber-500/15',
      text: 'text-amber-400',
      dot: 'bg-amber-400',
      border: 'border-amber-500/30',
    }
    case 'low': return {
      bg: 'bg-blue-500/15',
      text: 'text-blue-400',
      dot: 'bg-blue-500',
      border: 'border-blue-500/30',
    }
    default: return {
      bg: 'bg-white/8',
      text: 'text-gray-400',
      dot: 'bg-gray-500',
      border: 'border-white/10',
    }
  }
}

export function statusColor(status) {
  switch (status) {
    case 'active': return {
      bg: 'bg-red-500/15',
      text: 'text-red-400',
      dot: 'bg-red-500',
      border: 'border-red-500/30',
    }
    case 'resolved': return {
      bg: 'bg-emerald-500/15',
      text: 'text-emerald-400',
      dot: 'bg-emerald-500',
      border: 'border-emerald-500/30',
    }
    case 'scheduled': return {
      bg: 'bg-blue-500/15',
      text: 'text-blue-400',
      dot: 'bg-blue-500',
      border: 'border-blue-500/30',
    }
    default: return {
      bg: 'bg-white/8',
      text: 'text-gray-400',
      dot: 'bg-gray-500',
      border: 'border-white/10',
    }
  }
}
