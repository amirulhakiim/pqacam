import { useState } from 'react'
import { addAdminFn, removeAdminFn } from '../../server/fns'
import type { TabProps } from './Shell'

export function AdminsTab({ data, act, me }: TabProps & { me: string }) {
  const [email, setEmail] = useState('')

  async function add() {
    if (await act(addAdminFn({ data: email }), 'Access granted')) setEmail('')
  }

  return (
    <>
      <div className="adm-head">
        <div>
          <h2>Admin access</h2>
          <div className="adm-sub">Google accounts allowed to sign in and edit this page.</div>
        </div>
      </div>
      <div className="adm-list">
        {data.admins.map((address) => (
          <div className="adm-row adm-row-slim" key={address}>
            <span className="adm-initial">{address[0].toUpperCase()}</span>
            <span className="adm-email">{address}</span>
            {address === me ? (
              <span className="adm-sub">You</span>
            ) : (
              <button type="button" className="btn btn-danger btn-small" onClick={() => act(removeAdminFn({ data: address }), 'Access removed')}>
                Remove
              </button>
            )}
          </div>
        ))}
        <div className="adm-add">
          <input
            className="adm-input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder="name@gmail.com"
          />
          <button type="button" className="btn btn-dark" onClick={add}>
            Give access
          </button>
        </div>
      </div>
    </>
  )
}
