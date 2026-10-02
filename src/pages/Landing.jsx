import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Zap, MapPin, AlertTriangle, CheckCircle, ArrowRight, Activity,
  Shield, Globe, ChevronRight, Sun, Moon, BarChart2, Radio, Wifi,
  Clock, Users,
} from 'lucide-react'
import { timeAgo } from '../utils/formatters'
import { StatusBadge } from '../components/ui/StatusBadge'
import { SeverityBadge } from '../components/ui/SeverityBadge'

const SEV_COLOR = { critical: '#EF4444', high: '#F97316', medium: '#FFB000', low: '#3B82F6' }

const features = [
  { icon: MapPin,      title: 'Live Outage Map',    desc: 'Interactive map with real-time outage pins across all 16 regions, severity color-coding and instant tooltips.', color: '#FFB000' },
  { icon: AlertTriangle, title: 'Instant Reporting', desc: 'Submit a full outage report in under 60 seconds — region, town, severity, description. No account needed.',      color: '#EF4444' },
  { icon: BarChart2,   title: 'Analytics & Trends', desc: 'Visual charts for daily trends, regional breakdowns, severity distribution, and resolution rates.',              color: '#22C55E' },
  { icon: Activity,    title: 'Live Feed',           desc: 'Real-time stream of reports with severity badges, timestamps, affected homes, and status updates.',             color: '#3B82F6' },
  { icon: Shield,      title: 'Severity Tracking',  desc: 'Four-tier system (Low → Critical) helps ECG and communities prioritise emergency response.',                   color: '#8B5CF6' },
  { icon: Globe,       title: 'All 16 Regions',     desc: 'Greater Accra, Ashanti, Volta, Northern, Savannah, Oti, Bono, Ahafo, Western North and 7 more regions.',      color: '#06B6D4' },
]

const howItWorks = [
  { icon: AlertTriangle, color: '#FFB000', title: 'Report',  desc: 'Fill in your region, town, severity and description. Takes under 60 seconds.' },
  { icon: MapPin,        color: '#3B82F6', title: 'Track',   desc: 'Your report appears instantly on the live map and feed, visible to all users.' },
  { icon: CheckCircle,   color: '#22C55E', title: 'Resolve', desc: 'ECG teams and community members update status as power is restored.' },
]

function SectionLabel({ color = '#FFB000', icon: Icon, children }) {
  return (
    <div
      className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold mb-5 border tracking-wide uppercase"
      style={{ background: `${color}10`, borderColor: `${color}28`, color }}
    >
      {Icon && <Icon size={11} />}
      {children}
    </div>
  )
}

function SectionDivider() {
  return (
    <div className="h-px w-full" style={{ background: 'var(--border)' }} />
  )
}

