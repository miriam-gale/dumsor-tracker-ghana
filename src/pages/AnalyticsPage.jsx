import { useMemo } from 'react'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import {
  TrendingUp, BarChart3, Activity, ShieldAlert, AlertTriangle,
  Zap, CheckCircle, MapPin, PieChart as PieIcon,
} from 'lucide-react'
const SEV_COLORS = {
  critical: '#EF4444',
  high:     '#F97316',
  medium:   '#FFB000',
  low:      '#3B82F6',
}

const REGION_PALETTE = [
  '#FFB000', '#22C55E', '#3B82F6', '#EF4444', '#8B5CF6',
  '#06B6D4', '#F97316', '#84CC16', '#EC4899', '#6366F1',
  '#14B8A6', '#A855F7', '#F43F5E', '#0EA5E9', '#FFD55A', '#10B981',
]

/* ── helpers ── */
function shortRegion(r) {
  return r
    .replace('Greater Accra', 'Gr. Accra')
    .replace('Western North', 'W. North')
    .replace('North East',    'N. East')
    .replace('Upper East',    'U. East')
    .replace('Upper West',    'U. West')
    .replace('Bono East',     'Bono E.')
}

function last14Days() {
  const today = new Date()
  return Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today)
    d.setDate(d.getDate() - (13 - i))
    return d.toISOString().split('T')[0]
  })
}

function fmtDate(iso) {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-GH', { month: 'short', day: 'numeric' })
}

/* ── shared chart components ── */
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div
      className="px-3.5 py-2.5 rounded-xl text-xs border"
      style={{
        background: 'var(--bg-card)',
        borderColor: 'var(--border)',
        boxShadow: 'var(--shadow-lg)',
      }}
    >
      {label && (
        <p className="mb-1.5 font-semibold" style={{ color: 'var(--text-2)' }}>{label}</p>
      )}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 py-0.5">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color || p.fill }} />
          <span style={{ color: 'var(--text-3)' }}>{p.name}:</span>
          <span className="font-bold" style={{ color: 'var(--text-1)' }}>{p.value}</span>
        </div>
      ))}
    </div>
  )
}

function ChartCard({ title, subtitle, icon: Icon, accentColor = '#FFB000', children, fullWidth = false }) {
  return (
    <div
      className={`rounded-2xl border overflow-hidden ${fullWidth ? 'col-span-full' : ''}`}
      style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', boxShadow: 'var(--shadow-card)' }}
    >
      <div className="flex items-center gap-3 px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: `${accentColor}15`, border: `1px solid ${accentColor}25` }}
        >
          <Icon className="w-4 h-4" style={{ color: accentColor }} />
        </div>
        <div>
          <h3 className="font-bold text-sm leading-none mb-0.5" style={{ color: 'var(--text-1)' }}>{title}</h3>
          <p className="text-xs" style={{ color: 'var(--text-3)' }}>{subtitle}</p>
        </div>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

function EmptyChart({ height = 220, message = 'Add reports to see this chart' }) {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-xl border border-dashed"
      style={{ height, background: 'var(--overlay-xs)', borderColor: 'var(--border)' }}
    >
      <div className="w-8 h-8 rounded-lg mb-3 flex items-center justify-center" style={{ background: 'var(--overlay-md)' }}>
        <BarChart3 className="w-4 h-4" style={{ color: 'var(--text-3)' }} />
      </div>
      <p className="text-sm font-medium" style={{ color: 'var(--text-3)' }}>No data yet</p>
      <p className="text-xs mt-1" style={{ color: 'var(--text-3)', opacity: 0.7 }}>{message}</p>
    </div>
  )
}

function KpiCard({ label, value, sub, color, icon: Icon, pulse = false }) {
  return (
    <div
      className="rounded-2xl border px-5 py-4 card-hover transition-all"
      style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', boxShadow: 'var(--shadow-card)' }}
    >
      <div className="flex items-start justify-between mb-3">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: `${color}14`, border: `1px solid ${color}22` }}
        >
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
        {pulse && (
          <span className="w-2 h-2 rounded-full bg-red-500 status-live mt-1" />
        )}
      </div>
      <div className="stat-number text-2xl font-extrabold mb-0.5 leading-none" style={{ color }}>{value}</div>
      <div className="text-xs font-medium" style={{ color: 'var(--text-3)' }}>{label}</div>
      {sub && <div className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-3)', opacity: 0.7 }}>{sub}</div>}
    </div>
  )
}

