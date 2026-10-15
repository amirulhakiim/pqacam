import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const profile = sqliteTable('profile', {
  id: integer('id').primaryKey(),
  name: text('name').notNull().default(''),
  handle: text('handle').notNull().default(''),
  bio: text('bio').notNull().default(''),
  avatarKey: text('avatar_key'),
  whatsapp: text('whatsapp').notNull().default(''),
  // JSON of WatermarkSettings. Empty means the defaults.
  watermark: text('watermark').notNull().default(''),
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

export const job = sqliteTable('job', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  type: text('type', { enum: ['photo', 'video'] }).notNull(),
  name: text('name').notNull(),
  // Empty after the worker deletes the original.
  sourceKey: text('source_key').notNull(),
  outputKey: text('output_key').notNull().default(''),
  settings: text('settings').notNull(),
  status: text('status', { enum: ['queued', 'processing', 'done', 'failed'] }).notNull().default('queued'),
  progress: integer('progress').notNull().default(0),
  error: text('error').notNull().default(''),
  createdAt: integer('created_at').notNull(),
})

export const admin = sqliteTable('admin', {
  email: text('email').primaryKey(),
})
