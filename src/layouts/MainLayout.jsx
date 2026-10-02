import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  Zap, LayoutDashboard, MapPin, Plus, Activity, BarChart3,
  Menu, X, Sun, Moon, Bell, Search
} from 'lucide-react'

const navItems = [
  { to: '/',          label: 'Home',        icon: Zap,             exact: true },
  { to: '/dashboard', label: 'Dashboard',   icon: LayoutDashboard },
  { to: '/map',       label: 'Live Map',    icon: MapPin },
  { to: '/feed',      label: 'Outage Feed', icon: Activity },
  { to: '/analytics', label: 'Analytics',   icon: BarChart3 },
]

export function MainLayout({ children, dark, setDark, openModal }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()
  const isHome = location.pathname === '/'

  if (isHome) return <>{children}</>

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-page)' }}>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-30 w-64 flex-shrink-0 flex flex-col border-r sidebar-transition ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
        style={{ background: 'var(--bg-sidebar)', borderColor: 'var(--border)' }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b" style={{ borderColor: 'var(--border)' }}>
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 glow-pulse"
            style={{
              background: 'linear-gradient(135deg, #FFB000 0%, #D99600 100%)',
              boxShadow: '0 4px 16px rgba(255,176,0,0.4)',
            }}
          >
            <Zap className="w-5 h-5 text-white" fill="white" />
          </div>
          <div className="min-w-0">
            <div className="font-extrabold text-sm leading-tight tracking-tight" style={{ color: 'var(--text-1)' }}>
              Dumsor<span style={{ color: '#FFB000' }}>Tracker</span>
            </div>
            <div className="text-xs font-medium mt-0.5" style={{ color: '#FFB000', opacity: 0.75 }}>
              Ghana · All 16 Regions
            </div>
          </div>
          <button
            className="ml-auto lg:hidden p-1.5 rounded-lg transition-colors"
            style={{ color: 'var(--text-3)' }}
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map(({ to, label, icon: Icon, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 border ${
                  isActive ? 'border-[#FFB000]/20' : 'border-transparent hover:border-transparent'
                }`
              }
              style={({ isActive }) => ({
                background: isActive ? 'rgba(255,176,0,0.08)' : 'transparent',
                color: isActive ? '#FFB000' : 'var(--text-2)',
              })}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </NavLink>
          ))}

          {/* Report Outage — opens modal */}
          <button
            type="button"
            onClick={() => { setSidebarOpen(false); openModal?.() }}
            className="w-full flex items-center gap-3 px-3 py-2.5 mt-1 rounded-xl text-sm font-bold border transition-all text-[#0F172A]"
            style={{
              background: 'linear-gradient(135deg, #FFB000 0%, #D99600 100%)',
              boxShadow: '0 2px 10px rgba(255,176,0,0.25)',
              border: 'none',
            }}
          >
            <Plus className="w-4 h-4 flex-shrink-0" />
            Report Outage
          </button>
        </nav>

        {/* Live status */}
        <div
          className="mx-3 mb-3 rounded-xl border p-3"
          style={{ background: 'var(--overlay-xs)', borderColor: 'var(--border)' }}
        >
          <div className="flex items-center gap-2 mb-1.5">
            <span className="w-2 h-2 bg-emerald-500 rounded-full status-live flex-shrink-0" />
            <span className="text-xs font-semibold text-emerald-500">Live Feed Active</span>
          </div>
          <p className="text-xs leading-snug" style={{ color: 'var(--text-3)' }}>
            Monitoring power outages across all 16 regions of Ghana
          </p>
        </div>

        {/* User footer */}
        <div className="px-4 py-4 border-t" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-bold"
              style={{ background: 'linear-gradient(135deg, #FFB000 0%, #22C55E 100%)' }}
            >
              EC
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold truncate" style={{ color: 'var(--text-1)' }}>ECG Monitor</div>
              <div className="text-xs" style={{ color: 'var(--text-3)' }}>Community Reporter</div>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Top bar */}
        <header
          className="flex items-center gap-4 px-4 lg:px-6 h-16 flex-shrink-0 border-b"
          style={{
            background: 'var(--bg-navbar)',
            borderColor: 'var(--border)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
          }}
        >
          <button
            className="lg:hidden p-2 rounded-xl transition-all"
            style={{ color: 'var(--text-2)' }}
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Search */}
          <div
            className="flex-1 max-w-md hidden sm:flex items-center gap-2.5 px-3.5 py-2 rounded-xl border transition-all"
            style={{ background: 'var(--bg-input)', borderColor: 'var(--border)' }}
          >
            <Search className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-3)' }} />
            <input
              type="text"
              placeholder="Search outages, regions, towns..."
              className="flex-1 bg-transparent text-sm outline-none"
              style={{ color: 'var(--text-1)' }}
            />
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={() => openModal?.()}
              className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-[#0F172A] transition-all hover:-translate-y-0.5"
              style={{
                background: 'linear-gradient(135deg, #FFB000 0%, #D99600 100%)',
                boxShadow: '0 3px 12px rgba(255,176,0,0.25)',
              }}
            >
              <Plus className="w-3.5 h-3.5" />
              Report
            </button>

            <button
              onClick={() => setDark(!dark)}
              className="p-2 rounded-xl transition-all"
              style={{ color: 'var(--text-2)' }}
              title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <button className="relative p-2 rounded-xl transition-all" style={{ color: 'var(--text-2)' }}>
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full status-live" />
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto" style={{ background: 'var(--bg-page)' }}>
          {children}
        </main>
      </div>
    </div>
  )
}
