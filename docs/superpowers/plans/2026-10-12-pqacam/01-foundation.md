# 01. Foundation

Part of the [pqacam implementation plan](README.md). The Global Constraints in that file apply to each task.

## Task 1: Scaffold and Bun server

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `.gitignore`, `server.ts`
- Create: `src/router.tsx`, `src/routes/__root.tsx`, `src/routes/index.tsx`, `src/routes/api/health.ts`, `src/styles.css`

**Interfaces:**
- Consumes: nothing.
- Produces: `bun run dev`, `bun run build`, `bun server.ts`. Route `/api/health` returns `{"ok":true}`.

- [ ] **Step 1: Write the configuration files**

`package.json`:

```json
{
  "name": "pqacam",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "bun --bun vite dev",
    "build": "bun --bun vite build",
    "start": "bun server.ts",
    "test": "bun test",
    "typecheck": "tsc --noEmit",
    "db:generate": "drizzle-kit generate"
  }
}
```

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "moduleResolution": "Bundler",
    "module": "ESNext",
    "target": "ES2022",
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "types": ["bun", "vite/client"]
  },
  "include": ["src", "tests", "server.ts", "vite.config.ts", "drizzle.config.ts"]
}
```

`vite.config.ts`:

```ts
import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'

export default defineConfig({
  server: { port: 3000 },
  plugins: [tanstackStart(), viteReact()],
})
```

`.gitignore`:

```
node_modules
dist
.env
data
*.db
*.db-shm
*.db-wal
```

- [ ] **Step 2: Install dependencies**

```bash
bun add @tanstack/react-start @tanstack/react-router react react-dom drizzle-orm arctic aws4fetch
bun add -d vite @vitejs/plugin-react typescript @types/react @types/react-dom @types/bun drizzle-kit
```

Expected: `bun.lock` is created. `react` is version 19 or later.

- [ ] **Step 3: Write the router and the document**

`src/router.tsx`:

```tsx
import { createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  return createRouter({ routeTree, scrollRestoration: true, defaultNotFoundComponent: () => <p>Not found</p> })
}
```

`src/routes/__root.tsx`:

```tsx
import type { ReactNode } from 'react'
import { Outlet, createRootRoute, HeadContent, Scripts } from '@tanstack/react-router'
import css from '../styles.css?url'

const FONTS =
  'https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600&family=DM+Mono&display=swap'

export const Route = createRootRoute({
  head: () => ({
    meta: [{ charSet: 'utf-8' }, { name: 'viewport', content: 'width=device-width, initial-scale=1' }],
    links: [
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      { rel: 'stylesheet', href: FONTS },
      { rel: 'stylesheet', href: css },
    ],
  }),
  component: () => (
    <Document>
      <Outlet />
    </Document>
  ),
})

function Document({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
```

`src/styles.css` (tokens only for now; later tasks add classes):

```css
:root {
  --bg: oklch(0.97 0.01 75);
  --surface: oklch(0.99 0.004 80);
  --ink: oklch(0.3 0.02 60);
  --ink-soft: oklch(0.5 0.02 65);
  --line: oklch(0.9 0.01 70);
  --accent: oklch(0.5 0.04 150);
  --shopee: oklch(0.58 0.15 40);
  --tiktok: oklch(0.26 0.015 60);
  --whatsapp: oklch(0.5 0.11 150);
  --danger: oklch(0.5 0.1 30);
  --serif: 'Instrument Serif', serif;
  --sans: 'DM Sans', sans-serif;
  --mono: 'DM Mono', monospace;
}
body {
  margin: 0;
  background: var(--bg);
  font-family: var(--sans);
  color: var(--ink);
  -webkit-font-smoothing: antialiased;
}
```

`src/routes/index.tsx` (placeholder page, replaced in Task 9):

```tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({ component: () => <h1>pqacam</h1> })
```

`src/routes/api/health.ts` (Task 2 adds the database check):

```ts
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/health')({
  server: { handlers: { GET: () => Response.json({ ok: true }) } },
})
```

- [ ] **Step 4: Write the production entry**

`server.ts`:

```ts
// @ts-expect-error the built output has no type declarations
import handler from './dist/server/server.js'

