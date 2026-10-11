import type { Platform } from '../server/validate'

export const PLATFORM_LABEL: Record<Platform, { chip: string; buy: string }> = {
  shopee: { chip: 'Shopee', buy: 'Buy on Shopee' },
  tiktok: { chip: 'TikTok', buy: 'Buy on TikTok Shop' },
  whatsapp: { chip: 'WhatsApp', buy: 'Order via WhatsApp' },
}
