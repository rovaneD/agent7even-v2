'use client'

import { useState } from 'react'
import { trackEvent } from '@/lib/gtag'

const LINKS: { href: string; label: string; key?: string }[] = [
  { href: '/how-it-works', label: 'How it works' },
  { href: '/#features', label: 'Features' },
  { href: '/agents', label: 'Agents', key: 'agents' },
  { href: '/pricing', label: 'Pricing', key: 'pricing' },
  { href: '/use-cases', label: 'Use cases', key: 'use-cases' },
]

export default function MarketingNav({ active }: { active?: 'agents' | 'pricing' | 'use-cases' }) {
  const [open, setOpen] = useState(false)

  return (
    <nav className="nav">
      <div className="nav-in">
        <a className="brand" href="/">
          <img className="brand-logo" src="/agent7even_logo.svg" alt="Agent7even" />
        </a>
        <div className="nav-links">
          {LINKS.map(l => (
            <a key={l.label} href={l.href} style={l.key && l.key === active ? { color: 'var(--l5-ink)' } : undefined}>
              {l.label}
            </a>
          ))}
        </div>
        <div className="nav-right">
          <a className="nav-signin" href="/sign-in">Sign in</a>
          <a
            className="btn btn-primary btn-sm"
            href="/sign-up"
            onClick={() => trackEvent('sign_up_click', { location: 'nav' })}
          >
            Sign up
          </a>
        </div>
        <button
          className={`nav-burger${open ? ' open' : ''}`}
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          <span /><span /><span />
        </button>
      </div>

      {open && (
        <div className="nav-menu">
          {LINKS.map(l => (
            <a
              key={l.label}
              href={l.href}
              className={l.key && l.key === active ? 'active' : undefined}
              onClick={() => setOpen(false)}
            >
              {l.label}
            </a>
          ))}
          <div className="nav-menu-auth">
            <a className="btn btn-ghost" href="/sign-in" onClick={() => setOpen(false)}>Sign in</a>
            <a
              className="btn btn-primary"
              href="/sign-up"
              onClick={() => { trackEvent('sign_up_click', { location: 'nav_menu' }); setOpen(false) }}
            >
              Sign up
            </a>
          </div>
        </div>
      )}
    </nav>
  )
}
