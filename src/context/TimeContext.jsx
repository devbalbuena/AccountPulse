import { createContext, useContext, useState, useEffect } from 'react'

const TimeContext = createContext(Date.now())

/**
 * Single application-wide time provider.
 * Drives a unified 1-second clock across all countdowns, chips, and badges.
 * Automatically pauses when the tab is hidden and syncs immediately upon focus.
 */
export function TimeProvider({ children }) {
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    let tick = null

    const updateNow = () => setNow(Date.now())

    const start = () => {
      if (!tick) {
        tick = setInterval(updateNow, 1000)
      }
    }

    const stop = () => {
      if (tick) {
        clearInterval(tick)
        tick = null
      }
    }

    const handleVisibility = () => {
      if (document.hidden) {
        stop()
      } else {
        updateNow()
        start()
      }
    }

    if (!document.hidden) {
      start()
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      stop()
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [])

  return (
    <TimeContext.Provider value={now}>
      {children}
    </TimeContext.Provider>
  )
}

/**
 * Hook to consume the synchronized 1-second clock tick.
 * Guaranteed to flip all countdowns and status chips in the same render cycle.
 */
export function useNow() {
  return useContext(TimeContext)
}
