import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { X, Zap, MapPin, Clock, FileText, Phone, ChevronDown } from 'lucide-react'
import { REGIONS } from '../data/outages'

const SEVERITIES = [
  { value: 'low',      label: 'Low',      color: '#3B82F6', desc: 'Minor inconvenience' },
  { value: 'medium',   label: 'Medium',   color: '#FFB000', desc: 'Affects daily activities' },
  { value: 'high',     label: 'High',     color: '#F97316', desc: 'Major disruption' },
  { value: 'critical', label: 'Critical', color: '#EF4444', desc: 'Emergency situation' },
]

const EMPTY_FORM = { region: '', town: '', severity: '', startedAt: '', description: '', phone: '' }

export function ReportModal({ isOpen, onClose, onSubmit }) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const firstInputRef = useRef(null)

  useEffect(() => {
    if (!isOpen) return
    const now = new Date()
    now.setSeconds(0, 0)
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
    setForm({ ...EMPTY_FORM, startedAt: local })
    setErrors({})
    setTimeout(() => firstInputRef.current?.focus(), 80)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  const set = useCallback((field, value) => {
    setForm(f => ({ ...f, [field]: value }))
    setErrors(e => ({ ...e, [field]: undefined }))
  }, [])

  const validate = () => {
    const e = {}
    if (!form.region) e.region = 'Please select a region'
    if (!form.town.trim()) e.town = 'Town or area is required'
    if (!form.severity) e.severity = 'Please select a severity level'
    if (!form.description.trim()) e.description = 'Description is required'
    else if (form.description.trim().length < 10) e.description = 'Please add more detail (min 10 characters)'
    return e
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setSubmitting(true)
    await new Promise(r => setTimeout(r, 500))
    onSubmit({ ...form, town: form.town.trim(), description: form.description.trim() })
    setSubmitting(false)
    onClose()
  }

  const canSubmit = !submitting &&
    form.region && form.town.trim() && form.severity && form.description.trim().length >= 10

  if (!isOpen) return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
      >
        {/* Header */}
        <div
          className="sticky top-0 z-10 flex items-center gap-3 px-6 py-4 border-b"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
        >
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(255,176,0,0.12)', border: '1px solid rgba(255,176,0,0.2)' }}
          >
            <Zap className="w-5 h-5" style={{ color: '#FFB000' }} />
          </div>
          <div>
            <h2 className="font-extrabold text-base" style={{ color: 'var(--text-1)' }}>Report Power Outage</h2>
            <p className="text-xs" style={{ color: 'var(--text-3)' }}>Help the community stay informed</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto p-2 rounded-xl transition-opacity hover:opacity-60"
            style={{ color: 'var(--text-3)' }}
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="px-6 py-5 space-y-5">

          {/* Region */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-2)' }}>
              Region <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <div className="relative">
              <select
                ref={firstInputRef}
                value={form.region}
                onChange={e => set('region', e.target.value)}
                className="w-full appearance-none px-3.5 py-2.5 rounded-xl text-sm outline-none border pr-9 transition-colors"
                style={{
                  background: 'var(--bg-input)',
                  borderColor: errors.region ? '#EF4444' : 'var(--border)',
                  color: form.region ? 'var(--text-1)' : 'var(--text-3)',
                }}
              >
                <option value="">Select region...</option>
                {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: 'var(--text-3)' }} />
            </div>
            {errors.region && <p className="text-xs mt-1" style={{ color: '#EF4444' }}>{errors.region}</p>}
          </div>

          {/* Town */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-2)' }}>
              Town / Area <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <div className="relative">
              <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-3)' }} />
              <input
                type="text"
                value={form.town}
                onChange={e => set('town', e.target.value)}
                placeholder="e.g. Madina, Kumasi Central, Takoradi..."
                className="w-full pl-9 pr-3.5 py-2.5 rounded-xl text-sm outline-none border transition-colors"
                style={{
                  background: 'var(--bg-input)',
                  borderColor: errors.town ? '#EF4444' : 'var(--border)',
                  color: 'var(--text-1)',
                }}
              />
            </div>
            {errors.town && <p className="text-xs mt-1" style={{ color: '#EF4444' }}>{errors.town}</p>}
          </div>

          {/* Severity */}
          <div>
            <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--text-2)' }}>
              Severity <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {SEVERITIES.map(sev => (
                <button
                  key={sev.value}
                  type="button"
                  onClick={() => set('severity', sev.value)}
                  className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border text-left transition-all"
                  style={{
                    background: form.severity === sev.value ? `${sev.color}18` : 'var(--bg-input)',
                    borderColor: form.severity === sev.value
                      ? sev.color
                      : errors.severity ? '#EF4444' : 'var(--border)',
                  }}
                >
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: sev.color }} />
                  <div className="min-w-0">
                    <div className="text-xs font-bold leading-tight" style={{ color: form.severity === sev.value ? sev.color : 'var(--text-1)' }}>
                      {sev.label}
                    </div>
                    <div className="text-[10px] leading-tight mt-0.5" style={{ color: 'var(--text-3)' }}>
                      {sev.desc}
                    </div>
                  </div>
                </button>
              ))}
            </div>
            {errors.severity && <p className="text-xs mt-1" style={{ color: '#EF4444' }}>{errors.severity}</p>}
          </div>

          {/* Start Time */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-2)' }}>
              Outage Start Time
              <span className="font-normal ml-1" style={{ color: 'var(--text-3)' }}>(defaults to now)</span>
            </label>
            <div className="relative">
              <Clock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: 'var(--text-3)' }} />
              <input
                type="datetime-local"
                value={form.startedAt}
                onChange={e => set('startedAt', e.target.value)}
                max={new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)}
                className="w-full pl-9 pr-3.5 py-2.5 rounded-xl text-sm outline-none border transition-colors"
                style={{
                  background: 'var(--bg-input)',
                  borderColor: 'var(--border)',
                  color: 'var(--text-1)',
                  colorScheme: 'dark',
                }}
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-2)' }}>
              Description <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <div className="relative">
              <FileText className="absolute left-3.5 top-3 w-4 h-4" style={{ color: 'var(--text-3)' }} />
              <textarea
                value={form.description}
                onChange={e => set('description', e.target.value)}
                placeholder="Describe the outage — affected streets, estimated homes, any ECG updates or announcements..."
                rows={3}
                className="w-full pl-9 pr-3.5 py-2.5 rounded-xl text-sm outline-none border resize-none transition-colors"
                style={{
                  background: 'var(--bg-input)',
                  borderColor: errors.description ? '#EF4444' : 'var(--border)',
                  color: 'var(--text-1)',
                }}
              />
            </div>
            <div className="flex justify-between mt-1">
              {errors.description
                ? <p className="text-xs" style={{ color: '#EF4444' }}>{errors.description}</p>
                : <span />}
              <span className="text-xs ml-auto" style={{ color: 'var(--text-3)' }}>
                {form.description.length} / 500
              </span>
            </div>
          </div>

          {/* Phone (optional) */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-2)' }}>
              Phone Number
              <span className="font-normal ml-1" style={{ color: 'var(--text-3)' }}>(optional)</span>
            </label>
            <div className="relative">
              <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-3)' }} />
              <input
                type="tel"
                value={form.phone}
                onChange={e => set('phone', e.target.value)}
                placeholder="0XX XXX XXXX"
                className="w-full pl-9 pr-3.5 py-2.5 rounded-xl text-sm outline-none border transition-colors"
                style={{
                  background: 'var(--bg-input)',
                  borderColor: 'var(--border)',
                  color: 'var(--text-1)',
                }}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1 pb-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all hover:opacity-80"
              style={{ borderColor: 'var(--border)', color: 'var(--text-2)', background: 'transparent' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all"
              style={{
                background: canSubmit
                  ? 'linear-gradient(135deg, #FFB000 0%, #D99600 100%)'
                  : 'rgba(255,176,0,0.25)',
                boxShadow: canSubmit ? '0 4px 16px rgba(255,176,0,0.3)' : 'none',
                color: canSubmit ? '#0F172A' : 'rgba(15,23,42,0.4)',
                cursor: canSubmit ? 'pointer' : 'not-allowed',
                transform: canSubmit ? undefined : 'none',
              }}
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Submitting...
                </span>
              ) : 'Submit Report'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
