import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle, CheckCircle, MapPin, FileText, User,
  ChevronDown, Zap, ArrowRight, ArrowLeft, Clock, Phone, Mail,
} from 'lucide-react'
import { REGIONS } from '../data/outages'

const SEVERITIES = [
  { value: 'low',      label: 'Low',      desc: 'Minor disruption, limited area',           color: '#22C55E' },
  { value: 'medium',   label: 'Medium',   desc: 'Moderate — several streets affected',      color: '#FFB000' },
  { value: 'high',     label: 'High',     desc: 'Large area, multiple communities',         color: '#F97316' },
  { value: 'critical', label: 'Critical', desc: 'Widespread blackout, infrastructure risk', color: '#EF4444' },
]

const TOWNS_BY_REGION = {
  'Greater Accra':  ['Accra', 'Tema', 'Madina', 'Osu', 'Labadi', 'Adenta', 'Kasoa', 'Ashaiman', 'Teshie', 'Nungua', 'Dansoman', 'Achimota'],
  'Ashanti':        ['Kumasi', 'Obuasi', 'Mampong', 'Ejisu', 'Konongo', 'Bekwai', 'Juaben', 'Offinso', 'Asokwa'],
  'Central':        ['Cape Coast', 'Winneba', 'Saltpond', 'Mankessim', 'Dunkwa', 'Agona Swedru', 'Assin Fosu'],
  'Eastern':        ['Koforidua', 'Nkawkaw', 'Suhum', 'Nsawam', 'Akim Oda', 'Aburi', 'Akropong'],
  'Western':        ['Takoradi', 'Sekondi', 'Tarkwa', 'Axim', 'Half Assini', 'Prestea', 'Bogoso'],
  'Western North':  ['Sefwi Wiawso', 'Bibiani', 'Juaboso', 'Enchi', 'Bia'],
  'Bono':           ['Sunyani', 'Berekum', 'Dormaa Ahenkro', 'Wenchi', 'Jinijini'],
  'Bono East':      ['Techiman', 'Kintampo', 'Nkoranza', 'Atebubu', 'Yeji'],
  'Ahafo':          ['Goaso', 'Kukuom', 'Duayaw Nkwanta', 'Akrodie', 'Hwidiem'],
  'Volta':          ['Ho', 'Keta', 'Hohoe', 'Aflao', 'Akatsi', 'Kpando', 'Sogakope'],
  'Oti':            ['Dambai', 'Jasikan', 'Nkwanta', 'Buem', 'Kadjebi'],
  'Northern':       ['Tamale', 'Yendi', 'Bimbilla', 'Savelugu', 'Tolon', 'Gushegu'],
  'Savannah':       ['Damongo', 'Bole', 'Sawla', 'Tuna', 'Salaga'],
  'North East':     ['Nalerigu', 'Walewale', 'Gambaga', 'Bunkpurugu', 'Chereponi'],
  'Upper East':     ['Bolgatanga', 'Navrongo', 'Bawku', 'Zebilla', 'Bongo', 'Sandema'],
  'Upper West':     ['Wa', 'Tumu', 'Nandom', 'Jirapa', 'Lawra', 'Nadowli'],
}

const STEPS = [
  { label: 'Location', icon: MapPin },
  { label: 'Details',  icon: FileText },
  { label: 'Contact',  icon: User },
]

function getNow() {
  const d = new Date()
  d.setSeconds(0, 0)
  return d.toISOString().slice(0, 16)
}

function StepHeader({ icon: Icon, color, title, subtitle }) {
  return (
    <div className="flex items-center gap-3 pb-5 border-b" style={{ borderColor: 'var(--border)' }}>
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: `${color}18`, border: `1px solid ${color}28` }}
      >
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
      <div>
        <div className="font-bold text-sm" style={{ color: 'var(--text-1)' }}>{title}</div>
        <div className="text-xs" style={{ color: 'var(--text-3)' }}>{subtitle}</div>
      </div>
    </div>
  )
}

