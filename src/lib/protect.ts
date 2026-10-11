import { useEffect, useState } from 'react'

// Deters casual saves. It does not stop a screenshot, and the media URLs are public.
export function useMediaProtection() {
  const [hidden, setHidden] = useState(false)
  useEffect(() => {
    const block = (e: Event) => {
      if (e.target instanceof Element && e.target.closest('[data-protect]')) e.preventDefault()
    }
    const hide = () => setHidden(true)
    const show = () => setHidden(false)
    const visibility = () => setHidden(document.hidden)
    document.addEventListener('contextmenu', block)
    document.addEventListener('dragstart', block)
    document.addEventListener('visibilitychange', visibility)
    window.addEventListener('blur', hide)
    window.addEventListener('focus', show)
    return () => {
      document.removeEventListener('contextmenu', block)
      document.removeEventListener('dragstart', block)
      document.removeEventListener('visibilitychange', visibility)
      window.removeEventListener('blur', hide)
      window.removeEventListener('focus', show)
    }
  }, [])
  return hidden
}
