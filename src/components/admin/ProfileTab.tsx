import { useEffect, useRef, useState } from 'react'
import { resizeImage, uploadFile } from '../../lib/upload'
import { saveProfileFn } from '../../server/fns'
import { BIO_SIZES, SOCIAL_LABEL, SOCIALS, type Social } from '../../server/validate'
import { SocialIcon } from '../SocialIcon'
import type { TabProps } from './Shell'

export function ProfileTab({ data, act, flash }: TabProps) {
  const { name, handle, bio, bioSize, whatsapp, avatarUrl, socials } = data.profile
  const [form, setForm] = useState({ name, handle, bio, bioSize, whatsapp, socials })
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

  const field = (key: Exclude<keyof typeof form, 'bioSize' | 'socials'>) => ({
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
      if (!result.ok) return flash(result.error, true)
      await act(saveProfileFn({ data: { ...form, avatarKey: result.value.key } }), 'Photo updated')
    } catch {
      flash('Could not read this file.', true)
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
          <textarea rows={4} {...field('bio')} />
          <span className="adm-hint">Press Enter for a new paragraph.</span>
        </label>
        <div className="adm-field">
          <span className="adm-label">Bio text size</span>
          <div className="adm-pills-row" role="group" aria-label="Bio text size">
            {BIO_SIZES.map((size) => (
              <button
                type="button"
                key={size}
                className={form.bioSize === size ? 'pill pill-on' : 'pill'}
                aria-pressed={form.bioSize === size}
                onClick={() => {
                  edited.current = true
                  setForm((f) => ({ ...f, bioSize: size }))
                }}
              >
                {size[0].toUpperCase() + size.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <label className="adm-field">
          <span className="adm-label">WhatsApp number</span>
          <input {...field('whatsapp')} placeholder="60123456789" inputMode="numeric" />
          <span className="adm-hint">Country code + number, no spaces or +. Used for "Order via WhatsApp" links.</span>
        </label>
        <div className="adm-field">
          <span className="adm-label">
            Social media <em>Optional. Shown as icons under your bio</em>
          </span>
          {SOCIALS.map((k: Social) => (
            <label className="adm-social-row" key={k}>
              <span className="adm-social-icon" title={SOCIAL_LABEL[k]}>
                <SocialIcon platform={k} />
              </span>
              <input
                className="adm-input"
                value={form.socials[k] ?? ''}
                aria-label={`${SOCIAL_LABEL[k]} link`}
                placeholder={`${SOCIAL_LABEL[k]} link`}
                inputMode="url"
                onChange={(e) => {
                  edited.current = true
                  setForm((f) => ({ ...f, socials: { ...f.socials, [k]: e.target.value } }))
                }}
              />
            </label>
          ))}
        </div>
      </div>
    </>
  )
}
