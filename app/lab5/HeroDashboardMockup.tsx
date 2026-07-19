/**
 * BEFORE: Hero mockup was an empty [data-mk="dashboard"] filled only after
 * mockups.js ran (and the showpiece used .reveal opacity:0) — delayed LCP.
 * AFTER: SSR-ready static markup so the hero mockup paints with first HTML.
 * mockups.js skips nodes marked data-mk-ssr="1".
 */

import MayaOrb from '@/components/maya/MayaOrb'

export default function HeroDashboardMockup() {
  return (
    <div
      className="mk"
      data-mk="dashboard"
      data-mk-ssr="1"
      role="img"
      aria-label="AI marketing strategist dashboard showing campaign planning and approval queue"
    >
      <div className="mk-bar">
        <div className="mk-traffic">
          <i />
          <i />
          <i />
        </div>
        <div className="mk-url">agent7even.ai/dashboard</div>
      </div>
      <div className="mk-body" style={{ height: 418 }}>
        <div className="mk-rail">
          <div className="mk-rail-logo">
            {/* width/height prevent CLS; mark is decorative */}
            <img src="/agent7even_mark.svg" alt="" width={28} height={28} />
          </div>
          <div className="mk-ic on" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
              <rect x="3" y="3" width="7" height="7" rx="1.5" />
              <rect x="14" y="3" width="7" height="7" rx="1.5" />
              <rect x="3" y="14" width="7" height="7" rx="1.5" />
              <rect x="14" y="14" width="7" height="7" rx="1.5" />
            </svg>
          </div>
          <div className="mk-ic" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
              <path d="M12 3v6M12 15v6M3 12h6M15 12h6" />
              <circle cx="12" cy="12" r="2.4" />
            </svg>
          </div>
          <div className="mk-ic" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
              <path d="M3 11v2a1 1 0 0 0 1 1h2l4 4V6L6 10H4a1 1 0 0 0-1 1Z" />
              <path d="M14 8a4 4 0 0 1 0 8" />
            </svg>
          </div>
          <div className="mk-ic" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
              <rect x="3.5" y="4.5" width="17" height="16" rx="2" />
              <path d="M3.5 9h17M8 3v3M16 3v3" />
            </svg>
          </div>
          <div className="mk-ic mt-auto" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
              <circle cx="12" cy="8.5" r="3.3" />
              <path d="M5.5 19a6.5 6.5 0 0 1 13 0" />
            </svg>
          </div>
        </div>
        <div className="mk-chat">
          <div className="mk-chat-hd">
            <div className="mk-ava" aria-hidden="true">
              <MayaOrb size={24} active />
            </div>
            <div>
              <div className="nm">Maya</div>
              <div className="rl">Coordinates 12 specialist agents.</div>
            </div>
          </div>
          <div className="mk-msgs">
            <div className="bub bub-u">Fill next Friday — it&apos;s our slow day.</div>
            <div className="bub bub-m">
              On it. A Friday promo — offer, email draft and three posts. Drafting it in your canvas now.
            </div>
            <div className="bub bub-m">Want me to match the 20% you ran last spring, or go a little deeper?</div>
          </div>
          <div className="mk-compose">
            <div className="field">
              <span>Message Maya…</span>
              <b>↑</b>
            </div>
          </div>
        </div>
        <div className="mk-main">
          <div className="mk-main-hd">
            <div>
              <div className="ttl">Good morning</div>
              <div className="sub">Here&apos;s where things stand</div>
            </div>
            <div className="pill" style={{ fontSize: 11, padding: '5px 11px' }}>
              <span className="live-dot" />
              Maya is working
            </div>
          </div>
          <div className="mk-pad">
            <div className="mk-stats">
              <div className="mk-stat">
                <div className="n">3</div>
                <div className="l">Awaiting approval</div>
              </div>
              <div className="mk-stat">
                <div className="n" style={{ color: 'var(--green)' }}>
                  12
                </div>
                <div className="l">Drafted this week</div>
              </div>
              <div className="mk-stat">
                <div className="n">2</div>
                <div className="l">Campaigns in progress</div>
              </div>
            </div>
            <div className="mk-row">
              <span className="dot" style={{ background: 'var(--green)' }} />
              <div className="grow">
                <div className="rt">Summer Launch</div>
                <div className="rs">Sequence 2 of 4 · strong engagement</div>
              </div>
              <span className="tag tag-green">Approved</span>
            </div>
            <div className="mk-row">
              <span className="dot" style={{ background: 'var(--amber)' }} />
              <div className="grow">
                <div className="rt">Friday Slow-Day Promo</div>
                <div className="rs">Drafted by Maya · ready to review</div>
              </div>
              <span className="tag tag-amber">Draft</span>
            </div>
            <div className="mk-row">
              <span className="dot" style={{ background: 'var(--blue)' }} />
              <div className="grow">
                <div className="rt">Win-back email sequence</div>
                <div className="rs">12 lapsed customers identified</div>
              </div>
              <span className="tag tag-blue">Queued</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
