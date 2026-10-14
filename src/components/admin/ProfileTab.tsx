import { useEffect, useRef, useState } from 'react'
import { resizeImage, uploadFile } from '../../lib/upload'
import { saveProfileFn } from '../../server/fns'
import type { TabProps } from './Shell'

export function ProfileTab({ data, act, flash }: TabProps) {
  const { name, handle, bio, whatsapp, avatarUrl } = data.profile
  const [form, setForm] = useState({ name, handle, bio, whatsapp })
  const edited = useRef(false)

  const pending = useRef<typeof form | null>(null)

  useEffect(() => {
    if (!edited.current) return
    pending.current = form
    const timer = setTimeout(() => {
      pending.current = null
      act(saveProfileFn({ data: form }))
    }, 600)
    return () => clearTimeout(timer)
  }, [form, act])

  // Sends an edit that is still in the 600 ms wait when the admin leaves the tab.
  useEffect(
    () => () => {
      if (pending.current) act(saveProfileFn({ data: pending.current }))
    },
    [act],
  )

  const field = (key: keyof typeof form) => ({
    className: 'adm-input',
    value: form[key],
    onChange: (e: { target: { value: string } }) => {
      edited.current = true
      setForm((f) => ({ ...f, [key]: e.target.value }))
    },
  })

  async function changeAvatar(file?: File) {
    if (!file) return
    try {
      const result = await uploadFile('avatar', await resizeImage(file, 400))
      if (!result.ok) return flash(result.error)
      await act(saveProfileFn({ data: { ...form, avatarKey: result.value.key } }), 'Photo updated')
    } catch {
      flash('Could not read this file.')
    }
  }

  return (
    <>
      <div className="adm-head">
        <div>
          <h2>Profile</h2>
          <div className="adm-sub">Changes save automatically.</div>
        </div>
      </div>
      <div className="adm-list adm-form">
        <div className="adm-avatar-row">
          <div className="adm-avatar">{avatarUrl && <img src={avatarUrl} alt="" />}</div>
          <label className="btn btn-light btn-round">
            Upload photo
            <input type="file" accept="image/*" hidden onChange={(e) => changeAvatar(e.target.files?.[0])} />
          </label>
        </div>
        <label className="adm-field">
          <span className="adm-label">Page name</span>
          <input {...field('name')} />
        </label>
        <label className="adm-field">
          <span className="adm-label">Handle</span>
          <input {...field('handle')} />
        </label>
        <label className="adm-field">
          <span className="adm-label">Bio</span>
          <textarea rows={3} {...field('bio')} />
        </label>
        <label className="adm-field">
          <span className="adm-label">WhatsApp number</span>
          <input {...field('whatsapp')} placeholder="60123456789" inputMode="numeric" />
          <span className="adm-hint">Country code + number, no spaces or +. Used for "Order via WhatsApp" links.</span>
        </label>
      </div>
    </>
  )
}
