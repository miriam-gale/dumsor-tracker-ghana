import {
  Zap, AlertTriangle, CheckCircle, Globe, ShieldAlert,
  Map, ArrowRight, Clock, Home, Users
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { StatCard } from '../components/ui/StatCard'
import { StatusBadge } from '../components/ui/StatusBadge'
import { SeverityBadge } from '../components/ui/SeverityBadge'
import { timeAgo } from '../utils/formatters'

const SEV_COLOR = { critical: '#EF4444', high: '#F97316', medium: '#FFB000', low: '#3B82F6' }

export default function Dashboard({ outages, stats, openModal }) {
  const recent = outages.slice(0, 8)
  const affectedHomes = outages
    .filter(o => o.status === 'active')
    .reduce((s, o) => s + (o.affectedHomes || 0), 0)

  const cards = [
    { title: 'Total Reports',    value: stats.total,                 icon: Zap,        accentColor: '#FFB000', subtitle: 'All time' },
    { title: 'Active Outages',   value: stats.active,                icon: AlertTriangle, accentColor: '#EF4444', subtitle: 'Currently ongoing', pulse: stats.active > 0 },
    { title: 'Resolved',         value: stats.resolved,              icon: CheckCircle,   accentColor: '#22C55E', subtitle: 'Successfully closed' },
    { title: 'Critical',         value: stats.critical,              icon: ShieldAlert,   accentColor: '#DC2626', subtitle: 'Urgent attention' },
    { title: 'Regions Affected', value: `${stats.regionsAffected ?? 0}/16`, icon: Globe, accentColor: '#8B5CF6', subtitle: 'of 16 regions' },
  ]

  const activeByRegion = Object.entries(
    outages
      .filter(o => o.status === 'active')
      .reduce((acc, o) => { acc[o.region] = (acc[o.region] || 0) + 1; return acc }, {})
  ).sort((a, b) => b[1] - a[1]).slice(0, 8)

  const maxRegionCount = activeByRegion[0]?.[1] || 1

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 min-h-full">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: 'var(--text-1)' }}>Dashboard</h1>
          <p className="text-sm mt-1 flex items-center gap-2" style={{ color: 'var(--text-3)' }}>
            <span className="w-1.5 h-1.5 bg-red-500 rounded-full status-live inline-block flex-shrink-0" />
            Real-time power outage overview · Ghana
          </p>
        </div>
        <button
          type="button"
          onClick={() => openModal?.()}
          className="self-start sm:self-auto inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-[#0F172A] transition-all hover:-translate-y-0.5"
          style={{ background: 'linear-gradient(135deg, #FFB000 0%, #D99600 100%)', boxShadow: '0 4px 20px rgba(255,176,0,0.3)' }}
        >
          <AlertTriangle size={14} />
          Report Outage
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        {cards.map(card => <StatCard key={card.title} {...card} />)}
      </div>

      {/* Affected homes banner */}
      {affectedHomes > 0 && (
        <div
          className="flex items-center gap-4 rounded-2xl px-5 py-4 border"
          style={{ background: 'rgba(255,176,0,0.06)', borderColor: 'rgba(255,176,0,0.15)' }}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(255,176,0,0.12)', border: '1px solid rgba(255,176,0,0.2)' }}
          >
            <Home className="w-5 h-5" style={{ color: '#FFB000' }} />
          </div>
          <div>
            <span className="font-extrabold text-lg stat-number" style={{ color: 'var(--text-1)' }}>
              {affectedHomes.toLocaleString()}
            </span>
            <span className="text-sm ml-2" style={{ color: 'var(--text-2)' }}>
              estimated households currently without power
            </span>
          </div>
          <Link
            to="/map"
            className="ml-auto text-xs font-bold flex items-center gap-1 hover:gap-2 transition-all whitespace-nowrap"
            style={{ color: '#FFB000' }}
          >
            View Map <ArrowRight size={12} />
          </Link>
        </div>
      )}

      {/* Bottom grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

        {/* Recent outages */}
        <div
          className="xl:col-span-2 rounded-2xl border overflow-hidden"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
            <div>
              <h2 className="font-bold text-sm" style={{ color: 'var(--text-1)' }}>Recent Outages</h2>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>Latest reports across all 16 regions</p>
            </div>
            <Link
              to="/feed"
              className="flex items-center gap-1 text-xs font-bold hover:gap-1.5 transition-all"
              style={{ color: '#FFB000' }}
            >
              View all <ArrowRight size={12} />
            </Link>
          </div>

          <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {recent.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-5 text-center">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                  style={{ background: 'rgba(255,176,0,0.08)', border: '1px solid rgba(255,176,0,0.15)' }}
                >
                  <Zap className="w-8 h-8" style={{ color: '#FFB000', opacity: 0.6 }} />
                </div>
                <p className="font-bold text-sm mb-1" style={{ color: 'var(--text-1)' }}>No outage reports yet</p>
                <p className="text-xs mb-5" style={{ color: 'var(--text-3)' }}>Be the first to report an outage in your area.</p>
                <button
                  type="button"
                  onClick={() => openModal?.()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-[#0F172A] transition-all hover:-translate-y-0.5"
                  style={{ background: 'linear-gradient(135deg, #FFB000 0%, #D99600 100%)', boxShadow: '0 4px 16px rgba(255,176,0,0.3)' }}
                >
                  <AlertTriangle size={12} />
                  Report Outage
                </button>
              </div>
            ) : recent.map(outage => (
              <div
                key={outage.id}
                className="flex items-start gap-3 px-5 py-3.5 border-l-2"
                style={{ borderLeftColor: SEV_COLOR[outage.severity] || '#475569' }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-1.5 flex-wrap">
                    <span className="font-bold text-sm" style={{ color: 'var(--text-1)' }}>{outage.town}</span>
                    {outage.area && <span className="text-xs" style={{ color: 'var(--text-3)' }}>· {outage.area}</span>}
                    <span className="text-xs" style={{ color: 'var(--text-3)' }}>· {outage.region}</span>
                  </div>
                  <p className="text-xs mt-0.5 line-clamp-1 leading-relaxed" style={{ color: 'var(--text-2)' }}>
                    {outage.description}
                  </p>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-3)' }}>
                      <Clock size={10} className="flex-shrink-0" />{outage.duration}
                    </span>
                    <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-3)' }}>
                      <Users size={10} className="flex-shrink-0" />{outage.affectedHomes?.toLocaleString()} homes
                    </span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                  <StatusBadge status={outage.status} />
                  <SeverityBadge severity={outage.severity} />
                  <span className="text-[11px]" style={{ color: 'var(--text-3)' }}>{timeAgo(outage.timestamp)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Regional sidebar */}
        <div
          className="rounded-2xl border overflow-hidden flex flex-col"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
        >
          <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
            <h2 className="font-bold text-sm" style={{ color: 'var(--text-1)' }}>Active by Region</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{stats.regionsAffected ?? 0} of 16 regions impacted</p>
          </div>

          <div className="flex-1 px-5 py-4 space-y-4 overflow-y-auto">
            {activeByRegion.length === 0 ? (
              <div className="text-center py-10">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3"
                  style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)' }}
                >
                  <CheckCircle className="w-6 h-6 text-emerald-500" />
                </div>
                <p className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>No active outages</p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>All regions running normally</p>
              </div>
            ) : activeByRegion.map(([region, count]) => {
              const pct = Math.round((count / maxRegionCount) * 100)
              const isCritical = outages.some(o => o.region === region && o.severity === 'critical' && o.status === 'active')
              const barColor = isCritical ? '#EF4444' : '#FFB000'
              return (
                <div key={region}>
                  <div className="flex justify-between items-center text-xs mb-2">
                    <div className="flex items-center gap-1.5">
                      {isCritical && <span className="w-1.5 h-1.5 bg-red-500 rounded-full status-live flex-shrink-0" />}
                      <span className="font-medium truncate max-w-[140px]" style={{ color: 'var(--text-2)' }}>{region}</span>
                    </div>
                    <span className="font-bold tabular-nums" style={{ color: 'var(--text-3)' }}>{count}</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--overlay-md)' }}>
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${pct}%`, background: barColor }}
                    />
                  </div>
                </div>
              )
            })}
          </div>

          <div className="px-5 pb-4 pt-2">
            <Link
              to="/map"
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-bold border transition-all hover:-translate-y-0.5"
              style={{ background: 'rgba(255,176,0,0.08)', borderColor: 'rgba(255,176,0,0.18)', color: '#FFB000' }}
            >
              <Map size={14} />
              View on Map
            </Link>
          </div>
        </div>

      </div>
    </div>
  )
}
