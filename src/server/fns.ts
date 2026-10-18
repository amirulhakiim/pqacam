import { createServerFn } from '@tanstack/react-start'
import { getAnalytics } from './analytics'
import { appSession, requireAdmin } from './auth'
import * as catalog from './catalog'
import { getDb } from './db'
import { env } from './env'
import { deleteObjects, newKey, presignGet, presignPut } from './r2'
import {
  AVATAR_KEY,
  type JobInput,
  type ProductInput,
  type Result,
  type UploadKind,
  validateEmail,
  validateHash,
  validateSocials,
  validateJobs,
  validateLibraryMedia,
  validateProduct,
  validateUpload,
  isPlatform,
  type Platform,
  toBioSize,
  toIsoDate,
  toRange,
  validateWatermark,
  type WatermarkSettings,
} from './validate'
import { kick } from './worker'

type Me = { email: string; name: string }
const mediaBase = () => env('MEDIA_BASE_URL')

async function asAdmin<T>(work: (me: Me) => T | Promise<T>): Promise<Result<T>> {
  const me = await requireAdmin()
  try {
    return { ok: true, value: await work(me) }
  } catch (error) {
    if (error instanceof catalog.UserError) return { ok: false, error: error.message }
    // The admin only sees "Something went wrong", so the cause goes to the server log.
    console.error(`Admin action failed for ${me.email}`, error)
    throw error
  }
}

function need<T>(result: Result<T>): T {
  if (!result.ok) throw new catalog.UserError(result.error)
  return result.value
}

function int(value: unknown): number {
  if (!Number.isInteger(value)) throw new catalog.UserError('Something went wrong. Reload the page.')
  return value as number
}

const dir = (value: unknown): -1 | 1 => (value === -1 ? -1 : 1)
const folderOrNone = (value: unknown): number | null => (value === null || value === undefined ? null : int(value))

export const getPublicPageFn = createServerFn({ method: 'GET' }).handler(() => ({ ...catalog.getPublicPage(getDb(), mediaBase()), site: env('PUBLIC_URL') }))

export const getAdminDataFn = createServerFn({ method: 'GET' }).handler(async () => {
  const me = await requireAdmin()
  // Resumes a queue that a restart left behind.
  kick()
  return { me, ...catalog.getAdminData(getDb(), mediaBase()) }
})

export const saveProductFn = createServerFn({ method: 'POST' })
  .inputValidator((data: ProductInput) => data)
  .handler(({ data }) =>
    asAdmin(async () => {
      const saved = catalog.saveProduct(getDb(), need(validateProduct(data)))
      await deleteObjects(saved.removedKeys)
      return saved.id
    }),
  )

export const deleteProductFn = createServerFn({ method: 'POST' })
  .inputValidator((data: number) => data)
  .handler(({ data }) => asAdmin(() => deleteObjects(catalog.deleteProduct(getDb(), int(data)))))

export const setHiddenFn = createServerFn({ method: 'POST' })
  .inputValidator((data: { id: number; hidden: boolean }) => data)
  .handler(({ data }) => asAdmin(() => catalog.setHidden(getDb(), int(data?.id), data.hidden === true)))

export const moveCategoryFn = createServerFn({ method: 'POST' })
  .inputValidator((data: { id: number; dir: -1 | 1 }) => data)
  .handler(({ data }) => asAdmin(() => catalog.moveCategory(getDb(), int(data?.id), dir(data?.dir))))

export const reorderProductsFn = createServerFn({ method: 'POST' })
  .inputValidator((data: number[]) => data)
  .handler(({ data }) => asAdmin(() => catalog.reorderProducts(getDb(), (Array.isArray(data) ? data : []).map(int))))

export const addCategoryFn = createServerFn({ method: 'POST' })
  .inputValidator((data: string) => data)
  .handler(({ data }) => asAdmin(() => catalog.addCategory(getDb(), String(data ?? ''))))

export const renameCategoryFn = createServerFn({ method: 'POST' })
  .inputValidator((data: { id: number; name: string }) => data)
  .handler(({ data }) => asAdmin(() => catalog.renameCategory(getDb(), int(data?.id), String(data.name ?? ''))))

export const deleteCategoryFn = createServerFn({ method: 'POST' })
  .inputValidator((data: number) => data)
  .handler(({ data }) => asAdmin(() => catalog.deleteCategory(getDb(), int(data))))

export const saveProfileFn = createServerFn({ method: 'POST' })
  .inputValidator((data: catalog.ProfileInput) => data)
  .handler(({ data }) =>
    asAdmin(async () => {
      if (data?.avatarKey !== undefined && !AVATAR_KEY.test(String(data.avatarKey))) {
        throw new catalog.UserError('Upload the photo again.')
      }
      const replaced = catalog.saveProfile(getDb(), {
        name: String(data?.name ?? ''),
        handle: String(data?.handle ?? ''),
        bio: String(data?.bio ?? ''),
        bioSize: toBioSize(data?.bioSize),
        whatsapp: String(data?.whatsapp ?? ''),
        avatarKey: data?.avatarKey,
        socials: data?.socials === undefined ? undefined : need(validateSocials(data.socials)),
      })
      if (replaced) await deleteObjects([replaced])
    }),
  )

export const addAdminFn = createServerFn({ method: 'POST' })
  .inputValidator((data: string) => data)
  .handler(({ data }) => asAdmin(() => catalog.addAdmin(getDb(), need(validateEmail(data)))))

export const removeAdminFn = createServerFn({ method: 'POST' })
  .inputValidator((data: string) => data)
  .handler(({ data }) => asAdmin((me) => catalog.removeAdmin(getDb(), need(validateEmail(data)), me.email)))

