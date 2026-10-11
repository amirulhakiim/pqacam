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
      <div className="ad-head">
        <div>
          <h2>Admin access</h2>
          <div className="ad-sub">Google accounts allowed to sign in and edit this page.</div>
        </div>
      </div>
      <div className="ad-list">
        {data.admins.map((address) => (
          <div className="ad-row ad-row-slim" key={address}>
            <span className="ad-initial">{address[0].toUpperCase()}</span>
            <span className="ad-email">{address}</span>
            {address === me ? (
              <span className="ad-sub">You</span>
            ) : (
              <button type="button" className="btn btn-danger btn-small" onClick={() => act(removeAdminFn({ data: address }), 'Access removed')}>
                Remove
              </button>
            )}
          </div>
        ))}
        <div className="ad-add">
          <input
            className="ad-input"
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
