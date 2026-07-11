'use client'

import { trackEvent } from '@/lib/gtag'
import { USE_CASE_NAV_ITEMS } from '@/lib/marketing/useCaseNav'

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
            <a href="/sign-up" onClick={() => trackEvent('sign_up_click', { location: 'footer' })}>Sign up</a>
          </div>
          <div className="fcol">
            <h5>Use cases</h5>
            {USE_CASE_NAV_ITEMS.map((item) => (
              <a key={item.slug} href={item.href}>
                {item.label}
              </a>
            ))}
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
