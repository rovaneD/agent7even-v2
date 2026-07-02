'use client'

import { trackEvent } from '@/lib/gtag'

export default function MarketingFooter() {
  return (
    <footer className="footer">
      <div className="footer-in">
        <div className="footer-top">
          <div className="footer-brand">
            <a className="brand" href="/">
              <img className="brand-logo" src="/agent7even_logo.svg" alt="Agent7even" />
            </a>
            <p>The AI marketing operating system for small business. Meet Maya.</p>
          </div>
          <div className="fcol">
            <h5>Product</h5>
            <a href="/how-it-works">How it works</a>
            <a href="/agents">AI marketing agents</a>
            <a href="/integrations">Integrations</a>
            <a href="/vs-scheduling-tools">vs scheduling tools</a>
            <a href="/pricing">Pricing</a>
            <a href="/use-cases">Use cases</a>
            <a href="/sign-up" onClick={() => trackEvent('sign_up_click', { location: 'footer' })}>Sign up</a>
          </div>
          <div className="fcol">
            <h5>Use cases</h5>
            <a href="/for-coaches">Coaches</a>
            <a href="/for-consultants">Consultants</a>
            <a href="/use-cases/ecommerce">E-commerce</a>
            <a href="/use-cases/local-service">Local service</a>
            <a href="/use-cases/coaches-creators">Creators</a>
            <a href="/use-cases/startups">Startups</a>
          </div>
          <div className="fcol">
            <h5>Company</h5>
            <a href="/about">About</a>
            <a href="/blog">Blog</a>
            <a href="/careers">Careers</a>
            <a href="/contact">Contact</a>
          </div>
          <div className="fcol">
            <h5>Legal</h5>
            <a href="/privacy">Privacy</a>
            <a href="/terms">Terms</a>
            <a href="/security">Security</a>
          </div>
        </div>
        <div className="footer-btm">
          <p>© 2026 Agent7even, Inc.</p>
          <p>Built for people with better things to do.</p>
        </div>
      </div>
    </footer>
  )
}
