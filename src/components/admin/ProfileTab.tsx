import { useEffect, useRef, useState } from 'react'
import { resizeImage, uploadFile } from '../../lib/upload'
import { saveProfileFn } from '../../server/fns'
import type { TabProps } from './Shell'

export function ProfileTab({ data, act, flash }: TabProps) {
  const { name, handle, bio, whatsapp, avatarUrl } = data.profile
  const [form, setForm] = useState({ name, handle, bio, whatsapp })
  const edited = useRef(false)

  useEffect(() => {
    if (!edited.current) return
    const timer = setTimeout(() => act(saveProfileFn({ data: form })), 600)
    return () => clearTimeout(timer)
  }, [form, act])

  const field = (key: keyof typeof form) => ({
    className: 'ad-input',
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
      <div className="ad-head">
        <div>
          <h2>Profile</h2>
          <div className="ad-sub">Changes save automatically.</div>
        </div>
      </div>
      <div className="ad-list ad-form">
        <div className="ad-avatar-row">
          <div className="ad-avatar">{avatarUrl && <img src={avatarUrl} alt="" />}</div>
          <label className="btn btn-light btn-round">
            Upload photo
            <input type="file" accept="image/*" hidden onChange={(e) => changeAvatar(e.target.files?.[0])} />
          </label>
        </div>
        <label className="ad-field">
          <span className="ad-label">Page name</span>
          <input {...field('name')} />
        </label>
        <label className="ad-field">
          <span className="ad-label">Handle</span>
          <input {...field('handle')} />
        </label>
        <label className="ad-field">
          <span className="ad-label">Bio</span>
          <textarea rows={3} {...field('bio')} />
        </label>
        <label className="ad-field">
          <span className="ad-label">WhatsApp number</span>
          <input {...field('whatsapp')} placeholder="60123456789" inputMode="numeric" />
          <span className="ad-hint">Country code + number, no spaces or +. Used for "Order via WhatsApp" links.</span>
        </label>
      </div>
    </>
  )
}
