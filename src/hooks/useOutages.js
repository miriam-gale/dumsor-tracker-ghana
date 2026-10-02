import { useState, useCallback } from 'react'
import { STATUS, SEVERITY } from '../data/outages'

let nextId = 1

function computeDuration(startedAt) {
  if (!startedAt) return 'Unknown'
  const diff = Date.now() - new Date(startedAt).getTime()
  if (diff <= 0) return 'Just started'
  const h = Math.floor(diff / 3_600_000)
  const m = Math.floor((diff % 3_600_000) / 60_000)
  if (h === 0) return m <= 1 ? 'Just started' : `${m} mins`
  if (h < 24) return m === 0 ? `${h}h` : `${h}h ${m}m`
  const d = Math.floor(h / 24)
  const rh = h % 24
  return rh === 0 ? `${d}d` : `${d}d ${rh}h`
}

export function useOutages() {
  const [outages, setOutages] = useState([])

  const addOutage = useCallback((formData) => {
    const newOutage = {
      id:            String(nextId++),
      region:        formData.region,
      town:          formData.town,
      area:          formData.area || '',
      severity:      formData.severity || SEVERITY.MEDIUM,
      description:   formData.description,
      reporter:      formData.reporter || '',
      phone:         formData.phone || '',
      email:         formData.email || '',
      startedAt:     formData.startedAt,
      duration:      computeDuration(formData.startedAt),
      status:        STATUS.ACTIVE,
      timestamp:     new Date().toISOString(),
      lat:           null,
      lng:           null,
      affectedHomes: Math.floor(Math.random() * 800) + 50,
    }
    setOutages(prev => [newOutage, ...prev])
    return newOutage
  }, [])

  const updateStatus = useCallback((id, status) => {
    setOutages(prev => prev.map(o => o.id === id ? { ...o, status } : o))
  }, [])

  const active = outages.filter(o => o.status === STATUS.ACTIVE)

  const stats = {
    total:           outages.length,
    active:          active.length,
    resolved:        outages.filter(o => o.status === STATUS.RESOLVED).length,
    scheduled:       outages.filter(o => o.status === STATUS.SCHEDULED).length,
    critical:        outages.filter(o => o.severity === SEVERITY.CRITICAL && o.status === STATUS.ACTIVE).length,
    regionsAffected: new Set(active.map(o => o.region)).size,
  }

  return { outages, addOutage, updateStatus, stats }
}
