# Future: resized photos at the edge

Status: to consider. Not started. Written 2026-10-16.

## Contents

- [1. Summary](#1-summary)
- [2. Current state](#2-current-state)
- [3. Proposed design](#3-proposed-design)
- [4. Work](#4-work)
- [5. Cost](#5-cost)
- [6. Risks and open questions](#6-risks-and-open-questions)
- [7. Decisions](#7-decisions)

---

## 1. Summary

```mermaid
flowchart LR
    A["Admin browser"] -->|"upload original"| B["R2 bucket"]
    B --> C["Cloudflare Image Transformations"]
    C -->|"AVIF or WebP at the width asked"| D["Cloudflare edge cache"]
    D --> E["Visitor phone"]
```

Every visitor gets the same 2048 px JPEG today, so a phone downloads about 600 KB for a small grid cover. Cloudflare Image Transformations can resize and convert each photo when it is asked for, and the edge caches the result. A grid cover then drops to about 40 to 80 KB.

| Add when | Signal |
|---|---|
| The public page feels slow on mobile data | Lighthouse or real phones show the grid images as the largest download |
| The app becomes a SaaS with many sellers | Bandwidth and page speed start to matter for every tenant |

## 2. Current state

| Layer | Today | Gap |
|---|---|---|
| Storage | Browser uploads straight to R2 with a presigned URL | Photos are resized to 2048 px at 90% JPEG before upload, so the true original is not kept |
| Processing | None for photos. Videos are encoded on the server at CRF 18, up to 1080p, at most 50 MB | No resize or format change for each screen |
| Edge cache | `media.pqacam.com` is a Cloudflare custom domain on the R2 bucket | None |
| Frontend | Plain `<img src>` with one URL | No `srcset` or `sizes` |

## 3. Proposed design

A photo URL gains a transform prefix on the media domain:

```
https://media.pqacam.com/cdn-cgi/image/width=640,format=auto,quality=85/photo/<uuid>.jpg
```

| Part | Choice |
|---|---|
| Widths | 320, 640, 1080, 2048. Few widths keep the number of unique transformations low |
| Format | `format=auto`: AVIF or WebP by browser, JPEG as the fallback |
| Frontend | Native `srcset` and `sizes` on `<img>`. No library |
| Switch | `MEDIA_TRANSFORM=off` serves the plain URL, for local development and as a fallback |
| Videos | Unchanged. See the decisions table |

| Place | `sizes` |
|---|---|
| Public grid cover | `50vw` |
| Product sheet carousel | `min(100vw, 40vh)` |
| Full screen lightbox | `100vw` |
| Admin thumbnails | `96px` |

## 4. Work

1. In the Cloudflare dashboard, turn on Image Transformations for the `pqacam.com` zone.
2. Add a helper that builds the transform URL and the `srcset` string for a media key.
3. Use it in the grid, the product sheet, the lightbox, and the admin thumbnails.
4. Add `MEDIA_TRANSFORM` to `.env.example` and the setup guides.
5. Optional: upload original photos instead of the 2048 px copy. Remove the resize in `useUploads.ts` and `useProductUploads.ts`, and raise the `photo` upload limit in `validate.ts`.
6. Check on a real phone that covers load as AVIF or WebP at the small width.

| Item | Estimate |
|---|---|
| Steps 1 to 4 and 6 | About half a day |
| Step 5 | About one hour, plus testing HEIC uploads |

## 5. Cost

A unique transformation is one photo at one set of options, counted once a month however many visitors see it.

| Plan | Included | After that |
|---|---|---|
| Free | 5,000 unique transformations a month | New sizes return error `9422`. Cached ones keep working. No charge |
| Paid | 5,000 unique transformations a month | USD 0.50 per 1,000 |

| Scenario | Unique transformations a month | Cost |
|---|---|---|
| One shop: 50 products, 5 photos, 3 widths | About 750 | Free |
| SaaS: 1,000 sellers at the same size | About 750,000 | About USD 375 a month, about RM 1.60 per seller |

At RM 21 average revenue per seller, the second scenario lowers the gross margin from about 88% to about 80%.

## 6. Risks and open questions

| Question | Default if there is no answer |
|---|---|
| Does Cloudflare accept HEIC input? The pricing page does not say | Keep converting to JPEG in the browser |
| Upload originals or keep the 2048 px copy? | Keep the 2048 px copy. It is already sharp full screen |
| Watermarked photos are made on the server. Full-size originals make that slower | Accept it. A photo still takes about a second |
| Free plan limit reached as the catalogue grows | Move the zone to a paid plan, or drop the 320 width |

## 7. Decisions

| Decision | Chosen | Rejected | Why |
|---|---|---|---|
| Image processing vendor | Cloudflare Image Transformations | Cloudinary, Imgix, Bunny.net | R2 and the media domain are already on Cloudflare. No new account, no egress between vendors |
| Frontend integration | Native `srcset` and `sizes` | A framework image component | The app uses TanStack Start, not Next.js. The browser picks the width with no library |
| Video delivery | Keep 1080p MP4 with `faststart` | Cloudflare Stream adaptive streaming | Stream bills per minute stored and watched, and is several days of work. Product clips are short and already capped at 50 MB |

Source: [Cloudflare Images pricing](https://developers.cloudflare.com/images/pricing/).
