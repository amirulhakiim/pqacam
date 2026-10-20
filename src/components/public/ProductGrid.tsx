import type { PublicProduct } from '../../server/catalog'
import { VideoThumb } from '../VideoThumb'

type Props = { products: PublicProduct[]; onOpen: (id: number) => void; list?: boolean }

export function ProductGrid({ products, onOpen, list }: Props) {
  return (
    <div className={list ? 'pp-list' : 'pp-grid'}>
      {products.map((p) => {
        const cover = p.media.find((m) => m.type === 'photo')
        // A product with only videos shows the first one's opening frame.
        const firstVideo = cover ? undefined : p.media.find((m) => m.type === 'video')
        return (
          <button type="button" key={p.id} className={list ? 'pp-row' : 'pp-tile'} onClick={() => onOpen(p.id)}>
            <div className="pp-cover" data-protect="">
              {cover && <img src={cover.url} alt="" loading="lazy" draggable={false} />}
              {firstVideo && <VideoThumb url={firstVideo.url} />}
            </div>
            {list ? (
              <span className="pp-row-text">
                <span className="pp-row-name">{p.name}</span>
                <span className="pp-row-meta">{p.price}</span>
              </span>
            ) : (
              <span className="pp-tile-name">{p.shortName || p.name}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
