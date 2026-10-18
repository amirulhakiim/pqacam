import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const profile = sqliteTable('profile', {
  id: integer('id').primaryKey(),
  name: text('name').notNull().default(''),
  handle: text('handle').notNull().default(''),
  bio: text('bio').notNull().default(''),
  bioSize: text('bio_size', { enum: ['small', 'medium', 'large'] })
    .notNull()
    .default('medium'),
  avatarKey: text('avatar_key'),
  whatsapp: text('whatsapp').notNull().default(''),
  // JSON of WatermarkSettings. Empty means the defaults.
  watermark: text('watermark').notNull().default(''),
  socials: text('socials').notNull().default('{}'),
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
  shortName: text('short_name').notNull().default(''),
  price: text('price').notNull().default(''),
  review: text('review').notNull().default(''),
  hidden: integer('hidden', { mode: 'boolean' }).notNull().default(false),
  position: integer('position').notNull(),
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

export const link = sqliteTable('link', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  productId: integer('product_id')
    .notNull()
    .references(() => product.id, { onDelete: 'cascade' }),
  platform: text('platform', { enum: ['shopee', 'tiktok', 'whatsapp'] }).notNull(),
  label: text('label').notNull().default(''),
  url: text('url').notNull(),
  position: integer('position').notNull(),
  clicks: integer('clicks').notNull().default(0),
})

// One row per tap on a buy button, for the analytics tab. No foreign keys: the history stays when a product or link is deleted.
// Nothing about the visitor is stored.
export const click = sqliteTable(
  'click',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    linkId: integer('link_id').notNull(),
    productId: integer('product_id').notNull(),
    platform: text('platform', { enum: ['shopee', 'tiktok', 'whatsapp'] }).notNull(),
    source: text('source'),
    at: integer('at').notNull(),
  },
  (t) => [index('click_at').on(t.at)],
)

// Visits, product views, searches and WhatsApp chats from the public page, for the analytics tab. Nothing about the visitor is stored.
export const event = sqliteTable(
  'event',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    type: text('type', { enum: ['visit', 'view', 'search', 'chat'] }).notNull(),
    productId: integer('product_id'),
    // A search: the words, and how many products it found.
    term: text('term'),
    results: integer('results'),
    source: text('source'),
    at: integer('at').notNull(),
  },
  (t) => [index('event_at').on(t.at)],
)

export const folder = sqliteTable('folder', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
})

export const job = sqliteTable('job', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  type: text('type', { enum: ['photo', 'video'] }).notNull(),
  name: text('name').notNull(),
  // Empty after the worker deletes the original.
  sourceKey: text('source_key').notNull(),
  outputKey: text('output_key').notNull().default(''),
  outputBytes: integer('output_bytes').notNull().default(0),
  settings: text('settings').notNull(),
  status: text('status', { enum: ['queued', 'processing', 'done', 'failed'] })
    .notNull()
    .default('queued'),
  progress: integer('progress').notNull().default(0),
  error: text('error').notNull().default(''),
  createdAt: integer('created_at').notNull(),
  // Deleting a folder keeps its files: they go back to no folder.
  folderId: integer('folder_id').references(() => folder.id, { onDelete: 'set null' }),
  hash: text('hash').notNull().default(''),
  tagged: integer('tagged', { mode: 'boolean' }).notNull().default(false),
})

export const admin = sqliteTable('admin', {
  email: text('email').primaryKey(),
})
