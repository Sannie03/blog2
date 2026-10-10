import { logoUrl } from '../branding'

function SiteLogo() {
  return <img src={logoUrl} alt="NextStoryPart" width="44" height="44" style={{ objectFit: 'contain', borderRadius: '12px' }} />
}

function PublicHeader({ onNavigate }) {
  function handleNavigate(event, path) {
    event.preventDefault()
    onNavigate(path)
  }

  return (
    <header className="site-header">
      <div className="header-inner">
        <a className="brand-wrap brand-link" href="/" onClick={(event) => handleNavigate(event, '/')}>
          <SiteLogo />
          <div>
            <p className="brand-kicker">BLOG</p>
            <h1 className="brand-name">NextStoryPart</h1>
          </div>
        </a>

        <nav className="main-nav" aria-label="Reader navigation">
          <a href="/" onClick={(event) => handleNavigate(event, '/')}>Home</a>
          <a href="/posts" onClick={(event) => handleNavigate(event, '/posts')}>Stories</a>
          <a href="/categories" onClick={(event) => handleNavigate(event, '/categories')}>Categories</a>
          <a href="/about" onClick={(event) => handleNavigate(event, '/about')}>About</a>
        </nav>

        <div className="header-actions" />
      </div>
    </header>
  )
}

function PublicFooter({ onNavigate }) {
  function handleNavigate(event, path) {
    event.preventDefault()
    onNavigate(path)
  }

  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <SiteLogo />
          <strong>NextStoryPart</strong>
          <span>Stories worth staying for.</span>
        </div>
        <nav className="footer-links" aria-label="Footer navigation">
          <a href="/about" onClick={(event) => handleNavigate(event, '/about')}>About</a>
          <a href="/contact" onClick={(event) => handleNavigate(event, '/contact')}>Contact</a>
          <a href="/privacy-policy" onClick={(event) => handleNavigate(event, '/privacy-policy')}>Privacy</a>
          <a href="/terms-of-service" onClick={(event) => handleNavigate(event, '/terms-of-service')}>Terms</a>
        </nav>
        <span className="footer-copyright">(c) 2026 NextStoryPart. All rights reserved.</span>
      </div>
    </footer>
  )
}

export { PublicHeader, PublicFooter }
