import { useEffect, useState } from 'react'

export function BackToTop({ bottom = false }: { bottom?: boolean }) {
  const [shown, setShown] = useState({ top: false, bottom: false })
  useEffect(() => {
    const update = () => {
      const below = document.documentElement.scrollHeight - window.innerHeight - window.scrollY
      setShown((s) => (s.top === window.scrollY > 600 && s.bottom === below > 600 ? s : { top: window.scrollY > 600, bottom: below > 600 }))
    }
    update()
    const resize = new ResizeObserver(update)
    resize.observe(document.body)
    window.addEventListener('scroll', update, { passive: true })
    return () => {
      resize.disconnect()
      window.removeEventListener('scroll', update)
    }
  }, [])
  const down = bottom && shown.bottom
  if (!shown.top && !down) return null
  return (
    <div className="scroll-btns">
      {shown.top && (
        <button type="button" className="to-top" aria-label="Back to top" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          ↑
        </button>
      )}
      {down && (
        <button
          type="button"
          className="to-top"
          aria-label="Go to bottom"
          onClick={() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' })}
        >
          ↓
        </button>
      )}
    </div>
  )
}