function FieldLabel({ children, hint }) {
  return (
    <div className="flex items-baseline justify-between mb-2">
      <label className="text-sm font-semibold" style={{ color: 'var(--text-2)' }}>{children}</label>
      {hint && <span className="text-xs" style={{ color: 'var(--text-3)' }}>{hint}</span>}
    </div>
  )
}

function FieldError({ msg }) {
  if (!msg) return null
  return (
    <p className="text-red-400 text-xs mt-1.5 flex items-center gap-1">
      <AlertTriangle size={10} />{msg}
    </p>
  )
}

function PremiumSelect({ value, onChange, error, children }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full px-4 py-3 pr-10 rounded-xl text-sm appearance-none focus:outline-none transition-all border"
        style={{
          background: 'var(--bg-input)',
          borderColor: error ? 'rgba(239,68,68,0.5)' : 'var(--border)',
          color: value ? 'var(--text-1)' : 'var(--text-3)',
          boxShadow: error ? '0 0 0 3px rgba(239,68,68,0.08)' : 'none',
        }}
        onFocus={e => { e.target.style.borderColor = '#FFB000'; e.target.style.boxShadow = '0 0 0 3px rgba(255,176,0,0.1)' }}
        onBlur={e => { e.target.style.borderColor = error ? 'rgba(239,68,68,0.5)' : 'var(--border)'; e.target.style.boxShadow = error ? '0 0 0 3px rgba(239,68,68,0.08)' : 'none' }}
      >
        {children}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: 'var(--text-3)' }} />
    </div>
  )
}

function PremiumInput({ value, onChange, placeholder, error, type = 'text', icon: Icon }) {
  return (
    <div className="relative">
      {Icon && (
        <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: 'var(--text-3)' }} />
      )}
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full py-3 rounded-xl text-sm focus:outline-none transition-all border"
        style={{
          paddingLeft: Icon ? '2.5rem' : '1rem',
          paddingRight: '1rem',
          background: 'var(--bg-input)',
          borderColor: error ? 'rgba(239,68,68,0.5)' : 'var(--border)',
          color: 'var(--text-1)',
          boxShadow: error ? '0 0 0 3px rgba(239,68,68,0.08)' : 'none',
        }}
        onFocus={e => { e.target.style.borderColor = '#FFB000'; e.target.style.boxShadow = '0 0 0 3px rgba(255,176,0,0.1)' }}
        onBlur={e => { e.target.style.borderColor = error ? 'rgba(239,68,68,0.5)' : 'var(--border)'; e.target.style.boxShadow = 'none' }}
      />
    </div>
  )
}

