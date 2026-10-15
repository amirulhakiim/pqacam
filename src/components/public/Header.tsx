import type { PublicPage } from '../../server/catalog'

export function Header({ profile }: { profile: PublicPage['profile'] }) {
  return (
    <header className="pp-header">
      <div className="pp-avatar">{profile.avatarUrl && <img src={profile.avatarUrl} alt="" />}</div>
      <h1 className="pp-name">{profile.name}</h1>
      <div className="pp-handle">{profile.handle}</div>
      <p className={`pp-bio pp-bio-${profile.bioSize}`}>{profile.bio}</p>
    </header>
  )
}