/* ── main component ── */
export default function AnalyticsPage({ outages = [], stats = {}, openModal }) {
  const hasData = outages.length > 0

  /* Most affected region */
  const mostAffectedRegion = useMemo(() => {
    const counts = outages.reduce((acc, o) => {
      acc[o.region] = (acc[o.region] || 0) + 1
      return acc
    }, {})
    const entries = Object.entries(counts)
    if (!entries.length) return null
    const [region, count] = entries.sort((a, b) => b[1] - a[1])[0]
    return { region, count }
  }, [outages])

  /* Severity distribution */
  const severityData = useMemo(() => [
    { name: 'Critical', key: 'critical', value: outages.filter(o => o.severity === 'critical').length, fill: SEV_COLORS.critical },
    { name: 'High',     key: 'high',     value: outages.filter(o => o.severity === 'high').length,     fill: SEV_COLORS.high },
    { name: 'Medium',   key: 'medium',   value: outages.filter(o => o.severity === 'medium').length,   fill: SEV_COLORS.medium },
    { name: 'Low',      key: 'low',      value: outages.filter(o => o.severity === 'low').length,      fill: SEV_COLORS.low },
  ].filter(d => d.value > 0), [outages])

  const sevTotal = severityData.reduce((s, d) => s + d.value, 0) || 1

  /* Daily trend — last 14 days by outage start date */
  const dailyTrendData = useMemo(() => {
    const days = last14Days()
    const byDate = outages.reduce((acc, o) => {
      const key = (o.startedAt || o.timestamp || '').split('T')[0]
      if (!acc[key]) acc[key] = { reports: 0, resolved: 0 }
      acc[key].reports++
      if (o.status === 'resolved') acc[key].resolved++
      return acc
    }, {})
    return days.map(iso => ({
      date: fmtDate(iso),
      reports:  byDate[iso]?.reports  ?? 0,
      resolved: byDate[iso]?.resolved ?? 0,
    }))
  }, [outages])

  const hasTrendData = dailyTrendData.some(d => d.reports > 0)

  /* Regional breakdown */
  const regionalData = useMemo(() =>
    Object.entries(
      outages.reduce((acc, o) => { acc[o.region] = (acc[o.region] || 0) + 1; return acc }, {})
    )
      .sort((a, b) => b[1] - a[1])
      .map(([region, value]) => ({ region: shortRegion(region), full: region, value })),
  [outages])

  /* Status breakdown */
  const statusData = useMemo(() => [
    { name: 'Active',    value: stats.active    || 0, fill: '#EF4444' },
    { name: 'Resolved',  value: stats.resolved  || 0, fill: '#22C55E' },
    { name: 'Scheduled', value: stats.scheduled || 0, fill: '#3B82F6' },
  ].filter(d => d.value > 0), [stats])

  const resolutionRate = stats.total > 0
    ? Math.round((stats.resolved / stats.total) * 100)
    : 0

  const uniqueRegions = new Set(outages.map(o => o.region)).size

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 min-h-full">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: 'var(--text-1)' }}>Analytics</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-3)' }}>
            {hasData
              ? `Live insights from ${outages.length} report${outages.length !== 1 ? 's' : ''} across ${uniqueRegions} region${uniqueRegions !== 1 ? 's' : ''}`
              : 'Submit outage reports to populate charts and insights'}
          </p>
        </div>
        {hasData && (
          <div
            className="self-start flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border"
            style={{ background: 'rgba(34,197,94,0.08)', borderColor: 'rgba(34,197,94,0.2)', color: '#22C55E' }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Live data
          </div>
        )}
      </div>

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
        <KpiCard
          label="Total Reports"
          value={stats.total ?? 0}
          color="#FFB000"
          icon={Zap}
        />
        <KpiCard
          label="Active Outages"
          value={stats.active ?? 0}
          color="#EF4444"
          icon={AlertTriangle}
          pulse={(stats.active ?? 0) > 0}
        />
        <KpiCard
          label="Resolved"
          value={stats.resolved ?? 0}
          color="#22C55E"
          icon={CheckCircle}
        />
        <KpiCard
          label="Most Affected"
          value={mostAffectedRegion ? mostAffectedRegion.count : 0}
          sub={mostAffectedRegion ? mostAffectedRegion.region : 'No data yet'}
          color="#3B82F6"
          icon={MapPin}
        />
        <KpiCard
          label="Resolution Rate"
          value={`${resolutionRate}%`}
          sub={`${stats.resolved ?? 0} of ${stats.total ?? 0} closed`}
          color="#8B5CF6"
          icon={Activity}
        />
      </div>

      {/* ── Empty state ── */}
      {!hasData && (
        <div
          className="flex flex-col items-center justify-center py-24 rounded-2xl border border-dashed"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border-strong)' }}
        >
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center mb-5 border"
            style={{ background: 'rgba(255,176,0,0.08)', borderColor: 'rgba(255,176,0,0.15)' }}
          >
            <BarChart3 className="w-10 h-10" style={{ color: '#FFB000', opacity: 0.6 }} />
          </div>
          <h3 className="font-bold text-lg mb-2" style={{ color: 'var(--text-1)' }}>Charts will appear here</h3>
          <p className="text-sm mb-6 max-w-xs text-center" style={{ color: 'var(--text-2)' }}>
            Analytics populate automatically as outage reports are submitted across Ghana's 16 regions.
          </p>
          <button
            type="button"
            onClick={() => openModal?.()}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-[#0F172A] transition-all hover:-translate-y-0.5"
            style={{ background: 'linear-gradient(135deg, #FFB000 0%, #D99600 100%)', boxShadow: '0 4px 20px rgba(255,176,0,0.3)' }}
          >
            <AlertTriangle size={14} />
            Report an Outage
          </button>
        </div>
      )}

      {/* ── Charts ── */}
      {hasData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* 1. Daily outage trend — full width */}
          <div className="lg:col-span-2">
            <ChartCard
              title="Daily Outage Trend"
              subtitle="Reports and resolutions over the last 14 days"
              icon={TrendingUp}
              accentColor="#FFB000"
            >
              {!hasTrendData ? <EmptyChart height={240} message="Reports will appear as outages are submitted" /> : (
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={dailyTrendData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradReports" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#FFB000" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#FFB000" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradResolved" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#22C55E" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#22C55E" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--chart-grid)" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11, fill: 'var(--text-3)' }}
                      axisLine={false}
                      tickLine={false}
                      interval={1}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: 'var(--text-3)' }}
                      axisLine={false}
                      tickLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="reports"
                      name="Reports"
                      stroke="#FFB000"
                      strokeWidth={2}
                      fill="url(#gradReports)"
                      dot={false}
                      activeDot={{ r: 4, fill: '#FFB000', strokeWidth: 0 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="resolved"
                      name="Resolved"
                      stroke="#22C55E"
                      strokeWidth={2}
                      fill="url(#gradResolved)"
                      dot={false}
                      activeDot={{ r: 4, fill: '#22C55E', strokeWidth: 0 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
              {hasTrendData && (
                <div className="flex items-center gap-5 mt-3 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-3)' }}>
                    <span className="w-3 h-0.5 rounded-full inline-block" style={{ background: '#FFB000' }} />
                    Reports
                  </div>
                  <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-3)' }}>
                    <span className="w-3 h-0.5 rounded-full inline-block" style={{ background: '#22C55E' }} />
                    Resolved
                  </div>
                </div>
              )}
            </ChartCard>
          </div>

          {/* 2. Severity distribution */}
          <ChartCard
            title="Severity Distribution"
            subtitle="Breakdown of all reports by severity level"
            icon={ShieldAlert}
            accentColor="#EF4444"
          >
            {severityData.length === 0 ? <EmptyChart /> : (
              <div className="flex items-center gap-5">
                <div className="flex-shrink-0" style={{ width: 160, height: 200 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={severityData}
                        cx="50%"
                        cy="50%"
                        innerRadius={52}
                        outerRadius={75}
                        paddingAngle={3}
                        dataKey="value"
                        startAngle={90}
                        endAngle={-270}
                      >
                        {severityData.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} stroke="transparent" />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-3 min-w-0">
                  {severityData.map(({ name, value, fill }) => (
                    <div key={name}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: fill }} />
                          <span className="text-xs font-medium" style={{ color: 'var(--text-2)' }}>{name}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold" style={{ color: 'var(--text-1)' }}>{value}</span>
                          <span className="text-xs" style={{ color: 'var(--text-3)' }}>
                            {Math.round((value / sevTotal) * 100)}%
                          </span>
                        </div>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--overlay-md)' }}>
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${(value / sevTotal) * 100}%`, background: fill }}
                        />
                      </div>
                    </div>
                  ))}
                  <div className="pt-2 border-t text-xs" style={{ borderColor: 'var(--border)', color: 'var(--text-3)' }}>
                    {outages.length} total report{outages.length !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>
            )}
          </ChartCard>

          {/* 3. Status breakdown */}
          <ChartCard
            title="Status Breakdown"
            subtitle="Current state of all submitted reports"
            icon={Activity}
            accentColor="#8B5CF6"
          >
            {statusData.length === 0 ? <EmptyChart /> : (
              <div className="space-y-4">
                {statusData.map(({ name, value, fill }) => {
                  const pct = Math.round((value / (stats.total || 1)) * 100)
                  return (
                    <div key={name}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ background: fill }} />
                          <span className="text-sm font-medium" style={{ color: 'var(--text-2)' }}>{name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold" style={{ color: 'var(--text-1)' }}>{value}</span>
                          <span className="text-xs w-8 text-right tabular-nums" style={{ color: 'var(--text-3)' }}>{pct}%</span>
                        </div>
                      </div>
                      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--overlay-md)' }}>
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${pct}%`, background: fill }}
                        />
                      </div>
                    </div>
                  )
                })}
                <div
                  className="pt-3 border-t flex items-center justify-between text-xs"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-3)' }}
                >
                  <span>
                    Total: <span className="font-bold" style={{ color: 'var(--text-2)' }}>{stats.total ?? 0}</span>
                  </span>
                  <span>
                    Resolution rate:{' '}
                    <span className="font-bold" style={{ color: '#22C55E' }}>{resolutionRate}%</span>
                  </span>
                </div>
              </div>
            )}
          </ChartCard>

          {/* 4. Reports by region — full width */}
          <div className="lg:col-span-2">
            <ChartCard
              title="Most Affected Regions"
              subtitle="Total reports per region, sorted by impact"
              icon={PieIcon}
              accentColor="#3B82F6"
            >
              {regionalData.length === 0 ? <EmptyChart height={200} message="Reports will appear here grouped by region" /> : (
                <ResponsiveContainer
                  width="100%"
                  height={Math.max(180, regionalData.length * 38)}
                >
                  <BarChart
                    data={regionalData}
                    layout="vertical"
                    margin={{ top: 0, right: 48, left: 0, bottom: 0 }}
                    barCategoryGap="25%"
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--chart-grid)" />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 11, fill: 'var(--text-3)' }}
                      axisLine={false}
                      tickLine={false}
                      allowDecimals={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="region"
                      tick={{ fontSize: 11, fill: 'var(--text-3)' }}
                      axisLine={false}
                      tickLine={false}
                      width={72}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="value" name="Reports" radius={[0, 4, 4, 0]}>
                      {regionalData.map((_, i) => (
                        <Cell key={i} fill={REGION_PALETTE[i % REGION_PALETTE.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>

        </div>
      )}

      {/* ── Insight summary ── */}
      {hasData && (
        <div
          className="rounded-2xl border p-5 sm:p-6"
          style={{ background: 'rgba(255,176,0,0.04)', borderColor: 'rgba(255,176,0,0.14)' }}
        >
          <h3 className="font-bold text-sm flex items-center gap-2 mb-2" style={{ color: 'var(--text-1)' }}>
            <TrendingUp className="w-4 h-4" style={{ color: '#FFB000' }} />
            Summary Insight
          </h3>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-2)' }}>
            <span className="font-semibold" style={{ color: 'var(--text-1)' }}>{outages.length}</span>{' '}
            outage report{outages.length !== 1 ? 's' : ''} submitted across{' '}
            <span className="font-semibold" style={{ color: 'var(--text-1)' }}>{uniqueRegions}</span>{' '}
            region{uniqueRegions !== 1 ? 's' : ''}.{' '}
            {(stats.active ?? 0) > 0
              ? <><span className="font-semibold" style={{ color: '#EF4444' }}>{stats.active}</span> currently active. </>
              : 'No active outages. '}
            {(stats.critical ?? 0) > 0 && (
              <><span className="font-semibold" style={{ color: '#EF4444' }}>{stats.critical}</span> critical {stats.critical === 1 ? 'incident requires' : 'incidents require'} urgent attention. </>
            )}
            {mostAffectedRegion && (
              <>Most impacted: <span className="font-semibold" style={{ color: '#3B82F6' }}>{mostAffectedRegion.region}</span> with {mostAffectedRegion.count} report{mostAffectedRegion.count !== 1 ? 's' : ''}. </>
            )}
            Resolution rate:{' '}
            <span className="font-semibold" style={{ color: '#22C55E' }}>{resolutionRate}%</span>.
          </p>
        </div>
      )}

    </div>
  )
}
