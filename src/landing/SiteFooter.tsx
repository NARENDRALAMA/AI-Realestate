import { Link } from 'react-router-dom'
import { BrandMark } from '../components/BrandMark'

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-container site-footer__grid">
        <div className="site-footer__brand">
          <Link to="/" className="site-brand site-brand--on-ink">
            <BrandMark />
            <span className="site-brand__name">REM Content Studio</span>
          </Link>
          <p>
            Listing, social, email and video copy from one set of property details — in the tone
            you choose.
          </p>
        </div>

        <nav aria-labelledby="footer-product">
          <h2 id="footer-product" className="site-footer__heading">
            Product
          </h2>
          <ul>
            <li><a href="/#how">How it works</a></li>
            <li><a href="/#channels">Channels</a></li>
            <li><a href="/#tones">Tones</a></li>
            <li><a href="/#reliability">Reliability</a></li>
            <li><a href="/#faq">FAQ</a></li>
            <li><Link to="/guides">Guides</Link></li>
          </ul>
        </nav>

        <nav aria-labelledby="footer-app">
          <h2 id="footer-app" className="site-footer__heading">
            App
          </h2>
          <ul>
            <li><Link to="/app">Launch app</Link></li>
            <li><Link to="/app/property">New content</Link></li>
            <li><Link to="/app/library">Library</Link></li>
            <li><Link to="/app/about">About</Link></li>
          </ul>
        </nav>

        <div>
          <h2 className="site-footer__heading">Credits</h2>
          <p>
            Photography from <a href="https://unsplash.com" rel="noopener noreferrer" target="_blank">Unsplash</a>.
            See <a href="/images/CREDITS.md">photo credits</a>.
          </p>
          <p>Sample copy on this page is real, unedited output from the app, labelled with the engine that wrote it.</p>
        </div>
      </div>
      <div className="site-container site-footer__base">
        <p>REM Content Studio</p>
        <a href="#top">Back to top</a>
      </div>
    </footer>
  )
}