export default function Landing({ dark, setDark, outages = [], stats = {}, openModal }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [feedFilter, setFeedFilter]         = useState('all')

  const activeOutages = outages.filter(o => o.status === 'active').slice(0, 8)

  const filteredRecent = useMemo(() => {
    let r = [...outages]
    if (feedFilter === 'active')   r = r.filter(o => o.status   === 'active')
    if (feedFilter === 'resolved') r = r.filter(o => o.status   === 'resolved')
    if (feedFilter === 'critical') r = r.filter(o => o.severity === 'critical')
    return r.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 6)
  }, [outages, feedFilter])

  const feedCounts = useMemo(() => ({
    all:      outages.length,
    active:   outages.filter(o => o.status   === 'active').length,
    resolved: outages.filter(o => o.status   === 'resolved').length,
    critical: outages.filter(o => o.severity === 'critical').length,
  }), [outages])


  const heroStats = [
    { value: stats.total ?? 0,  label: 'Total Reports',   icon: Activity },
    { value: 16,                 label: 'Regions Covered', icon: Globe },
    { value: stats.active ?? 0, label: 'Active Outages',  icon: AlertTriangle },
    { value: '24/7',             label: 'Live Monitoring', icon: Wifi },
  ]

  return (
    <div style={{ background: 'var(--bg-page)', color: 'var(--text-1)', transition: 'background-color 0.25s ease' }}>

      {/* ═══════════ NAVBAR ═══════════ */}
      <nav
        className="fixed top-0 left-0 right-0 z-50 border-b"
        style={{
          background: 'var(--bg-navbar)',
          borderColor: 'var(--border)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">

            <Link to="/" className="flex items-center gap-2.5 group flex-shrink-0">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110"
                style={{ background: 'linear-gradient(135deg, #FFB000 0%, #D99600 100%)', boxShadow: '0 4px 16px rgba(255,176,0,0.4)' }}
              >
                <Zap className="w-4 h-4 text-white" fill="white" />
              </div>
              <span className="font-extrabold text-sm tracking-tight" style={{ color: 'var(--text-1)' }}>
                Dumsor<span style={{ color: '#FFB000' }}>Tracker</span>
                <span className="font-normal ml-1 text-xs" style={{ color: 'var(--text-3)' }}>GH</span>
              </span>
            </Link>

            <div className="hidden md:flex items-center gap-1">
              {[
                { to: '/dashboard', label: 'Dashboard' },
                { to: '/map',       label: 'Live Map' },
                { to: '/feed',      label: 'Feed' },
                { to: '/analytics', label: 'Analytics' },
              ].map(({ to, label }) => (
                <Link
                  key={to}
                  to={to}
                  className="px-3 py-2 rounded-lg text-sm font-medium transition-all"
                  style={{ color: 'var(--text-2)' }}
                >
                  {label}
                </Link>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setDark(!dark)}
                className="p-2 rounded-lg transition-all"
                style={{ color: 'var(--text-3)' }}
                aria-label="Toggle theme"
              >
                {dark ? <Sun size={16} /> : <Moon size={16} />}
              </button>

              <button
                type="button"
                onClick={() => openModal?.()}
                className="hidden sm:flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-[#0F172A] transition-all hover:-translate-y-0.5"
                style={{ background: 'linear-gradient(135deg, #FFB000 0%, #D99600 100%)', boxShadow: '0 4px 20px rgba(255,176,0,0.35)' }}
              >
                <AlertTriangle size={13} />
                Report Outage
              </button>

              <button
                className="md:hidden p-2 rounded-lg transition-all"
                style={{ color: 'var(--text-2)' }}
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? (
                  <Zap size={18} style={{ color: '#FFB000' }} />
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t px-4 py-3 space-y-1" style={{ background: 'var(--bg-card-alt)', borderColor: 'var(--border)' }}>
            {[
              { to: '/dashboard', label: 'Dashboard' },
              { to: '/map',       label: 'Live Map' },
              { to: '/feed',      label: 'Outage Feed' },
              { to: '/analytics', label: 'Analytics' },
            ].map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
                style={{ color: 'var(--text-1)' }}
              >
                {label}
              </Link>
            ))}
            <button
              type="button"
              onClick={() => { setMobileMenuOpen(false); openModal?.() }}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-bold text-[#0F172A] transition-all mt-1"
              style={{ background: 'linear-gradient(135deg, #FFB000 0%, #D99600 100%)' }}
            >
              <AlertTriangle size={13} />
              Report Outage
            </button>
          </div>
        )}
      </nav>

      {/* ═══════════ HERO SECTION ═══════════ */}
      <section
        className="relative min-h-screen flex items-center pt-16 overflow-hidden"
        style={{ background: 'var(--hero-bg)' }}
      >
        {/* Ambient glows */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[520px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at center top, rgba(255,176,0,0.1) 0%, transparent 65%)' }}
        />
        <div
          className="absolute -bottom-32 -left-32 w-[560px] h-[560px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(34,197,94,0.06) 0%, transparent 70%)' }}
        />
        <div
          className="absolute -bottom-32 -right-32 w-[560px] h-[560px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.05) 0%, transparent 70%)' }}
        />

        {/* Hero content */}
        <div className="relative w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-28 lg:py-36 text-center">

          {/* Live badge */}
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold mb-10 border"
            style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.2)', color: '#F87171' }}
          >
            <span className="w-1.5 h-1.5 bg-red-500 rounded-full status-live flex-shrink-0" />
            LIVE · Outage Monitoring Active
          </div>

          {/* Headline */}
          <h1
            className="text-5xl sm:text-6xl lg:text-[4.25rem] xl:text-[4.75rem] font-extrabold leading-[1.06] tracking-tight mb-7"
            style={{ color: 'var(--text-1)' }}
          >
            Know Where And When
            <br />
            The Lights{' '}
            <span className="gradient-text-gold">Are Off</span>
          </h1>

          {/* Sub-headline */}
          <p className="text-lg sm:text-xl max-w-xl mx-auto mb-12 leading-relaxed" style={{ color: 'var(--text-2)' }}>
            Real-time power outage reporting and tracking across all{' '}
            <span className="font-semibold" style={{ color: 'var(--text-1)' }}>16 regions</span>{' '}
            of Ghana. Community-powered, always on.
          </p>

          {/* CTA buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              type="button"
              onClick={() => openModal?.()}
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl font-bold text-sm text-[#0F172A] transition-all duration-200 hover:-translate-y-1 active:translate-y-0"
              style={{ background: 'linear-gradient(135deg, #FFB000 0%, #D99600 100%)', boxShadow: '0 8px 32px rgba(255,176,0,0.4)' }}
            >
              <AlertTriangle size={15} />
              Report Outage
              <ArrowRight size={13} />
            </button>
            <Link
              to="/map"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl font-bold text-sm transition-all duration-200 hover:-translate-y-1 active:translate-y-0 border"
              style={{
                background: 'var(--overlay-sm)',
                borderColor: 'var(--border-strong)',
                color: 'var(--text-1)',
                backdropFilter: 'blur(12px)',
              }}
            >
              <MapPin size={15} />
              View Live Map
            </Link>
          </div>
        </div>
      </section>

      {/* ═══════════ LIVE TICKER ═══════════ */}
      {activeOutages.length > 0 && (
        <div
          className="overflow-hidden h-10 flex items-center border-y"
          style={{ background: 'rgba(255,176,0,0.06)', borderColor: 'rgba(255,176,0,0.15)' }}
        >
          <div
            className="flex items-center h-full px-4 gap-3 flex-shrink-0 border-r"
            style={{ borderColor: 'rgba(255,176,0,0.2)' }}
          >
            <Radio size={12} className="animate-pulse" style={{ color: '#FFB000' }} />
            <span className="text-xs font-extrabold uppercase tracking-widest" style={{ color: '#FFB000' }}>Live</span>
          </div>
          <div className="flex-1 overflow-hidden">
            <div className="ticker flex gap-10 whitespace-nowrap">
              {[...activeOutages, ...activeOutages].map((o, i) => (
                <span key={i} className="flex-shrink-0 text-sm flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: SEV_COLOR[o.severity] || '#64748b' }} />
                  <span className="font-semibold" style={{ color: 'var(--text-1)' }}>{o.region}</span>
                  <span style={{ color: 'var(--text-3)' }}>— {o.town}{o.area ? `, ${o.area}` : ''}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ STATISTICS SECTION ═══════════ */}
      <section className="py-16 px-4 sm:px-6 lg:px-8" style={{ background: 'var(--bg-card-alt)' }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <SectionLabel icon={Activity} color="#FFB000">Live Statistics</SectionLabel>
            <h2 className="text-2xl sm:text-3xl font-extrabold mb-2" style={{ color: 'var(--text-1)' }}>
              Current outage overview
            </h2>
            <p className="text-sm" style={{ color: 'var(--text-2)' }}>
              All statistics update automatically as reports are submitted across Ghana.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {heroStats.map(({ value, label, icon: Icon }) => (
              <div
                key={label}
                className="rounded-2xl px-5 py-6 border card-hover text-center group"
                style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', boxShadow: 'var(--shadow-card)' }}
              >
                <Icon className="w-5 h-5 mx-auto mb-3 transition-colors" style={{ color: '#FFB000' }} />
                <div className="stat-number text-3xl sm:text-4xl font-extrabold mb-1" style={{ color: '#FFB000' }}>
                  {value}
                </div>
                <div className="text-xs font-medium" style={{ color: 'var(--text-3)' }}>{label}</div>
              </div>
            ))}
          </div>

          {stats.active > 0 && (
            <div
              className="mt-4 flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-medium"
              style={{ background: 'rgba(239,68,68,0.06)', borderColor: 'rgba(239,68,68,0.15)', color: '#F87171' }}
            >
              <span className="w-1.5 h-1.5 bg-red-500 rounded-full status-live" />
              {stats.active} active outage{stats.active !== 1 ? 's' : ''} currently in progress
            </div>
          )}
        </div>
      </section>

      <SectionDivider />

      {/* ═══════════ PLATFORM FEATURES ═══════════ */}
      <section className="py-24 px-4 sm:px-6 lg:px-8" style={{ background: 'var(--bg-page)' }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <SectionLabel icon={Zap} color="#FFB000">Platform Features</SectionLabel>
            <h2 className="text-3xl sm:text-4xl font-extrabold mb-4 leading-tight" style={{ color: 'var(--text-1)' }}>
              Everything you need to track dumsor
            </h2>
            <p className="max-w-2xl mx-auto text-base leading-relaxed" style={{ color: 'var(--text-2)' }}>
              Built for Ghanaians. Powered by community reports. Stay ahead of electricity outages across all 16 regions.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map(({ icon: Icon, title, desc, color }) => (
              <div
                key={title}
                className="card-hover rounded-2xl p-6 border group"
                style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', boxShadow: 'var(--shadow-card)' }}
              >
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center mb-5 transition-transform duration-200 group-hover:scale-110"
                  style={{ background: `${color}12`, border: `1px solid ${color}20` }}
                >
                  <Icon className="w-5 h-5" style={{ color }} />
                </div>
                <h3 className="font-bold text-base mb-2" style={{ color: 'var(--text-1)' }}>{title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-2)' }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <SectionDivider />

      {/* ═══════════ HOW IT WORKS ═══════════ */}
      <section className="py-24 px-4 sm:px-6 lg:px-8" style={{ background: 'var(--bg-card-alt)' }}>
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <SectionLabel icon={CheckCircle} color="#22C55E">Simple Process</SectionLabel>
            <h2 className="text-3xl sm:text-4xl font-extrabold mb-3" style={{ color: 'var(--text-1)' }}>
              How it works
            </h2>
            <p className="text-base" style={{ color: 'var(--text-2)' }}>
              Three steps to keep Ghana's communities informed
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 sm:gap-6">
            {howItWorks.map(({ icon: Icon, color, title, desc }) => (
              <div
                key={title}
                className="card-hover flex flex-col items-center text-center rounded-2xl p-6 border group"
                style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', boxShadow: 'var(--shadow-card)' }}
              >
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5 transition-all duration-200 group-hover:scale-110"
                  style={{ background: `${color}10`, border: `1px solid ${color}20` }}
                >
                  <Icon className="w-6 h-6" style={{ color }} />
                </div>
                <h3 className="font-extrabold text-base mb-2.5" style={{ color: 'var(--text-1)' }}>{title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-2)' }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <SectionDivider />

      {/* ═══════════ LIVE MAP PREVIEW ═══════════ */}
      <section className="py-24 px-4 sm:px-6 lg:px-8" style={{ background: 'var(--bg-page)' }}>
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">

            {/* Left: Info */}
            <div>
              <SectionLabel icon={MapPin} color="#3B82F6">Live Map</SectionLabel>
              <h2 className="text-3xl sm:text-4xl font-extrabold mb-5 leading-tight" style={{ color: 'var(--text-1)' }}>
                Track outages across<br />all 16 regions
              </h2>
              <p className="text-base leading-relaxed mb-8" style={{ color: 'var(--text-2)' }}>
                Our interactive map shows real-time outage pins colour-coded by severity. Click any pin to see details
                about the outage, affected homes, duration, and current status.
              </p>

              <div className="grid grid-cols-2 gap-3 mb-8">
                {[
                  { label: 'Regions',        value: '16',               color: '#FFB000' },
                  { label: 'Active now',     value: stats.active ?? 0,  color: '#EF4444' },
                  { label: 'Total reports',  value: stats.total ?? 0,   color: '#3B82F6' },
                  { label: 'Resolved',       value: stats.resolved ?? 0, color: '#22C55E' },
                ].map(({ label, value, color }) => (
                  <div
                    key={label}
                    className="rounded-xl px-4 py-3.5 border"
                    style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
                  >
                    <div className="stat-number text-2xl font-extrabold mb-0.5" style={{ color }}>{value}</div>
                    <div className="text-xs" style={{ color: 'var(--text-3)' }}>{label}</div>
                  </div>
                ))}
              </div>

              <Link
                to="/map"
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl font-bold text-sm text-[#0F172A] transition-all duration-200 hover:-translate-y-0.5"
                style={{ background: 'linear-gradient(135deg, #FFB000 0%, #D99600 100%)', boxShadow: '0 6px 24px rgba(255,176,0,0.35)' }}
              >
                <MapPin size={14} />
                Open Live Map
                <ArrowRight size={13} />
              </Link>
            </div>

            {/* Right: Outage status panel */}
            <div>
              <div
                className="rounded-3xl overflow-hidden border"
                style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', boxShadow: 'var(--shadow-lg)' }}
              >
                {/* Panel header */}
                <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex items-center gap-2">
                    {activeOutages.length > 0 ? (
                      <span className="w-2 h-2 bg-red-500 rounded-full status-live" />
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    )}
                    <span className="text-sm font-bold" style={{ color: 'var(--text-1)' }}>
                      {activeOutages.length > 0 ? 'Active Outages' : 'Current Status'}
                    </span>
                  </div>
                  <span
                    className="text-xs font-bold px-2.5 py-1 rounded-full"
                    style={activeOutages.length > 0
                      ? { background: 'rgba(239,68,68,0.1)', color: '#EF4444' }
                      : { background: 'rgba(34,197,94,0.1)', color: '#22C55E' }
                    }
                  >
                    {activeOutages.length > 0 ? `${activeOutages.length} active` : 'All clear'}
                  </span>
                </div>

                {/* Panel body */}
                {activeOutages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                    <div
                      className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 border"
                      style={{ background: 'rgba(34,197,94,0.08)', borderColor: 'rgba(34,197,94,0.18)' }}
                    >
                      <CheckCircle className="w-7 h-7" style={{ color: '#22C55E' }} />
                    </div>
                    <h3 className="font-bold text-base mb-2" style={{ color: 'var(--text-1)' }}>No active outages</h3>
                    <p className="text-sm" style={{ color: 'var(--text-2)', maxWidth: '200px' }}>
                      All 16 regions are reporting normal power supply.
                    </p>
                  </div>
                ) : (
                  <div>
                    {activeOutages.slice(0, 5).map(o => (
                      <div
                        key={o.id}
                        className="flex items-center gap-3 px-5 py-3.5 border-b border-l-[3px]"
                        style={{ borderColor: 'var(--border)', borderLeftColor: SEV_COLOR[o.severity] || '#64748b' }}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                            <span className="font-bold text-sm truncate" style={{ color: 'var(--text-1)' }}>{o.town}</span>
                            <span className="text-xs" style={{ color: 'var(--text-3)' }}>·</span>
                            <span className="text-xs" style={{ color: 'var(--text-3)' }}>{o.region}</span>
                          </div>
                          <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--text-3)' }}>
                            <span className="flex items-center gap-1">
                              <Clock size={10} className="flex-shrink-0" />
                              {o.duration}
                            </span>
                            <span className="flex items-center gap-1">
                              <Users size={10} className="flex-shrink-0" />
                              {o.affectedHomes?.toLocaleString()} homes
                            </span>
                          </div>
                        </div>
                        <span
                          className="text-[10px] font-extrabold px-2 py-0.5 rounded-full flex-shrink-0 uppercase tracking-wide"
                          style={{
                            background: `${SEV_COLOR[o.severity] || '#64748b'}18`,
                            color: SEV_COLOR[o.severity] || '#64748b',
                          }}
                        >
                          {o.severity}
                        </span>
                      </div>
                    ))}
                    {activeOutages.length > 5 && (
                      <div className="px-5 py-3 text-xs text-center" style={{ color: 'var(--text-3)' }}>
                        +{activeOutages.length - 5} more active outages
                      </div>
                    )}
                  </div>
                )}

                {/* Panel footer */}
                <div className="px-5 py-4 border-t" style={{ borderColor: 'var(--border)', background: 'var(--overlay-xs)' }}>
                  <Link
                    to="/feed"
                    className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-bold border transition-all hover:-translate-y-0.5"
                    style={{ background: 'rgba(255,176,0,0.08)', borderColor: 'rgba(255,176,0,0.18)', color: '#FFB000' }}
                  >
                    View All Reports <ArrowRight size={13} />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <SectionDivider />

      {/* ═══════════ RECENT REPORTS ═══════════ */}
      <section className="py-24 px-4 sm:px-6 lg:px-8" style={{ background: 'var(--bg-card-alt)' }}>
        <div className="max-w-6xl mx-auto">

          {/* Section header */}
          <div className="text-center mb-10">
            <SectionLabel icon={Activity} color="#EF4444">Recent Activity</SectionLabel>
            <h2 className="text-3xl sm:text-4xl font-extrabold mb-3 leading-tight" style={{ color: 'var(--text-1)' }}>
              Latest outage reports
            </h2>
            <p className="text-base" style={{ color: 'var(--text-2)' }}>
              Real reports from communities across Ghana
            </p>
          </div>

          {/* Filter pills */}
          {outages.length > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
              {[
                { id: 'all',      label: 'All Reports', count: feedCounts.all },
                { id: 'active',   label: 'Active',      count: feedCounts.active },
                { id: 'resolved', label: 'Resolved',    count: feedCounts.resolved },
                { id: 'critical', label: 'Critical',    count: feedCounts.critical },
              ].map(({ id, label, count }) => {
                const sel = feedFilter === id
                return (
                  <button
                    key={id}
                    onClick={() => setFeedFilter(id)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold transition-all"
                    style={{
                      background: sel ? 'rgba(239,68,68,0.1)' : 'var(--overlay-sm)',
                      color:      sel ? '#EF4444' : 'var(--text-3)',
                      border:     sel ? '1px solid rgba(239,68,68,0.25)' : '1px solid var(--border)',
                    }}
                  >
                    {label}
                    <span
                      className="px-1.5 py-0.5 rounded-full text-xs font-extrabold tabular-nums"
                      style={{
                        background: sel ? 'rgba(239,68,68,0.15)' : 'var(--overlay-md)',
                        color: sel ? '#EF4444' : 'var(--text-3)',
                      }}
                    >
                      {count}
                    </span>
                  </button>
                )
              })}
            </div>
          )}

          {/* Empty state — no reports at all */}
          {outages.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center py-20 rounded-3xl border border-dashed"
              style={{ borderColor: 'var(--border-strong)', background: 'var(--overlay-xs)' }}
            >
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5 border"
                style={{ background: 'rgba(255,176,0,0.08)', borderColor: 'rgba(255,176,0,0.18)' }}
              >
                <Zap className="w-8 h-8" style={{ color: '#FFB000', opacity: 0.7 }} />
              </div>
              <h3 className="font-bold text-lg mb-2" style={{ color: 'var(--text-1)' }}>
                No outage reports available
              </h3>
              <p className="text-sm mb-6 text-center max-w-xs" style={{ color: 'var(--text-2)' }}>
                Be the first to report a power outage in your area and help your community.
              </p>
              <button
                type="button"
                onClick={() => openModal?.()}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm text-[#0F172A] transition-all hover:-translate-y-0.5"
                style={{ background: 'linear-gradient(135deg, #FFB000 0%, #D99600 100%)', boxShadow: '0 4px 20px rgba(255,176,0,0.35)' }}
              >
                <AlertTriangle size={14} />
                Report an Outage
              </button>
            </div>
          ) : filteredRecent.length === 0 ? (
            /* Filter returned no results */
            <div
              className="flex flex-col items-center justify-center py-16 rounded-2xl border border-dashed"
              style={{ borderColor: 'var(--border)', background: 'var(--overlay-xs)' }}
            >
              <p className="text-sm mb-3" style={{ color: 'var(--text-3)' }}>
                No {feedFilter !== 'all' ? feedFilter : ''} outage reports found.
              </p>
              <button
                onClick={() => setFeedFilter('all')}
                className="text-sm font-bold transition-opacity hover:opacity-70"
                style={{ color: '#EF4444' }}
              >
                Show all reports
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredRecent.map(o => {
                  const sevColor = SEV_COLOR[o.severity] || '#64748b'
                  return (
                    <div
                      key={o.id}
                      className="rounded-2xl border border-l-[3px] overflow-hidden transition-all duration-200 hover:-translate-y-0.5"
                      style={{
                        background: 'var(--bg-card)',
                        borderColor: 'var(--border)',
                        borderLeftColor: sevColor,
                        boxShadow: 'var(--shadow-card)',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow-hover)'; e.currentTarget.style.borderColor = 'var(--border-strong)' }}
                      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--shadow-card)'; e.currentTarget.style.borderColor = 'var(--border)' }}
                    >
                      <div className="p-5">
                        {/* Header */}
                        <div className="flex items-start gap-3 mb-3">
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                            style={{ background: `${sevColor}14`, border: `1px solid ${sevColor}22` }}
                          >
                            <MapPin size={13} style={{ color: sevColor }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <h3 className="font-bold text-sm leading-snug truncate" style={{ color: 'var(--text-1)' }}>
                                  {o.town}{o.area ? `, ${o.area}` : ''}
                                </h3>
                                <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{o.region}</p>
                              </div>
                              <span className="text-xs flex-shrink-0 tabular-nums" style={{ color: 'var(--text-3)' }}>
                                {timeAgo(o.timestamp)}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Description */}
                        {o.description && (
                          <p className="text-sm leading-relaxed line-clamp-2 mb-3" style={{ color: 'var(--text-2)', paddingLeft: '2.75rem' }}>
                            {o.description}
                          </p>
                        )}

                        {/* Badges */}
                        <div className="flex items-center gap-2 mb-0" style={{ paddingLeft: '2.75rem' }}>
                          <SeverityBadge severity={o.severity} />
                          <StatusBadge   status={o.status} />
                        </div>

                        {/* Footer */}
                        <div
                          className="flex items-center gap-4 mt-3.5 pt-3.5 border-t text-xs"
                          style={{ borderColor: 'var(--border)', color: 'var(--text-3)' }}
                        >
                          <span className="flex items-center gap-1.5">
                            <Clock size={10} className="flex-shrink-0" />
                            {o.duration || 'Unknown'}
                          </span>
                          {o.affectedHomes > 0 && (
                            <span className="flex items-center gap-1.5">
                              <Users size={10} className="flex-shrink-0" />
                              {o.affectedHomes.toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* View all link */}
              <div className="text-center mt-8">
                <Link
                  to="/feed"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold border transition-all hover:-translate-y-0.5"
                  style={{ background: 'var(--overlay-sm)', borderColor: 'var(--border-strong)', color: 'var(--text-1)' }}
                >
                  View all {outages.length} reports <ArrowRight size={14} />
                </Link>
              </div>
            </>
          )}
        </div>
      </section>

      <SectionDivider />

      {/* ═══════════ REPORT CTA ═══════════ */}
      <section className="py-28 px-4 sm:px-6 lg:px-8" style={{ background: 'var(--bg-page)' }}>
        <div className="max-w-2xl mx-auto text-center">

          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-7 border"
            style={{
              background: 'rgba(255,176,0,0.1)',
              borderColor: 'rgba(255,176,0,0.22)',
              boxShadow: '0 0 32px rgba(255,176,0,0.12)',
            }}
          >
            <Zap className="w-8 h-8" style={{ color: '#FFB000' }} fill="#FFB000" />
          </div>

          <h2 className="text-3xl sm:text-4xl font-extrabold mb-4 leading-tight" style={{ color: 'var(--text-1)' }}>
            Experiencing dumsor right now?
          </h2>
          <p className="text-base mb-10 max-w-md mx-auto leading-relaxed" style={{ color: 'var(--text-2)' }}>
            Report your outage in under a minute and help your community stay informed.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              type="button"
              onClick={() => openModal?.()}
              className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-2xl font-bold text-sm text-[#0F172A] transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0"
              style={{ background: 'linear-gradient(135deg, #FFB000 0%, #D99600 100%)', boxShadow: '0 8px 28px rgba(255,176,0,0.38)' }}
            >
              Report an Outage <ChevronRight size={15} />
            </button>
            <Link
              to="/dashboard"
              className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-2xl font-bold text-sm transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 border"
              style={{
                background: 'var(--overlay-sm)',
                borderColor: 'var(--border-strong)',
                color: 'var(--text-1)',
              }}
            >
              View Dashboard <ChevronRight size={15} />
            </Link>
          </div>
        </div>
      </section>

      {/* ═══════════ FOOTER ═══════════ */}
      <footer className="border-t py-10 px-4 sm:px-6 lg:px-8" style={{ background: 'var(--bg-card-alt)', borderColor: 'var(--border)' }}>
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-5">
          <div className="flex items-center gap-2.5">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #FFB000 0%, #D99600 100%)' }}
            >
              <Zap className="w-4 h-4 text-white" fill="white" />
            </div>
            <span className="font-bold text-sm" style={{ color: 'var(--text-1)' }}>DumsorTracker Ghana</span>
          </div>

          <p className="text-xs text-center" style={{ color: 'var(--text-3)' }}>
            © 2026 DumsorTracker Ghana · Keeping communities informed, one report at a time.
          </p>

          <div className="flex gap-5">
            {['dashboard', 'map', 'feed', 'analytics'].map(p => (
              <Link
                key={p}
                to={`/${p}`}
                className="text-sm capitalize font-medium transition-colors duration-200 hover:text-[#FFB000]"
                style={{ color: 'var(--text-3)' }}
              >
                {p}
              </Link>
            ))}
          </div>
        </div>
      </footer>

    </div>
  )
}
