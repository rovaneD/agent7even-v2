'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

const NAV = [
  { href: '/how-it-works', label: 'How it works' },
  { href: '/agents', label: 'Agents' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/use-cases', label: 'Use cases' },
] as const

const NAV_EXPERIMENT = [
  { href: '/how-it-works', label: 'Product' },
  { href: '/use-cases', label: 'Solutions' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/blog', label: 'Resources' },
] as const

export default function DesignConceptHeader({ variant = 'classic' }: { variant?: 'classic' | 'experiment' }) {
  const links = variant === 'experiment' ? NAV_EXPERIMENT : NAV
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [menuOpen])

  return (
    <header className={`dc-header${scrolled ? ' dc-header--scrolled' : ''}`}>
      <div className="dc-header__in">
        <Link className="dc-header__brand" href="/">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/agent7even_logo.svg" alt="Agent7even" width={140} height={42} />
        </Link>

        <nav className="dc-header__nav" aria-label="Primary">
          {links.map((item) => (
            <Link key={item.href} href={item.href} className="dc-header__link">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="dc-header__actions">
          <Link href="/sign-in" className="dc-header__signin">
            {variant === 'experiment' ? 'Log in' : 'Sign in'}
          </Link>
          <Link href="/pricing" className={`dc-btn dc-btn--primary dc-btn--sm${variant === 'experiment' ? ' dc-btn--blue' : ''}`}>
            {variant === 'experiment' ? 'Sign up' : 'Start free trial'}
          </Link>
        </div>

        <button
          type="button"
          className={`dc-header__burger${menuOpen ? ' is-open' : ''}`}
          aria-expanded={menuOpen}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          onClick={() => setMenuOpen((v) => !v)}
        >
          <span />
          <span />
          <span />
        </button>
      </div>

      {menuOpen && (
        <div className="dc-header__menu" role="dialog" aria-label="Mobile menu">
          {links.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="dc-header__menu-link"
              onClick={() => setMenuOpen(false)}
            >
              {item.label}
            </Link>
          ))}
          <div className="dc-header__menu-auth">
            <Link href="/sign-in" className="dc-btn dc-btn--ghost" onClick={() => setMenuOpen(false)}>
              {variant === 'experiment' ? 'Log in' : 'Sign in'}
            </Link>
            <Link href="/pricing" className={`dc-btn dc-btn--primary${variant === 'experiment' ? ' dc-btn--blue' : ''}`} onClick={() => setMenuOpen(false)}>
              {variant === 'experiment' ? 'Sign up' : 'Start free trial'}
            </Link>
          </div>
        </div>
      )}
    </header>
  )
}
