import { createContext, useContext, useEffect, useState, useCallback } from 'react'

const ThemeContext = createContext({})

export function ThemeProvider({ children }) {
  // Existing saved 'dark' or 'light' values keep working; defaults to 'light'
  const [mode, setModeState] = useState(() => {
    return localStorage.getItem('ap-theme') || 'light'
  })

  const [systemIsDark, setSystemIsDark] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  // Listen to system OS theme changes
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const listener = (e) => setSystemIsDark(e.matches)
    media.addEventListener('change', listener)
    return () => media.removeEventListener('change', listener)
  }, [])

  // Resolved theme: 'light' or 'dark'
  const resolvedTheme = mode === 'system' ? (systemIsDark ? 'dark' : 'light') : mode

  useEffect(() => {
    const root = document.documentElement
    if (resolvedTheme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    localStorage.setItem('ap-theme', mode)
  }, [mode, resolvedTheme])

  const setMode = useCallback((newMode) => {
    setModeState(newMode)
  }, [])

  const toggle = useCallback(() => {
    setModeState(current => {
      if (current === 'system') {
        return systemIsDark ? 'light' : 'dark'
      }
      return current === 'dark' ? 'light' : 'dark'
    })
  }, [systemIsDark])

  return (
    <ThemeContext.Provider value={{
      theme: resolvedTheme, // Backward compatible 'light' | 'dark'
      resolvedTheme,
      mode,                 // 'light' | 'dark' | 'system'
      setMode,
      toggle
    }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