export default function ReportPage({ addOutage }) {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [submitted, setSubmitted] = useState(false)
  const [lastSubmit, setLastSubmit] = useState(null)
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [form, setForm] = useState({
    region: '',
    town: '',
    area: '',
    severity: '',
    startedAt: getNow(),
    description: '',
    reporter: '',
    phone: '',
    email: '',
  })

  const set = (field, value) => {
    setForm(f => field === 'region' ? { ...f, region: value, town: '' } : { ...f, [field]: value })
    if (errors[field]) setErrors(e => ({ ...e, [field]: '' }))
  }

  const validate = () => {
    const errs = {}
    if (step === 0) {
      if (!form.region)        errs.region = 'Please select a region'
      if (!form.town.trim())   errs.town   = 'Please enter a town or city'
    }
    if (step === 1) {
      if (!form.severity)      errs.severity    = 'Please select a severity level'
      if (!form.startedAt)     errs.startedAt   = 'Please enter when the outage started'
      if (form.description.trim().length < 10)
                               errs.description = 'Please describe the outage (at least 10 characters)'
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const next = () => { if (validate()) setStep(s => s + 1) }
  const prev = () => setStep(s => s - 1)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (submitting) return
    setSubmitError(null)
    setSubmitting(true)
    try {
      const result = await addOutage(form)
      setLastSubmit({ form: { ...form }, result })
      setSubmitted(true)
    } catch (err) {
      setSubmitError(err.message || 'Could not submit your report. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const resetForm = () => {
    setSubmitted(false)
    setLastSubmit(null)
    setStep(0)
    setErrors({})
    setSubmitError(null)
    setSubmitting(false)
    setForm({ region: '', town: '', area: '', severity: '', startedAt: getNow(), description: '', reporter: '', phone: '', email: '' })
  }

  /* ─── Success screen ─── */
  if (submitted && lastSubmit) {
    const { form: f } = lastSubmit
    const sevData = SEVERITIES.find(s => s.value === f.severity)
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="max-w-lg w-full">
          <div
            className="rounded-3xl border overflow-hidden"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', boxShadow: 'var(--shadow-lg)' }}
          >
            {/* Success header */}
            <div
              className="text-center px-8 pt-10 pb-8 border-b"
              style={{ borderColor: 'var(--border)' }}
            >
              <div
                className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-5 border"
                style={{
                  background: 'rgba(34,197,94,0.1)',
                  borderColor: 'rgba(34,197,94,0.22)',
                  boxShadow: '0 0 48px rgba(34,197,94,0.12)',
                }}
              >
                <CheckCircle className="w-10 h-10" style={{ color: '#22C55E' }} />
              </div>
              <h1 className="text-2xl font-extrabold mb-2" style={{ color: 'var(--text-1)' }}>
                Report Submitted!
              </h1>
              <p className="text-sm" style={{ color: 'var(--text-2)' }}>
                Your outage report is now live on the feed and map.
              </p>
            </div>

            {/* Report details */}
            <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {[
                { label: 'Location', value: `${f.town}${f.area ? `, ${f.area}` : ''} · ${f.region}` },
                {
                  label: 'Severity',
                  value: (
                    <span style={{ color: sevData?.color }}>
                      {f.severity.charAt(0).toUpperCase() + f.severity.slice(1)}
                    </span>
                  ),
                },
                {
                  label: 'Outage started',
                  value: f.startedAt
                    ? new Date(f.startedAt).toLocaleString('en-GH', { dateStyle: 'medium', timeStyle: 'short' })
                    : '—',
                },
                { label: 'Reporter', value: f.reporter || 'Anonymous' },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between items-center px-6 py-3.5 text-sm">
                  <span style={{ color: 'var(--text-3)' }}>{label}</span>
                  <span className="font-semibold text-right" style={{ color: 'var(--text-1)' }}>{value}</span>
                </div>
              ))}
            </div>

            {/* CTAs */}
            <div className="px-6 pb-6 pt-4 flex gap-3 border-t" style={{ borderColor: 'var(--border)' }}>
              <button
                onClick={resetForm}
                className="flex-1 py-3 rounded-xl font-semibold text-sm border transition-all"
                style={{ background: 'var(--overlay-sm)', borderColor: 'var(--border)', color: 'var(--text-2)' }}
              >
                Report Another
              </button>
              <button
                onClick={() => navigate('/feed')}
                className="flex-1 py-3 rounded-xl font-bold text-sm text-[#0F172A] transition-all hover:-translate-y-0.5 flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(135deg, #FFB000 0%, #D99600 100%)', boxShadow: '0 4px 20px rgba(255,176,0,0.35)' }}
              >
                View Feed <ArrowRight size={14} />
              </button>
            </div>
          </div>

          <p className="text-center text-xs mt-5" style={{ color: 'var(--text-3)' }}>
            Thank you for helping Ghana stay informed.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] p-4 sm:p-6 lg:p-8">
      <div className="max-w-2xl mx-auto">

        {/* Page header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1.5">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.18)' }}
            >
              <AlertTriangle className="w-4 h-4" style={{ color: '#EF4444' }} />
            </div>
            <h1 className="text-2xl font-extrabold" style={{ color: 'var(--text-1)' }}>
              Report a Power Outage
            </h1>
          </div>
          <p className="text-sm ml-12" style={{ color: 'var(--text-3)' }}>
            Help your community by reporting dumsor near you. No account required.
          </p>
        </div>

        {/* Step progress */}
        <div className="flex items-center mb-8">
          {STEPS.map(({ label, icon: Icon }, i) => (
            <div key={label} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200"
                  style={{
                    background: i < step
                      ? '#22C55E'
                      : i === step
                        ? 'linear-gradient(135deg, #FFB000 0%, #D99600 100%)'
                        : 'var(--overlay-md)',
                    color: i <= step ? '#0F172A' : 'var(--text-3)',
                    boxShadow: i === step ? '0 4px 16px rgba(255,176,0,0.35)' : 'none',
                    border: i > step ? '1px solid var(--border)' : 'none',
                  }}
                >
                  {i < step
                    ? <CheckCircle size={16} />
                    : <Icon size={15} />
                  }
                </div>
                <span
                  className="text-xs font-medium"
                  style={{ color: i === step ? '#FFB000' : 'var(--text-3)' }}
                >
                  {label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className="flex-1 h-px mx-3 mb-5 transition-all duration-300"
                  style={{ background: i < step ? '#22C55E' : 'var(--border)' }}
                />
              )}
            </div>
          ))}
        </div>

        {/* Form card */}
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border overflow-hidden"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', boxShadow: 'var(--shadow-card)' }}
        >
          <div className="p-6 sm:p-7 space-y-5">

            {/* ── Step 0: Location ── */}
            {step === 0 && (
              <>
                <StepHeader
                  icon={MapPin}
                  color="#FFB000"
                  title="Location Details"
                  subtitle="Where is the power outage occurring?"
                />

                <div>
                  <FieldLabel>Region <span className="text-red-400">*</span></FieldLabel>
                  <PremiumSelect value={form.region} onChange={v => set('region', v)} error={errors.region}>
                    <option value="">Select your region...</option>
                    {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                  </PremiumSelect>
                  <FieldError msg={errors.region} />
                </div>

                <div>
                  <FieldLabel hint={form.region && TOWNS_BY_REGION[form.region] ? 'Select from list' : 'Type your town'}>
                    Town / City <span className="text-red-400">*</span>
                  </FieldLabel>
                  {form.region && TOWNS_BY_REGION[form.region] ? (
                    <PremiumSelect value={form.town} onChange={v => set('town', v)} error={errors.town}>
                      <option value="">Select a town...</option>
                      {TOWNS_BY_REGION[form.region].map(t => <option key={t} value={t}>{t}</option>)}
                    </PremiumSelect>
                  ) : (
                    <PremiumInput
                      value={form.town}
                      onChange={v => set('town', v)}
                      placeholder="e.g. Accra, Kumasi, Takoradi..."
                      error={errors.town}
                    />
                  )}
                  <FieldError msg={errors.town} />
                </div>

                <div>
                  <FieldLabel hint="Optional">Specific Area / Neighbourhood</FieldLabel>
                  <PremiumInput
                    value={form.area}
                    onChange={v => set('area', v)}
                    placeholder="e.g. East Legon, Osu, Ayigya, Community 5..."
                  />
                </div>
              </>
            )}

            {/* ── Step 1: Outage Details ── */}
            {step === 1 && (
              <>
                <StepHeader
                  icon={FileText}
                  color="#FFB000"
                  title="Outage Details"
                  subtitle="Tell us more about the power cut"
                />

                <div>
                  <FieldLabel>Severity Level <span className="text-red-400">*</span></FieldLabel>
                  <div className="grid grid-cols-2 gap-2.5">
                    {SEVERITIES.map(({ value, label, desc, color }) => {
                      const sel = form.severity === value
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => set('severity', value)}
                          className="text-left px-4 py-3.5 rounded-xl border-2 transition-all duration-150 hover:-translate-y-0.5"
                          style={{
                            borderColor: sel ? color : 'var(--border)',
                            background: sel ? `${color}12` : 'var(--overlay-xs)',
                            boxShadow: sel ? `0 4px 16px ${color}22` : 'none',
                          }}
                        >
                          <div
                            className="font-bold text-sm mb-0.5 flex items-center gap-2"
                            style={{ color: sel ? color : 'var(--text-2)' }}
                          >
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                            {label}
                          </div>
                          <div className="text-xs leading-snug" style={{ color: sel ? `${color}bb` : 'var(--text-3)' }}>
                            {desc}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                  <FieldError msg={errors.severity} />
                </div>

                <div>
                  <FieldLabel hint="Leave as-is if just started">
                    When did the outage start? <span className="text-red-400">*</span>
                  </FieldLabel>
                  <div className="relative">
                    <Clock
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                      style={{ color: 'var(--text-3)' }}
                    />
                    <input
                      type="datetime-local"
                      value={form.startedAt}
                      max={getNow()}
                      onChange={e => set('startedAt', e.target.value)}
                      className="w-full pl-10 pr-4 py-3 rounded-xl text-sm focus:outline-none transition-all border"
                      style={{
                        background: 'var(--bg-input)',
                        borderColor: errors.startedAt ? 'rgba(239,68,68,0.5)' : 'var(--border)',
                        color: 'var(--text-1)',
                      }}
                      onFocus={e => { e.target.style.borderColor = '#FFB000'; e.target.style.boxShadow = '0 0 0 3px rgba(255,176,0,0.1)' }}
                      onBlur={e => { e.target.style.borderColor = errors.startedAt ? 'rgba(239,68,68,0.5)' : 'var(--border)'; e.target.style.boxShadow = 'none' }}
                    />
                  </div>
                  <FieldError msg={errors.startedAt} />
                </div>

                <div>
                  <FieldLabel hint={`${form.description.length} / 500`}>
                    Description <span className="text-red-400">*</span>
                  </FieldLabel>
                  <textarea
                    value={form.description}
                    onChange={e => set('description', e.target.value)}
                    placeholder="Describe the outage — how widespread is it, what areas are affected, any visible damage or known cause..."
                    rows={5}
                    maxLength={500}
                    className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none transition-all resize-none border"
                    style={{
                      background: 'var(--bg-input)',
                      borderColor: errors.description ? 'rgba(239,68,68,0.5)' : 'var(--border)',
                      color: 'var(--text-1)',
                    }}
                    onFocus={e => { e.target.style.borderColor = '#FFB000'; e.target.style.boxShadow = '0 0 0 3px rgba(255,176,0,0.1)' }}
                    onBlur={e => { e.target.style.borderColor = errors.description ? 'rgba(239,68,68,0.5)' : 'var(--border)'; e.target.style.boxShadow = 'none' }}
                  />
                  <FieldError msg={errors.description} />
                </div>
              </>
            )}

            {/* ── Step 2: Contact + Summary ── */}
            {step === 2 && (
              <>
                <StepHeader
                  icon={User}
                  color="#FFB000"
                  title="Contact Information"
                  subtitle="All fields are optional — helps verify and follow up on reports"
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <FieldLabel hint="Optional">Your Name</FieldLabel>
                    <PremiumInput
                      value={form.reporter}
                      onChange={v => set('reporter', v)}
                      placeholder="e.g. Kwame Mensah"
                      icon={User}
                    />
                  </div>
                  <div>
                    <FieldLabel hint="Optional">Phone Number</FieldLabel>
                    <PremiumInput
                      value={form.phone}
                      onChange={v => set('phone', v)}
                      placeholder="e.g. 024 123 4567"
                      type="tel"
                      icon={Phone}
                    />
                  </div>
                </div>

                <div>
                  <FieldLabel hint="Optional">Email Address</FieldLabel>
                  <PremiumInput
                    value={form.email}
                    onChange={v => set('email', v)}
                    placeholder="e.g. kwame@example.com"
                    type="email"
                    icon={Mail}
                  />
                </div>

                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-3)' }}>
                  Your contact details are never shown publicly and are only used by ECG to verify or follow up on your report.
                </p>

                {/* Summary preview */}
                <div
                  className="rounded-xl border overflow-hidden"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <div
                    className="px-4 py-2.5 border-b"
                    style={{ background: 'rgba(255,176,0,0.05)', borderColor: 'var(--border)' }}
                  >
                    <span className="text-xs font-extrabold uppercase tracking-wider" style={{ color: '#FFB000' }}>
                      Report Summary
                    </span>
                  </div>
                  <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                    {[
                      { label: 'Region',      value: form.region },
                      { label: 'Location',    value: `${form.town}${form.area ? `, ${form.area}` : ''}` },
                      {
                        label: 'Severity',
                        value: form.severity
                          ? (() => {
                              const s = SEVERITIES.find(s => s.value === form.severity)
                              return <span style={{ color: s?.color }}>{form.severity.charAt(0).toUpperCase() + form.severity.slice(1)}</span>
                            })()
                          : '—',
                      },
                      {
                        label: 'Started at',
                        value: form.startedAt
                          ? new Date(form.startedAt).toLocaleString('en-GH', { dateStyle: 'medium', timeStyle: 'short' })
                          : '—',
                      },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex justify-between items-center px-4 py-3 text-sm">
                        <span style={{ color: 'var(--text-3)' }}>{label}</span>
                        <span className="font-semibold" style={{ color: 'var(--text-1)' }}>{value || '—'}</span>
                      </div>
                    ))}
                  </div>
                  {form.description && (
                    <div
                      className="px-4 py-3 border-t"
                      style={{ borderColor: 'var(--border)', background: 'var(--overlay-xs)' }}
                    >
                      <p className="text-xs italic leading-relaxed" style={{ color: 'var(--text-2)' }}>
                        "{form.description}"
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}

          </div>

          {/* Navigation footer */}
          <div
            className="px-6 sm:px-7 py-4 border-t"
            style={{ background: 'var(--overlay-xs)', borderColor: 'var(--border)' }}
          >
            {submitError && (
              <p className="flex items-center gap-1.5 text-xs text-red-400 mb-3">
                <AlertTriangle size={11} className="flex-shrink-0" />
                {submitError}
              </p>
            )}
            <div className="flex items-center justify-between gap-3">
              {step > 0 ? (
                <button
                  type="button"
                  onClick={prev}
                  disabled={submitting}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm border transition-all"
                  style={{
                    background: 'var(--overlay-sm)',
                    borderColor: 'var(--border)',
                    color: 'var(--text-2)',
                    opacity: submitting ? 0.5 : 1,
                  }}
                >
                  <ArrowLeft size={14} /> Back
                </button>
              ) : (
                <span />
              )}

              {step < STEPS.length - 1 ? (
                <button
                  type="button"
                  onClick={next}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm text-[#0F172A] transition-all hover:-translate-y-0.5"
                  style={{ background: 'linear-gradient(135deg, #FFB000 0%, #D99600 100%)', boxShadow: '0 4px 16px rgba(255,176,0,0.3)' }}
                >
                  Continue <ArrowRight size={14} />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 px-7 py-2.5 rounded-xl font-bold text-sm text-[#0F172A] transition-all hover:-translate-y-0.5"
                  style={{
                    background: 'linear-gradient(135deg, #FFB000 0%, #D99600 100%)',
                    boxShadow: '0 6px 24px rgba(255,176,0,0.4)',
                    opacity: submitting ? 0.7 : 1,
                    cursor: submitting ? 'not-allowed' : 'pointer',
                  }}
                >
                  {submitting ? (
                    <>
                      <span
                        className="w-4 h-4 rounded-full border-2 border-[#0F172A] border-t-transparent animate-spin"
                        aria-hidden="true"
                      />
                      Submitting…
                    </>
                  ) : (
                    <>
                      <Zap size={15} fill="currentColor" />
                      Submit Report
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </form>

        <p className="text-center text-xs mt-5" style={{ color: 'var(--text-3)' }}>
          Reports are anonymous by default · No account required
        </p>
      </div>
    </div>
  )
}