const CLIENT = './dist/client'

Bun.serve({
  port: Number(process.env.PORT ?? 3000),
  async fetch(request) {
    const path = new URL(request.url).pathname
    if (path !== '/' && !path.includes('..')) {
      const file = Bun.file(CLIENT + path)
      if (await file.exists()) {
        // Vite puts a content hash in each name under /assets, so those files never change.
        const cache = path.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'public, max-age=3600'
        return new Response(file, { headers: { 'Cache-Control': cache } })
      }
    }
    return handler.fetch(request)
  },
})

console.log(`pqacam listening on port ${process.env.PORT ?? 3000}`)
```

`src/routeTree.gen.ts` does not exist yet. `bun run dev` and `bun run build` write it. Commit it, and run one of the two before `bun run typecheck` each time a route file is added.

- [ ] **Step 5: Check development mode**

Run: `bun run dev`, then in a second terminal `curl -s localhost:3000/api/health`
Expected: `{"ok":true}`. Stop the dev server.

- [ ] **Step 6: Check production mode**

Run: `bun run build && PORT=3001 bun server.ts`, then `curl -s localhost:3001/api/health` and `curl -s localhost:3001/ | grep -o '<h1>pqacam</h1>'`
Expected: `{"ok":true}` and `<h1>pqacam</h1>`. Stop the server.

Run: `bun run typecheck`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: scaffold TanStack Start app on Bun"
```

## Task 2: Database

**Files:**
- Create: `drizzle.config.ts`, `src/server/env.ts`, `src/server/schema.ts`, `src/server/db.ts`
- Create: `drizzle/` (generated)
- Modify: `src/routes/api/health.ts`
- Test: `tests/db.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `env(key: EnvKey): string` from `src/server/env.ts`
  - Tables `profile`, `category`, `product`, `media`, `admin` from `src/server/schema.ts`
  - `openDb(path: string, ownerEmail?: string): Db`, `getDb(): Db`, type `Db` from `src/server/db.ts`

- [ ] **Step 1: Write the environment reader**

`src/server/env.ts`:

```ts
const DEFAULTS = { DATABASE_PATH: '/data/pqacam.db' } as const

export type EnvKey =
  | 'PUBLIC_URL'
  | 'SESSION_SECRET'
  | 'OWNER_EMAIL'
  | 'GOOGLE_CLIENT_ID'
  | 'GOOGLE_CLIENT_SECRET'
  | 'R2_ACCOUNT_ID'
  | 'R2_ACCESS_KEY_ID'
  | 'R2_SECRET_ACCESS_KEY'
  | 'R2_BUCKET'
  | 'MEDIA_BASE_URL'
  | 'DATABASE_PATH'

export function env(key: EnvKey): string {
  const value = process.env[key] ?? DEFAULTS[key as keyof typeof DEFAULTS]
  if (!value) throw new Error(`Missing environment variable ${key}`)
  return value.replace(/\/$/, '')
}
```

- [ ] **Step 2: Write the schema**

`src/server/schema.ts`:

```ts
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const profile = sqliteTable('profile', {
  id: integer('id').primaryKey(),
  name: text('name').notNull().default(''),
  handle: text('handle').notNull().default(''),
  bio: text('bio').notNull().default(''),
  avatarKey: text('avatar_key'),
  whatsapp: text('whatsapp').notNull().default(''),
})

export const category = sqliteTable('category', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  position: integer('position').notNull(),
})

