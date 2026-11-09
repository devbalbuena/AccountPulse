import { useEffect } from 'react'

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Accessibility (a11y) Focus Trap & Keyboard Escape Hook
 * Traps Tab / Shift+Tab focus inside an open drawer or modal container,
 * focuses the first interactive element on open, restores focus on close,
 * and invokes onClose when Escape is pressed.
 */
export function useFocusTrap(containerRef, isOpen, onClose) {
  useEffect(() => {
    if (!isOpen || !containerRef?.current) return

    const container = containerRef.current
    const previouslyFocused = document.activeElement

    // Focus first focusable element inside the container
    const focusables = Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR))
    if (focusables.length > 0) {
      focusables[0].focus()
    } else {
      container.focus()
    }

    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        if (typeof onClose === 'function') onClose()
        return
      }

      if (e.key !== 'Tab') return

      const nodes = Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR))
      if (nodes.length === 0) {
        e.preventDefault()
        return
      }

      const first = nodes[0]
      const last = nodes[nodes.length - 1]

      if (e.shiftKey) {
        if (document.activeElement === first || !container.contains(document.activeElement)) {
          e.preventDefault()
          last.focus()
        }
      } else {
        if (document.activeElement === last || !container.contains(document.activeElement)) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
        try {
          previouslyFocused.focus()
        } catch {
          // ignore focus restoration errors
        }
      }
    }
  }, [isOpen, containerRef, onClose])
}
