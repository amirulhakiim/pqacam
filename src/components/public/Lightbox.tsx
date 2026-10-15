import { useEffect, useRef } from 'react'
import { wrap } from '../../lib/filter'
import type { PublicProduct } from '../../server/catalog'

type Props = { media: PublicProduct['media']; index: number; onIndex: (i: number) => void; hidden: boolean; onClose: () => void }

export function Lightbox({ media, index, onIndex, hidden, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const track = useRef<HTMLDivElement>(null)
  const current = wrap(index, media.length)

  useEffect(() => {
    ref.current?.showModal()
    const el = track.current
    if (el) el.scrollLeft = current * el.clientWidth
  }, [])

  const go = (step: number) => {
    const el = track.current
    if (!el || media.length < 2) return
    el.scrollTo({ left: wrap(current + step, media.length) * el.clientWidth, behavior: 'smooth' })
  }

  return (
    <dialog
      ref={ref}
      className="pp-lightbox"
      aria-label="Photos and videos"
      onClose={onClose}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'ArrowLeft') go(-1)
        if (e.key === 'ArrowRight') go(1)
      }}
      onClick={(e) => {
        e.stopPropagation()
        if (!(e.target as HTMLElement).closest('img, video, button')) ref.current?.close()
      }}
    >
      <div className="pp-lightbox-stage" data-protect="">
        <div
          className="pp-lightbox-track"
          ref={track}
          onScroll={(e) => {
            const el = e.currentTarget
            const i = Math.round(el.scrollLeft / el.clientWidth)
            if (i !== current && i >= 0 && i < media.length) onIndex(i)
          }}
        >
          {media.map((item, i) => (
            <div className="pp-lightbox-slide" key={item.url}>
              {item.type === 'photo' ? (
                <img src={item.url} alt="" draggable={false} />
              ) : (
                i === current && (
                  <video src={item.url} controls autoPlay playsInline disablePictureInPicture controlsList="nodownload noplaybackrate noremoteplayback" />
                )
              )}
            </div>
          ))}
        </div>
        {hidden && <div className="pp-protected">Content protected</div>}
      </div>
      <button type="button" className="pp-round pp-lightbox-close" onClick={() => ref.current?.close()} aria-label="Close">
        ✕
      </button>
      {media.length > 1 && (
        <>
          <div className="pp-counter pp-lightbox-counter">
            {current + 1} / {media.length}
          </div>
          <button type="button" className="pp-round pp-prev" onClick={() => go(-1)} aria-label="Previous">
            ‹
          </button>
          <button type="button" className="pp-round pp-next" onClick={() => go(1)} aria-label="Next">
            ›
          </button>
        </>
      )}
    </dialog>
  )
}
