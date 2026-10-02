import { TrendingUp, TrendingDown } from 'lucide-react'

export function StatCard({ title, value, icon: Icon, accentColor = '#FFB000', subtitle, trend, pulse }) {
  const hasTrend = trend !== undefined && trend !== null
  const isUp = trend > 0

  return (
    <div
      className="card-hover relative rounded-2xl p-5 overflow-hidden group border"
      style={{
        background: 'var(--bg-card)',
        borderColor: 'var(--border)',
        boxShadow: 'var(--shadow-card)',
        transition: 'background-color 0.25s ease, border-color 0.25s ease',
      }}
    >
      {/* Top accent line */}
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent 0%, ${accentColor} 50%, transparent 100%)` }}
      />

      {/* Hover glow */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{ background: `radial-gradient(ellipse at top left, ${accentColor}10 0%, transparent 65%)` }}
      />

      <div className="relative">
        <div className="flex items-start justify-between mb-4">
          <div
            className="p-2.5 rounded-xl border"
            style={{
              background: `${accentColor}15`,
              borderColor: `${accentColor}28`,
            }}
          >
            <Icon className="w-5 h-5" style={{ color: accentColor }} />
          </div>

          {hasTrend && (
            <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold border ${
              isUp
                ? 'bg-red-500/10 text-red-500 border-red-500/20'
                : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
            }`}>
              {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {Math.abs(trend)}%
            </div>
          )}
        </div>

        <div
          className="stat-number text-3xl font-extrabold leading-none mb-1.5 flex items-center gap-2"
          style={{ color: 'var(--text-1)' }}
        >
          {value}
          {pulse && (
            <span className="inline-block w-2 h-2 rounded-full bg-red-500 status-live flex-shrink-0" />
          )}
        </div>

        <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>
          {title}
        </div>
        {subtitle && (
          <div className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{subtitle}</div>
        )}
      </div>
    </div>
  )
}
