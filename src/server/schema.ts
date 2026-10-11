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
