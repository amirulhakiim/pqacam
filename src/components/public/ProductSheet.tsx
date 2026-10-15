import { useEffect, useRef, useState } from 'react'
import { wrap } from '../../lib/filter'
import { PLATFORM_LABEL } from '../../lib/platforms'
import type { PublicProduct } from '../../server/catalog'
import { PLATFORMS } from '../../server/validate'

type Props = { product: PublicProduct; hidden: boolean; onClose: () => void }

export function ProductSheet({ product, hidden, onClose }: Props) {
  const { media } = product
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const swipeStart = useRef<number | null>(null)
  const current = media.length ? wrap(index, media.length) : 0

  useEffect(() => {
    if (paused || media.length < 2) return
    const timer = setTimeout(() => setIndex((i) => i + 1), media[current].type === 'video' ? 7000 : 3500)
    return () => clearTimeout(timer)
  }, [current, paused, media])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const go = (i: number) => {
    setIndex(i)
    setPaused(true)
  }

  return (
    <div className="pp-backdrop" onClick={onClose}>
      <div className="pp-sheet" role="dialog" aria-modal="true" aria-label={product.name} onClick={(e) => e.stopPropagation()}>
        <div className="pp-grip" />
        <div
          className="pp-stage"
          data-protect=""
          onPointerDown={(e) => {
            swipeStart.current = e.clientX
          }}
          onPointerUp={(e) => {
            const dx = e.clientX - (swipeStart.current ?? e.clientX)
            swipeStart.current = null
            if (Math.abs(dx) > 40) go(current + (dx < 0 ? 1 : -1))
          }}
        >
          <div className="pp-track" style={{ transform: `translateX(${-current * 100}%)` }}>
            {media.map((m, i) => (
              <div className="pp-slide" key={m.url}>
                {m.type === 'photo' && <img src={m.url} alt="" draggable={false} />}
                {m.type === 'video' && i === current && (
                  <video
                    src={m.url}
                    autoPlay
                    muted
                    loop
                    playsInline
                    disablePictureInPicture
                    controlsList="nodownload noplaybackrate noremoteplayback"
                  />
                )}
                {m.type === 'video' && <span className="pp-video-tag">▶ Video</span>}
              </div>
            ))}
          </div>
          {hidden && <div className="pp-protected">Content protected</div>}
          <button type="button" className="pp-round pp-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
          {media.length > 1 && (
            <>
              <div className="pp-counter">
                {current + 1} / {media.length}
              </div>
              <button type="button" className="pp-round pp-prev" onClick={() => go(current - 1)} aria-label="Previous">
                ‹
              </button>
              <button type="button" className="pp-round pp-next" onClick={() => go(current + 1)} aria-label="Next">
                ›
              </button>
              <div className="pp-dots">
                {media.map((m, i) => (
                  <button
                    type="button"
                    key={m.url}
                    className={i === current ? 'pp-dot pp-dot-on' : 'pp-dot'}
                    onClick={() => go(i)}
                    aria-label={`Go to slide ${i + 1}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
        <div className="pp-title">
          <div className="eyebrow pp-category">{product.category}</div>
          <div className="pp-title-row">
            <h2>{product.name}</h2>
            {product.price && <div className="pp-price">{product.price}</div>}
          </div>
        </div>
        {/* Under the title, not at the end, so the buttons show without scrolling. */}
        <div className="pp-buy">
          {PLATFORMS.map((k) => {
            const links = product.links.filter((l) => l.platform === k)
            if (links.length === 1) {
              const [l] = links
              return (
                <a key={k} className={`pp-buy-button buy-${k}`} href={`/go/${l.id}`} target="_blank" rel="noopener">
                  {l.label ? `${PLATFORM_LABEL[k].chip} · ${l.label}` : PLATFORM_LABEL[k].buy} <span>→</span>
                </a>
              )
            }
            // Several links for one shop: one button that opens the list, so the sheet does not fill with buttons.
            return (
              links.length > 1 && (
                <details key={k} className="pp-buy-group">
                  <summary className={`pp-buy-button buy-${k}`}>
                    {PLATFORM_LABEL[k].buy}
                    <span className="pp-buy-count">{links.length} options</span>
                    <span className="pp-buy-caret" aria-hidden="true">
                      ▾
                    </span>
                  </summary>
                  <div className="pp-buy-options">
                    {links.map((l, i) => (
                      <a key={l.id} className="pp-buy-option" href={`/go/${l.id}`} target="_blank" rel="noopener">
                        {l.label || `Option ${i + 1}`} <span>→</span>
                      </a>
                    ))}
                  </div>
                </details>
              )
            )
          })}
        </div>
        {product.review && (
          <div className="pp-review">
            <div className="pp-review-title">My honest review</div>
            <p>{product.review}</p>
          </div>
        )}
      </div>
    </div>
  )
}
