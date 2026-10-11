# pqacam: product requirements

## Contents

- [1. Summary](#1-summary)
- [2. Goals and success criteria](#2-goals-and-success-criteria)
- [3. Architecture](#3-architecture)
- [4. Decisions](#4-decisions)
- [5. Public page](#5-public-page)
- [6. Admin](#6-admin)
- [7. Data model](#7-data-model)
- [8. Routes](#8-routes)
- [9. Media](#9-media)
- [10. Deployment](#10-deployment)
- [11. Out of scope](#11-out-of-scope)
- [12. Open questions](#12-open-questions)

---

## 1. Summary

pqacam is a personal page in the style of beacons.ai, for one owner. Visitors browse product finds, read the owner's review, and tap a link to buy.

| Part | Who uses it | What it does |
|---|---|---|
| Public page | Visitors, mostly on phones | Shows products with search, category tabs, a platform filter, and buy buttons |
| Admin | pqacam and other approved Google accounts | Adds and edits products, categories, profile, and the list of approved accounts |

The visual reference is the Claude Design prototype in [`design/`](../design). The prototype stores data in `localStorage`. This product replaces that with a server, a database, and object storage.

## 2. Goals and success criteria

| Goal | Success criterion |
|---|---|
| The owner publishes a product without help | From sign-in to a live product with 3 photos in less than 2 minutes on a phone |
| Visitors find and open a buy link quickly | From page load to a tap on a buy button in 3 taps or fewer |
| The page loads fast on mobile data | Largest Contentful Paint less than 2.5 s on a simulated 4G connection with 50 products |
| The admin stays simple | 4 tabs. No theme, color, font, or layout settings |
| The owner sees which links get taps | Each product shows a click count for each platform |
| Shared links show a preview | A link pasted in WhatsApp shows the page name, bio, and avatar |
| Operation costs little | One container on the existing Dokploy server. R2 use stays in the free 10 GB tier |

## 3. Architecture

```mermaid
flowchart LR
    V["Visitor, phone browser"]
    A["Admin, pqacam"]
    subgraph D["Dokploy server"]
        T["Traefik, TLS"]
        subgraph C["App container"]
            S["TanStack Start on Bun"]
            DB[("SQLite, file on volume /data")]
        end
    end
    G["Google OAuth"]
    R["Cloudflare R2, public media domain"]
    V --> T
    A --> T
    T --> S
    S --> DB
    S -->|"sign-in"| G
    A -->|"direct upload, presigned URL"| R
    V -->|"photos and videos"| R
```

```embed height=560
diagrams/architecture.html
```

## 4. Decisions

| Decision | Chosen | Rejected | Why |
|---|---|---|---|
| Framework | TanStack Start (React, SSR) | Next.js, SvelteKit | Owner's choice. SSR gives share previews. Server functions cover the admin API |
| Runtime and package manager | Bun | Node with npm | Owner's choice. Bun includes a SQLite driver, so there is no native module to build |
| Database | SQLite file on a Dokploy volume, Drizzle ORM, `bun:sqlite` driver | Postgres service | One owner and hundreds of rows. No second service to operate |
| Admin sign-in | Google OAuth (Arctic library) with an email allowlist. Session in an encrypted cookie (TanStack Start `useSession`) | Single password, Better Auth | Matches the design. No passwords to store. No session tables |
| Media storage | Cloudflare R2, public bucket on a media subdomain | Dokploy volume, MinIO, AWS S3 | No egress fee. The container holds only the database |
| Upload path | The browser uploads to R2 with a presigned PUT URL | Upload through the app | Large files do not go through the container |
| Photo resize | In the browser on a canvas: 1000 px longest side, JPEG quality 0.82, as in the prototype | `sharp` on the server | No image library on the server |
| Video | Upload to R2. 50 MB limit. `mp4`, `webm`, `mov` | The "Paste a video link" field in the prototype | Owner's choice. The owner does not need a second host for videos |
| Click counts | `/go/$productId/$platform` adds 1 to a counter, then redirects | Third-party analytics | One route. No tracking script on the page |
| Order of items | Up and down buttons, as in the prototype | Drag and drop | Works on phones without a library |
| Customization | None. Colors, fonts, and layout are fixed from the design | Theme settings | The owner asked for a simple admin |

## 5. Public page

Source: [`design/Home Finds Links.dc.html`](../design/Home%20Finds%20Links.dc.html).

| Area | Requirement |
|---|---|
| Header | Avatar, page name, handle, bio |
| Search | Field that stays at the top during scroll. Filters by product name, category, and review text in the browser |
| Category tabs | "All", then the categories in admin order |
| Platform filter | Any, Shopee, TikTok, WhatsApp |
| Grid | 2 columns. Each card shows the cover photo, media count, name, price if set, and a chip for each platform that has a link |
| Product sheet | Opens from the bottom. Shows the media carousel, category, name, price if set, "My honest review", and one buy button for each link that is set |
| Carousel | Swipe, arrows, dots, and a counter. Advances automatically: 3.5 s for a photo, 7 s for a video. Stops advancing after the visitor moves it. Videos play muted in a loop |
| Buy buttons | "Buy on Shopee", "Buy on TikTok Shop", "Order via WhatsApp". Each opens `/go/$productId/$platform` in a new tab |
| Empty result | "Nothing here yet" with a link that clears search and filters |
| Hidden products | The server does not send them to the browser |
| Share preview | SSR `title`, `description` from the bio, and Open Graph image from the avatar |
| Footer | Affiliate disclosure line |

### Media protection

| Measure | Behavior |
|---|---|
| Watermark | The handle shows across the media in the sheet |
| Context menu and drag | Blocked on media |
| Focus loss | Sheet media changes to "Content protected" while the window is not in focus |
| Print | The page prints blank |

These measures stop casual saves. They do not stop a phone screenshot, and the media URLs on R2 are public.

## 6. Admin

Source: [`design/Admin.dc.html`](../design/Admin.dc.html).

```mermaid
flowchart TB
    L["/admin/login"] -->|"Continue with Google"| G{"Email in allowlist?"}
    G -->|"no"| E["Error: no admin access"]
    G -->|"yes"| P["Products"]
    P --- C["Categories"]
    P --- F["Profile"]
    P --- X["Admin access"]
    P -->|"Add product, Edit"| W["Product drawer"]
```

| Screen | Requirement |
|---|---|
| Sign-in | One "Continue with Google" button. An email that is not in the allowlist gets the error text from the design |
| Session | The server checks the allowlist on each admin request. A removed email loses access on its next request |
| Products | List with search, thumbnail, category, media count, platform chips, "No buy link" chip, Live/Hidden toggle, up and down buttons, Edit |
| Click counts | Each product row shows the count for each platform. This is an addition to the design |
| Product drawer | Photos and videos, name, category, price (optional text), review with character count, Shopee / TikTok / WhatsApp links, "Show on my page" toggle |
| Drawer media | Add photos (several at one time), add a video, remove, move earlier. The first photo is the cover |
| "Use my number" | Fills the WhatsApp link from the profile number, with an order message that includes the product name |
| Delete product | Two taps: "Delete", then "Tap again to delete". Also deletes the product's media from R2 |
| Validation | Name is required. At least one buy link is required. Each link must start with `https://`. The server applies the same rules |
| Categories | Add, rename, move up and down, delete. Delete is blocked while the category has products. Names are unique |
| Profile | Avatar upload (400 px), page name, handle, bio, WhatsApp number. Changes save automatically |
| Admin access | List of emails. Add and remove. An admin cannot remove their own email |
| Layout | Sidebar at 760 px and wider. Below 760 px: header with tab pills that stays at the top |
| Feedback | A toast confirms each save, as in the design |

## 7. Data model

```mermaid
erDiagram
    CATEGORY ||--o{ PRODUCT : has
    PRODUCT ||--o{ MEDIA : has
    PROFILE {
        int id PK "always 1"
        text name
        text handle
        text bio
        text avatar_key
        text whatsapp
    }
    CATEGORY {
        int id PK
        text name "unique"
        int position
    }
    PRODUCT {
        int id PK
        int category_id FK
        text name
        text price
        text review
        text shopee_url
        text tiktok_url
        text whatsapp_url
        int hidden
        int position
        int shopee_clicks
        int tiktok_clicks
        int whatsapp_clicks
    }
    MEDIA {
        int id PK
        int product_id FK
        text type "photo or video"
        text r2_key
        int position
    }
    ADMIN {
        text email PK
    }
```

| Prototype field | In the product | Reason |
|---|---|---|
| `tag` | Dropped | The prototype sets it to empty for all products and does not show it |
| `tint` | Dropped | It colors the placeholder only. Real products have photos |
| `price` | Kept as text | The owner types "RM 24.90". No arithmetic is done on it |

## 8. Routes

| Route | Access | Purpose |
|---|---|---|
| `/` | Public | The page, SSR |
| `/go/$productId/$platform` | Public | Add 1 to the click count, then redirect (302) to the buy link |
| `/admin` | Allowlist | Admin with 4 tabs |
| `/admin/login` | Public | Sign-in screen |
| `/api/auth/google` | Public | Start the Google OAuth flow |
| `/api/auth/google/callback` | Public | Finish the flow, check the allowlist, set the session cookie |
| `/api/health` | Public | Health check for Dokploy |

Admin reads and writes are TanStack Start server functions. Each function checks the session and the allowlist before it does work.

`/go` redirects only to a link stored on that product. It does not accept a destination from the request, so it cannot be used as an open redirect.

## 9. Media

```mermaid
sequenceDiagram
    participant B as Admin browser
    participant S as App server
    participant R as Cloudflare R2
    B->>B: Resize photo on canvas
    B->>S: Request upload URL with type and size
    S->>S: Check session, type, size limit
    S-->>B: Presigned PUT URL and object key
    B->>R: PUT file
    B->>S: Save product with object keys
    S->>S: Store keys in MEDIA rows
```

| Rule | Value |
|---|---|
| Photo | JPEG, 1000 px longest side, quality 0.82. Avatar: 400 px |
| Video | `mp4`, `webm`, or `mov`. 50 MB maximum |
| Size and type check | The presigned URL signs `Content-Type` and `Content-Length`, so R2 rejects a different file |
| Object key | Random ID from the server. The file name from the device is not used |
| Public URL | `MEDIA_BASE_URL` + object key, served through the Cloudflare CDN |
| Delete | When an admin removes media or deletes a product, the server deletes the objects from R2 |

## 10. Deployment

| Item | Value |
|---|---|
| Build | Multi-stage `Dockerfile` on the `oven/bun:1` image. `bun install --frozen-lockfile`, then `bun run build`. Dokploy builds it from the Git repository |
| Start | The container runs the built server with `bun` and listens on port 3000 |
| Volume | `/data` holds `pqacam.db` in WAL mode |
| Migrations | Drizzle migrations run when the container starts |
| Domain and TLS | Traefik in Dokploy, with a Let's Encrypt certificate |
| Health check | `GET /api/health` returns 200 when the database opens |
| Backup | Dokploy volume backup of `/data` to an R2 bucket, one time each day |
| First admin | When the `ADMIN` table is empty, the server adds `OWNER_EMAIL` |

| Environment variable | Purpose |
|---|---|
| `PUBLIC_URL` | Site origin, used for OAuth callback and Open Graph URLs |
| `SESSION_SECRET` | Key for the session cookie, 32 characters or more |
| `OWNER_EMAIL` | First approved Google account |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google OAuth client |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` | R2 access for presigned URLs and deletes |
| `MEDIA_BASE_URL` | Public origin of the bucket |
| `DATABASE_PATH` | Path of the SQLite file. Default `/data/pqacam.db` |

Setup outside the repository: a Google Cloud OAuth client with the callback URL, an R2 bucket with a custom domain and a CORS rule that permits `PUT` from `PUBLIC_URL`, and DNS records for the site and the media subdomain.

## 11. Out of scope

| Not in version 1 | Add when |
|---|---|
| More than one page or owner | A second person needs their own page |
| Themes, colors, fonts, custom blocks | The owner asks for a different look |
| Cart, payments, orders | Sales move away from Shopee, TikTok, and WhatsApp |
| Click charts by date | A total for each product is not sufficient |
| Video compression on the server | 50 MB videos load too slowly for visitors |
| A URL for each product with its own share preview | The owner frequently shares one product at a time |
| Platforms other than Shopee, TikTok, WhatsApp | The owner sells on a fourth platform |

## 12. Open questions

| Question | Default if there is no answer |
|---|---|
| Full domain name | `pqacam.com`, with media on `media.pqacam.com` |
| Interface language | English, as in the design |
| Do visits from bots count as clicks | Yes. Version 1 has no bot filter |
| Video size limit | 50 MB |
| Footer text | The affiliate line from the design, not editable in admin |
