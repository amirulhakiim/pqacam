import type { PublicProduct } from '../../server/catalog'
import { VideoThumb } from '../VideoThumb'

export function ProductGrid({ products, onOpen }: { products: PublicProduct[]; onOpen: (id: number) => void }) {
  return (
    <div className="pp-grid">
      {products.map((p) => {
        const cover = p.media.find((m) => m.type === 'photo')
        // A product with only videos shows the first one's opening frame.
        const firstVideo = cover ? undefined : p.media.find((m) => m.type === 'video')
        return (
          <button type="button" key={p.id} className="pp-tile" onClick={() => onOpen(p.id)}>
            <div className="pp-cover" data-protect="">
              {cover && <img src={cover.url} alt="" loading="lazy" draggable={false} />}
              {firstVideo && <VideoThumb url={firstVideo.url} />}
            </div>
            <span className="pp-tile-name">{p.shortName || p.name}</span>
          </button>
        )
      })}
    </div>
  )
}
