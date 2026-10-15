import type { PublicPage } from '../../server/catalog'
import { SOCIAL_LABEL } from '../../server/validate'
import { SocialIcon } from '../SocialIcon'

export function Header({ profile }: { profile: PublicPage['profile'] }) {
  return (
    <header className="pp-header">
      <div className="pp-avatar">{profile.avatarUrl && <img src={profile.avatarUrl} alt="" />}</div>
      <h1 className="pp-name">{profile.name}</h1>
      <div className="pp-handle">{profile.handle}</div>
      <p className={`pp-bio pp-bio-${profile.bioSize}`}>{profile.bio}</p>
      {profile.socials.length > 0 && (
        <nav className="pp-socials" aria-label="Social media">
          {profile.socials.map((s) => (
            <a key={s.platform} className="pp-social" href={s.url} target="_blank" rel="noopener noreferrer" aria-label={SOCIAL_LABEL[s.platform]} title={SOCIAL_LABEL[s.platform]}>
              <SocialIcon platform={s.platform} />
            </a>
          ))}
        </nav>
      )}
    </header>
  )
}
