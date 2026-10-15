import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useCallback, useEffect, useState } from 'react'
import { AdminsTab } from '../../components/admin/AdminsTab'
import { AnalyticsTab } from '../../components/admin/AnalyticsTab'
import { CategoriesTab } from '../../components/admin/CategoriesTab'
import { ProductsTab } from '../../components/admin/ProductsTab'
import { ProfileTab } from '../../components/admin/ProfileTab'
import { type Act, Shell, type Tab, TABS } from '../../components/admin/Shell'
import { useUploads } from '../../components/admin/useUploads'
import { useProductUploads } from '../../components/admin/useProductUploads'
import { WatermarkTab } from '../../components/admin/WatermarkTab'
import { MediaTab } from '../../components/admin/Library'
import { withTransition } from '../../lib/transition'
import { getAdminDataFn, signOutFn } from '../../server/fns'

export const Route = createFileRoute('/admin/')({
  validateSearch: (search: Record<string, unknown>): { tab?: Tab } =>
    TABS.includes(search.tab as Tab) && search.tab !== 'products' ? { tab: search.tab as Tab } : {},
  loader: () => getAdminDataFn(),
  head: () => ({ meta: [{ title: 'Admin' }, { name: 'robots', content: 'noindex' }] }),
  component: Admin,
})

function Admin() {
  const { me, ...data } = Route.useLoaderData()
  const router = useRouter()
  const tab = Route.useSearch().tab ?? 'products'
  const navigate = Route.useNavigate()
  const setTab = useCallback((next: Tab) => void navigate({ search: next === 'products' ? {} : { tab: next }, replace: true }), [navigate])
  const [toast, setToast] = useState<{ text: string; error: boolean } | null>(null)
  const flash = useCallback((text: string, error = false) => setToast({ text, error }), [])
  const refresh = useCallback(() => void router.invalidate(), [router])
  const uploads = useUploads(refresh, flash)
  const productUploads = useProductUploads(refresh, flash)
  const failedUploads = productUploads.tasks.some((task) => task.status === 'failed')
  const working = data.jobs.some((j) => j.status === 'queued' || j.status === 'processing')

  // The server watermarks in the background. Polling shows progress and finished files without a reload.
  useEffect(() => {
    if (!working) return
    const timer = setInterval(refresh, 3000)
    return () => clearInterval(timer)
  }, [working, refresh])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), toast.error ? 6000 : 2200)
    return () => clearTimeout(timer)
  }, [toast])

  const act: Act = useCallback(
    async (work, done) => {
      try {
        const result = await work
        if (!result.ok) {
          flash(result.error, true)
          return false
        }
        await withTransition(() => router.invalidate())
        if (done) flash(done)
        return true
      } catch {
        // A lost session makes the server function throw. The reload sends the admin to the sign-in page.
        await router.invalidate()
        flash('Something went wrong. Try again.', true)
        return false
      }
    },
    [router, flash],
  )

  const signOut = async () => {
    await signOutFn()
    await router.navigate({ to: '/admin/login' })
  }

  const props = { data, act, flash }
  return (
    <Shell data={data} me={me} tab={tab} onTab={setTab} onSignOut={signOut}>
      {(productUploads.active || failedUploads) && (
        <div className="adm-upload-status" role="status">
          <span>{failedUploads ? 'Some media failed to upload. Retry or discard it in Products.' : 'Media is uploading. Keep this page open until it finishes.'}</span>
          {tab !== 'products' && <button type="button" className="btn btn-soft" onClick={() => setTab('products')}>View progress</button>}
        </div>
      )}
      {tab === 'products' && <ProductsTab {...props} uploads={productUploads} />}
      {tab === 'analytics' && <AnalyticsTab {...props} />}
      {tab === 'media' && <MediaTab {...props} />}
      {tab === 'watermark' && <WatermarkTab {...props} uploads={uploads} />}
      {tab === 'categories' && <CategoriesTab {...props} />}
      {tab === 'profile' && <ProfileTab {...props} />}
      {tab === 'admins' && <AdminsTab {...props} me={me.email} />}
      {toast && (
        <div className={toast.error ? 'adm-toast adm-toast-error' : 'adm-toast'} role={toast.error ? 'alert' : 'status'} onClick={() => setToast(null)}>
          {toast.text}
        </div>
      )}
    </Shell>
  )
}
