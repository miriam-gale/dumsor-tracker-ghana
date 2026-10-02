import { useState, useEffect } from 'react'

export function useDarkMode() {
  const [dark, setDarkState] = useState(() => {
    try {
      const stored = localStorage.getItem('dumsor-dark-mode')
      return stored !== null
        ? stored === 'true'
        : window.matchMedia('(prefers-color-scheme: dark)').matches
    } catch {
      return false
    }
  })

  const setDark = (value) => {
    const root = document.documentElement
    if (value) {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    try {
      localStorage.setItem('dumsor-dark-mode', String(value))
    } catch {}
    setDarkState(value)
  }

  useEffect(() => {
    const root = document.documentElement
    if (dark) root.classList.add('dark')
    else root.classList.remove('dark')
  }, [])

  return [dark, setDark]
}
