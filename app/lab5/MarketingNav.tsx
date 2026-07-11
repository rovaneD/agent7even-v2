'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { trackEvent } from '@/lib/gtag'
import { USE_CASE_NAV_ITEMS } from '@/lib/marketing/useCaseNav'

const LINKS: { href: string; label: string; key?: string }[] = [
  { href: '/how-it-works', label: 'How it works' },
  { href: '/#features', label: 'Features' },
  { href: '/agents', label: 'Agents', key: 'agents' },
  { href: '/pricing', label: 'Pricing', key: 'pricing' },
]

const PANEL_WIDTH = 288

export default function MarketingNav({ active }: { active?: 'agents' | 'pricing' | 'use-cases' }) {
  const [open, setOpen] = useState(false)
  const [useCasesOpen, setUseCasesOpen] = useState(false)
  const [panelPos, setPanelPos] = useState<{ top: number; left: number } | null>(null)
  const [mounted, setMounted] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  const updatePanelPos = useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    let left = rect.left
    const maxLeft = window.innerWidth - PANEL_WIDTH - 16
    left = Math.min(Math.max(16, left), maxLeft)
    setPanelPos({ top: rect.bottom + 8, left })
  }, [])

  useEffect(() => {
    if (!useCasesOpen) {
      setPanelPos(null)
      return
    }
    updatePanelPos()
    window.addEventListener('resize', updatePanelPos)
    window.addEventListener('scroll', updatePanelPos, true)
    return () => {
      window.removeEventListener('resize', updatePanelPos)
      window.removeEventListener('scroll', updatePanelPos, true)
    }
  }, [useCasesOpen, updatePanelPos])

  useEffect(() => {
    if (!useCasesOpen) return
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (dropdownRef.current?.contains(target) || panelRef.current?.contains(target)) return
      setUseCasesOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setUseCasesOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [useCasesOpen])

  const dropdownPanel =
    useCasesOpen && panelPos && mounted
      ? createPortal(
          <div
            ref={panelRef}
            className="lab5 nav-dropdown-panel nav-dropdown-panel-fixed"
            role="menu"
            style={{ top: panelPos.top, left: panelPos.left, width: PANEL_WIDTH }}
          >
            {USE_CASE_NAV_ITEMS.map((item) => (
              <Link
                key={item.slug}
                href={item.href}
                className="nav-dropdown-item"
                role="menuitem"
                onClick={() => setUseCasesOpen(false)}
              >
                {item.shortLabel}
              </Link>
            ))}
            <Link
              href="/use-cases"
              className="nav-dropdown-all"
              onClick={() => setUseCasesOpen(false)}
            >
              All use cases →
            </Link>
          </div>,
          document.body,
        )
      : null

  return (
    <nav className="nav">
      <div className="nav-in">
        <a className="brand" href="/">
          <img className="brand-logo" src="/agent7even_logo.svg" alt="Agent7even" />
        </a>
        <div className="nav-links">
          {LINKS.map((l) => (
            <a
              key={l.label}
              href={l.href}
              style={l.key && l.key === active ? { color: 'var(--l5-ink)' } : undefined}
            >
              {l.label}
            </a>
          ))}
          <div className="nav-dropdown" ref={dropdownRef}>
            <button
              ref={triggerRef}
              type="button"
              className={`nav-dropdown-trigger${active === 'use-cases' ? ' is-active' : ''}`}
              aria-expanded={useCasesOpen}
              aria-haspopup="true"
              onClick={() => setUseCasesOpen((v) => !v)}
            >
              For your business
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
                <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>
        <div className="nav-right">
          <a className="nav-signin" href="/sign-in">Sign in</a>
          <a
            className="btn btn-hero-primary btn-sm"
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

      {dropdownPanel}

      {open && (
        <div className="nav-menu">
          {LINKS.map((l) => (
            <a
              key={l.label}
              href={l.href}
              className={l.key && l.key === active ? 'active' : undefined}
              onClick={() => setOpen(false)}
            >
              {l.label}
            </a>
          ))}
          <div className="nav-menu-section">
            <p className="nav-menu-section-label">For your business</p>
            {USE_CASE_NAV_ITEMS.map((item) => (
              <a
                key={item.slug}
                href={item.href}
                className="nav-menu-sub"
                onClick={() => setOpen(false)}
              >
                {item.label}
              </a>
            ))}
            <a href="/use-cases" className="nav-menu-sub nav-menu-sub-all" onClick={() => setOpen(false)}>
              All use cases →
            </a>
          </div>
          <div className="nav-menu-auth">
            <a className="btn btn-ghost" href="/sign-in" onClick={() => setOpen(false)}>Sign in</a>
            <a
              className="btn btn-hero-primary"
              href="/sign-up"
              onClick={() => {
                trackEvent('sign_up_click', { location: 'nav_menu' })
                setOpen(false)
              }}
            >
              Sign up
            </a>
          </div>
        </div>
      )}
    </nav>
  )
}
