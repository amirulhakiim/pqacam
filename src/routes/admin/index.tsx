import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useCallback, useEffect, useState } from 'react'
import { AdminsTab } from '../../components/admin/AdminsTab'
import { CategoriesTab } from '../../components/admin/CategoriesTab'
import { ProductsTab } from '../../components/admin/ProductsTab'
import { ProfileTab } from '../../components/admin/ProfileTab'
import { type Act, Shell, type Tab } from '../../components/admin/Shell'
import { getAdminDataFn, signOutFn } from '../../server/fns'

export const Route = createFileRoute('/admin/')({
  loader: () => getAdminDataFn(),
  head: () => ({ meta: [{ title: 'Admin' }, { name: 'robots', content: 'noindex' }] }),
  component: Admin,
})

function Admin() {
  const { me, ...data } = Route.useLoaderData()
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('products')
  const [toast, setToast] = useState('')

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(''), 2200)
    return () => clearTimeout(timer)
  }, [toast])

  const act: Act = useCallback(
    async (work, done) => {
      try {
        const result = await work
        if (!result.ok) {
          setToast(result.error)
          return false
        }
        await router.invalidate()
        if (done) setToast(done)
        return true
      } catch {
        // A lost session makes the server function throw. The reload sends the admin to the sign-in page.
        await router.invalidate()
        setToast('Something went wrong. Try again.')
        return false
      }
    },
    [router],
  )

  const signOut = async () => {
    await signOutFn()
    await router.navigate({ to: '/admin/login' })
  }

  const props = { data, act, flash: setToast }
  return (
    <Shell data={data} me={me} tab={tab} onTab={setTab} onSignOut={signOut}>
      {tab === 'products' && <ProductsTab {...props} />}
      {tab === 'categories' && <CategoriesTab {...props} />}
      {tab === 'profile' && <ProfileTab {...props} />}
      {tab === 'admins' && <AdminsTab {...props} me={me.email} />}
      {toast && <div className="ad-toast">{toast}</div>}
    </Shell>
  )
}