export const createUploadFn = createServerFn({ method: 'POST' })
  .inputValidator((data: { kind: UploadKind; contentType: string; size: number }) => data)
  .handler(({ data }) =>
    asAdmin(async () => {
      const upload = need(validateUpload(data))
      const key = newKey(upload.kind, upload.ext)
      return { key, uploadUrl: await presignPut(key, upload.contentType, upload.size), publicUrl: `${mediaBase()}/${key}` }
    }),
  )

export const signOutFn = createServerFn({ method: 'POST' }).handler(async () => {
  await (await appSession()).clear()
})

export const addJobsFn = createServerFn({ method: 'POST' })
  .inputValidator((data: { jobs: JobInput[]; settings: WatermarkSettings; folderId?: number | null }) => data)
  .handler(({ data }) =>
    asAdmin(() => {
      catalog.addJobs(getDb(), need(validateJobs(data?.jobs)), need(validateWatermark(data?.settings)), folderOrNone(data?.folderId))
      kick()
    }),
  )

export const retryJobFn = createServerFn({ method: 'POST' })
  .inputValidator((data: number) => data)
  .handler(({ data }) =>
    asAdmin(() => {
      catalog.retryJob(getDb(), int(data))
      kick()
    }),
  )

export const deleteJobFn = createServerFn({ method: 'POST' })
  .inputValidator((data: number) => data)
  .handler(({ data }) => asAdmin(() => deleteObjects(catalog.deleteJob(getDb(), int(data)))))

export const tagWatermarkFn = createServerFn({ method: 'POST' })
  .inputValidator((data: { id: number; tagged: boolean }) => data)
  .handler(({ data }) => asAdmin(() => catalog.tagWatermark(getDb(), int(data?.id), data?.tagged === true)))

export const watermarkJobFn = createServerFn({ method: 'POST' })
  .inputValidator((data: number) => data)
  .handler(({ data }) =>
    asAdmin(() => {
      catalog.watermarkJob(getDb(), int(data))
      kick()
    }),
  )

export const downloadUrlFn = createServerFn({ method: 'POST' })
  .inputValidator((data: number) => data)
  .handler(({ data }) =>
    asAdmin(() => {
      const file = catalog.downloadName(getDb(), int(data))
      return presignGet(file.key, file.name)
    }),
  )

export const deleteUnusedJobsFn = createServerFn({ method: 'POST' }).handler(() =>
  asAdmin(async () => {
    const keys = catalog.deleteUnusedJobs(getDb())
    await deleteObjects(keys)
    return keys.length
  }),
)

export const addMediaFn = createServerFn({ method: 'POST' })
  .inputValidator((data: JobInput & { folderId?: number | null }) => data)
  .handler(({ data }) => asAdmin(() => catalog.addMedia(getDb(), need(validateLibraryMedia(data)), folderOrNone(data?.folderId))))

export const findMediaFn = createServerFn({ method: 'POST' })
  .inputValidator((data: string) => data)
  .handler(({ data }) => asAdmin(() => catalog.findMedia(getDb(), need(validateHash(data)))))

export const attachMediaFn = createServerFn({ method: 'POST' })
  .inputValidator((data: { productId: number; jobId: number }) => data)
  .handler(({ data }) => asAdmin(() => catalog.attachMedia(getDb(), int(data?.productId), int(data?.jobId))))

export const addFolderFn = createServerFn({ method: 'POST' })
  .inputValidator((data: string) => data)
  .handler(({ data }) => asAdmin(() => catalog.addFolder(getDb(), String(data ?? ''))))

export const renameFolderFn = createServerFn({ method: 'POST' })
  .inputValidator((data: { id: number; name: string }) => data)
  .handler(({ data }) => asAdmin(() => catalog.renameFolder(getDb(), int(data?.id), String(data.name ?? ''))))

export const deleteFolderFn = createServerFn({ method: 'POST' })
  .inputValidator((data: number) => data)
  .handler(({ data }) => asAdmin(() => catalog.deleteFolder(getDb(), int(data))))

export const moveJobFn = createServerFn({ method: 'POST' })
  .inputValidator((data: { id: number; folderId: number | null }) => data)
  .handler(({ data }) => asAdmin(() => catalog.moveJob(getDb(), int(data?.id), folderOrNone(data?.folderId))))

export const getAnalyticsFn = createServerFn({ method: 'GET' })
  .inputValidator(
    (data: { days: number; from?: string | null; to?: string | null; categoryId: number | null; productId: number | null; platform: string | null }) => data,
  )
  .handler(({ data }) =>
    asAdmin(() =>
      getAnalytics(getDb(), {
        days: toRange(data?.days),
        from: toIsoDate(data?.from),
        to: toIsoDate(data?.to),
        categoryId: Number.isInteger(data?.categoryId) ? data.categoryId : null,
        productId: Number.isInteger(data?.productId) ? data.productId : null,
        platform: isPlatform(String(data?.platform)) ? (data.platform as Platform) : null,
      }),
    ),
  )

export const compressVideoFn = createServerFn({ method: 'POST' })
  .inputValidator((data: JobInput & { folderId?: number | null }) => data)
  .handler(({ data }) =>
    asAdmin(() => {
      const [input] = need(validateJobs([{ ...data, type: 'video' }]))
      const id = catalog.addCompressJob(getDb(), input, folderOrNone(data?.folderId))
      kick()
      return id
    }),
  )

export const takeJobFn = createServerFn({ method: 'POST' })
  .inputValidator((data: number) => data)
  .handler(({ data }) =>
    asAdmin(() => {
      kick()
      return catalog.takeJob(getDb(), int(data), mediaBase())
    }),
  )
