import { useEffect, useRef } from 'react'
import { wrap } from '../../lib/filter'
import type { PublicProduct } from '../../server/catalog'

type Props = { media: PublicProduct['media']; index: number; onIndex: (i: number) => void; hidden: boolean; onClose: () => void }

// Full screen, contained (not cropped), with arrows, swipe and the keyboard. A native dialog, so Escape and focus work.
export function Lightbox({ media, index, onIndex, hidden, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const swipeStart = useRef<number | null>(null)
  // A swipe also ends in a click. This stops that click from closing the view.
  const swiped = useRef(false)
  const current = wrap(index, media.length)
  const item = media[current]
  useEffect(() => ref.current?.showModal(), [])
  const go = (step: number) => media.length > 1 && onIndex(current + step)

  return (
    <dialog
      ref={ref}
      className="pp-lightbox"
      aria-label="Photos and videos"
      onClose={onClose}
      onKeyDown={(e) => {
        // The product sheet closes on Escape too. This dialog takes the key first.
        e.stopPropagation()
        if (e.key === 'ArrowLeft') go(-1)
        if (e.key === 'ArrowRight') go(1)
      }}
      onClick={(e) => {
        // React passes clicks up its own tree, and the sheet's backdrop closes the product on a click.
        // Stopping here means ✕ or a click beside the photo closes only this view.
        e.stopPropagation()
        if (swiped.current) return void (swiped.current = false)
        if (e.target === ref.current || e.target === e.currentTarget.querySelector('.pp-lightbox-stage')) ref.current?.close()
      }}
    >
      <div
        className="pp-lightbox-stage"
        data-protect=""
        onPointerDown={(e) => {
          swipeStart.current = e.clientX
        }}
        onPointerUp={(e) => {
          const dx = e.clientX - (swipeStart.current ?? e.clientX)
          swipeStart.current = null
          swiped.current = Math.abs(dx) > 8
          if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1)
        }}
      >
        {item.type === 'photo' ? (
          <img src={item.url} alt="" draggable={false} />
        ) : (
          <video key={item.url} src={item.url} controls autoPlay playsInline disablePictureInPicture controlsList="nodownload noplaybackrate noremoteplayback" />
        )}
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