export const product = sqliteTable('product', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  categoryId: integer('category_id')
    .notNull()
    .references(() => category.id, { onDelete: 'restrict' }),
  name: text('name').notNull(),
  price: text('price').notNull().default(''),
  review: text('review').notNull().default(''),
  shopeeUrl: text('shopee_url').notNull().default(''),
  tiktokUrl: text('tiktok_url').notNull().default(''),
  whatsappUrl: text('whatsapp_url').notNull().default(''),
  hidden: integer('hidden', { mode: 'boolean' }).notNull().default(false),
  position: integer('position').notNull(),
  shopeeClicks: integer('shopee_clicks').notNull().default(0),
  tiktokClicks: integer('tiktok_clicks').notNull().default(0),
  whatsappClicks: integer('whatsapp_clicks').notNull().default(0),
})

export const media = sqliteTable('media', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  productId: integer('product_id')
    .notNull()
    .references(() => product.id, { onDelete: 'cascade' }),
  type: text('type', { enum: ['photo', 'video'] }).notNull(),
  r2Key: text('r2_key').notNull(),
  position: integer('position').notNull(),
})

export const admin = sqliteTable('admin', {
  email: text('email').primaryKey(),
})
```

`drizzle.config.ts`:

```ts
import { defineConfig } from 'drizzle-kit'

export default defineConfig({ dialect: 'sqlite', schema: './src/server/schema.ts', out: './drizzle' })
```

- [ ] **Step 3: Generate the migration**

Run: `bun run db:generate`
Expected: one `.sql` file and a `meta/` folder in `drizzle/`. The SQL has five `CREATE TABLE` statements.

- [ ] **Step 4: Write the failing test**

`tests/db.test.ts`:

```ts
import { expect, test } from 'bun:test'
import { openDb } from '../src/server/db'
import { admin, profile } from '../src/server/schema'

test('a new database has the profile row and the owner as first admin', () => {
  const db = openDb(':memory:', 'Owner@Example.com')
  expect(db.select().from(profile).all()).toHaveLength(1)
  expect(db.select().from(admin).all()).toEqual([{ email: 'owner@example.com' }])
})

test('a new database with no owner has no admin', () => {
  const db = openDb(':memory:')
  expect(db.select().from(admin).all()).toEqual([])
})
```

- [ ] **Step 5: Run the test to see it fail**

Run: `bun test tests/db.test.ts`
Expected: FAIL. `Cannot find module '../src/server/db'`.

- [ ] **Step 6: Write the database module**

`src/server/db.ts`:

```ts
import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { env } from './env'
import * as schema from './schema'

export function openDb(path: string, ownerEmail?: string) {
  const sqlite = new Database(path, { create: true })
  sqlite.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;')
  const db = drizzle(sqlite, { schema })
  migrate(db, { migrationsFolder: 'drizzle' })
  db.insert(schema.profile).values({ id: 1 }).onConflictDoNothing().run()
  if (ownerEmail && !db.select().from(schema.admin).get()) {
    db.insert(schema.admin).values({ email: ownerEmail.trim().toLowerCase() }).run()
  }
  return db
}

export type Db = ReturnType<typeof openDb>

let instance: Db | undefined

export function getDb(): Db {
  instance ??= openDb(env('DATABASE_PATH'), process.env.OWNER_EMAIL)
  return instance
}
```

`migrationsFolder` is relative to the working directory. Dev, tests, and the container all start from the project root.

- [ ] **Step 7: Run the test to see it pass**

Run: `bun test tests/db.test.ts`
Expected: 2 pass.

- [ ] **Step 8: Make the health check open the database**

Replace `src/routes/api/health.ts`:

```ts
import { createFileRoute } from '@tanstack/react-router'
import { getDb } from '../../server/db'
import { profile } from '../../server/schema'

export const Route = createFileRoute('/api/health')({
  server: {
    handlers: {
      GET: () => {
        getDb().select().from(profile).get()
        return Response.json({ ok: true })
      },
    },
  },
})
```

Run: `DATABASE_PATH=./data/dev.db bun run dev` (create `data/` first), then `curl -s localhost:3000/api/health`
Expected: `{"ok":true}`, and `data/dev.db` exists.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: add SQLite schema and migrations"
```
