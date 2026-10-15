import { PLATFORM_LABEL } from '../../lib/platforms'
import type { PublicProduct } from '../../server/catalog'
import { VideoThumb } from '../VideoThumb'

export function ProductGrid({ products, onOpen }: { products: PublicProduct[]; onOpen: (id: number) => void }) {
  return (
    <div className="pp-grid">
      {products.map((p) => {
        const cover = p.media.find((m) => m.type === 'photo')
        // A product with only videos shows the first one's opening frame.
        const firstVideo = cover ? undefined : p.media.find((m) => m.type === 'video')
        const photos = p.media.filter((m) => m.type === 'photo').length
        const hasVideo = p.media.length > photos
        return (
          <button type="button" key={p.id} className="pp-card" onClick={() => onOpen(p.id)}>
            <div className="pp-cover" data-protect="">
              {cover && <img src={cover.url} alt="" loading="lazy" draggable={false} />}
              {firstVideo && <VideoThumb url={firstVideo.url} />}
              {p.media.length > 0 && (
                <span className="pp-count">
                  {photos}
                  {hasVideo ? ' · ▶' : ''}
                </span>
              )}
            </div>
            <div className="pp-card-body">
              <div className="pp-card-name">{p.name}</div>
              {p.price && <div className="pp-card-price">{p.price}</div>}
              <div className="pp-chips">
                {p.platforms.map((k) => (
                  <span key={k} className={`chip chip-${k}`}>
                    {PLATFORM_LABEL[k].chip}
                  </span>
                ))}
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}
