'use client';

import Link from 'next/link';
import {
  LayoutDashboard, Sparkles, Megaphone, Calendar,
  User, Eye, Check, ShoppingBag, MapPin, Building, ArrowRight,
} from 'lucide-react';
import { Metaballs } from '@paper-design/shaders-react';

/* ══════════════════════════════════════════════════════════════════
   SHARED MOCK UI PRIMITIVES
   ══════════════════════════════════════════════════════════════════ */

/** Browser-chrome top bar with 3 dots */
function ScreenBar() {
  return (
    <div style={{ background: '#fff', borderBottom: '0.5px solid #E5E7EB', padding: '7px 10px', display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#F0F0F0', display: 'inline-block' }} />
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#F0F0F0', display: 'inline-block' }} />
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#F0F0F0', display: 'inline-block' }} />
    </div>
  );
}

/** 36px sidebar with icon nav */
function Sidebar({ activeIndex }: { activeIndex: number }) {
  const icons = [LayoutDashboard, Sparkles, Megaphone, Calendar];
  return (
    <div style={{ width: 36, background: '#fff', borderRight: '0.5px solid #E5E7EB', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 0', gap: 12, flexShrink: 0 }}>
      {/* Logo */}
      <div style={{ width: 20, height: 20, background: '#111', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 500, color: '#F5349B', flexShrink: 0 }}>7</div>
      {icons.map((Icon, i) => (
        <div key={i} style={{ width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 4, background: i === activeIndex ? '#EFF6FF' : 'transparent', color: i === activeIndex ? '#3B82F6' : '#9BA1AE', marginTop: i === icons.length - 1 ? 'auto' : 0 }}>
          <Icon size={12} />
        </div>
      ))}
      <div style={{ width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9BA1AE' }}>
        <User size={12} />
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   MOCK UI SCREENS
   ══════════════════════════════════════════════════════════════════ */

/** Hero screen: chat panel + dashboard canvas */
function HeroScreen() {
  return (
    <div style={{ background: '#FCFCFC', border: '0.5px solid #E5E7EB', borderRadius: 12, overflow: 'hidden' }}>
      {/* URL bar */}
      <div style={{ background: '#fff', borderBottom: '0.5px solid #E5E7EB', padding: '7px 10px', display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#F0F0F0', display: 'inline-block' }} />
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#F0F0F0', display: 'inline-block' }} />
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#F0F0F0', display: 'inline-block' }} />
        <div style={{ flex: 1, background: '#F8FAFC', border: '0.5px solid #E5E7EB', borderRadius: 3, height: 14, margin: '0 8px', display: 'flex', alignItems: 'center', padding: '0 6px' }}>
          <span style={{ fontSize: 8, color: '#9BA1AE' }}>agent7even.com/dashboard</span>
        </div>
      </div>

      {/* App shell */}
      <div style={{ display: 'flex', height: 180 }}>
        <Sidebar activeIndex={0} />

        {/* Chat panel */}
        <div style={{ width: 155, background: '#fff', borderRight: '0.5px solid #E5E7EB', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <div style={{ padding: '6px 8px', borderBottom: '0.5px solid #E5E7EB', display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 15, height: 15, borderRadius: '50%', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 7, fontWeight: 500, color: '#F5349B', flexShrink: 0 }}>M</div>
            <span style={{ fontSize: 10, fontWeight: 500, color: '#111' }}>Maya</span>
          </div>
          <div style={{ flex: 1, padding: '6px 7px', display: 'flex', flexDirection: 'column', gap: 5, overflow: 'hidden' }}>
            <div style={{ alignSelf: 'flex-end', background: '#3B82F6', color: '#fff', fontSize: 9, padding: '4px 6px', borderRadius: '7px 7px 2px 7px', maxWidth: 115, lineHeight: 1.4 }}>
              Fill next Friday — it&apos;s our slow day.
            </div>
            <div style={{ alignSelf: 'flex-start', background: '#F8FAFC', border: '0.5px solid #E5E7EB', fontSize: 9, padding: '4px 6px', borderRadius: '7px 7px 7px 2px', maxWidth: 120, lineHeight: 1.4, color: '#374151' }}>
              On it. Friday promo for Ember Coffee — email + 3 posts, ready to review.
              <span style={{ color: '#3B82F6', fontSize: 8, display: 'block', marginTop: 2 }}>View draft ↗</span>
            </div>
          </div>
          <div style={{ padding: '5px 6px', borderTop: '0.5px solid #E5E7EB' }}>
            <div style={{ background: '#F8FAFC', border: '0.5px solid #E5E7EB', borderRadius: 10, padding: '3px 6px', fontSize: 8, color: '#9BA1AE' }}>
              Message Maya…
            </div>
          </div>
        </div>

        {/* Canvas */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '6px 9px', borderBottom: '0.5px solid #E5E7EB', background: '#fff' }}>
            <div style={{ fontSize: 10, fontWeight: 500, color: '#111' }}>Dashboard</div>
            <div style={{ fontSize: 8, color: '#9BA1AE' }}>Ember Coffee</div>
          </div>
          <div style={{ padding: '7px 9px', display: 'flex', flexDirection: 'column', gap: 5, opacity: 0.4 }}>
            <div style={{ display: 'flex', gap: 5 }}>
              {[{ n: '3', l: 'Approvals' }, { n: '12', l: 'Sent', c: '#10B981' }, { n: '2', l: 'Active' }].map((s) => (
                <div key={s.l} style={{ background: '#F8FAFC', border: '0.5px solid #E5E7EB', borderRadius: 4, padding: '3px 5px', flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 500, color: s.c || '#3B82F6' }}>{s.n}</div>
                  <div style={{ fontSize: 7, color: '#9BA1AE' }}>{s.l}</div>
                </div>
              ))}
            </div>
            {[{ dot: '#10B981', name: 'Summer Launch', meta: 'Week 2' }, { dot: '#FCA509', name: 'Win-back Email', meta: 'Draft' }].map((r) => (
              <div key={r.name} style={{ background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 4, padding: '3px 6px', display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: r.dot, flexShrink: 0 }} />
                <div style={{ fontSize: 9, color: '#111', flex: 1 }}>{r.name}</div>
                <div style={{ fontSize: 7, color: '#9BA1AE' }}>{r.meta}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Feature 1: Campaigns */
function CampaignScreen() {
  return (
    <div style={{ background: '#FCFCFC', border: '0.5px solid #E5E7EB', borderRadius: 12, overflow: 'hidden' }}>
      <ScreenBar />
      <div style={{ display: 'flex', height: 180 }}>
        <Sidebar activeIndex={2} />
        {/* Campaign list */}
        <div style={{ width: 110, borderRight: '0.5px solid #E5E7EB', flexShrink: 0 }}>
          <div style={{ padding: '5px 7px', fontSize: 7, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#9BA1AE', borderBottom: '0.5px solid #E5E7EB' }}>Campaigns</div>
          {[
            { name: 'Friday Slow-Day', meta: 'Draft · Week 1', sel: true },
            { name: 'Summer Launch', meta: 'Active · Week 2', sel: false },
            { name: 'Win-back Email', meta: 'Draft', sel: false },
          ].map((c) => (
            <div key={c.name} style={{ padding: '6px 7px', borderBottom: '0.5px solid #E5E7EB', background: c.sel ? '#EFF6FF' : 'transparent', borderLeft: c.sel ? '2px solid #3B82F6' : '2px solid transparent' }}>
              <div style={{ fontSize: 9, fontWeight: 500, color: '#111' }}>{c.name}</div>
              <div style={{ fontSize: 7, color: '#9BA1AE', marginTop: 1 }}>{c.meta}</div>
            </div>
          ))}
        </div>
        {/* Detail */}
        <div style={{ flex: 1, borderRight: '0.5px solid #E5E7EB', overflow: 'hidden' }}>
          <div style={{ padding: '6px 8px', borderBottom: '0.5px solid #E5E7EB' }}>
            <div style={{ fontSize: 9, fontWeight: 500, color: '#111' }}>Friday Slow-Day Promo</div>
            <div style={{ fontSize: 7, color: '#9BA1AE', marginTop: 1 }}>20% off · Ember Coffee</div>
          </div>
          <div style={{ padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ background: '#F0F9FF', borderRadius: 5, padding: '5px 6px', borderLeft: '2px solid #3B82F6' }}>
              <div style={{ fontSize: 7, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#1D4ED8', marginBottom: 2 }}>Strategy</div>
              <div style={{ fontSize: 8, color: '#374151', lineHeight: 1.4 }}>20% off Fridays via Instagram + email to regulars.</div>
            </div>
            {[
              { pl: 'Email', name: 'Promo announcement', right: { text: 'Do this →', c: '#3B82F6' } },
              { pl: 'IG', name: 'Post 1 — lead visual', right: { text: 'Drafted ✓', c: '#10B981' }, sel: true },
              { pl: 'IG', name: 'Post 2 — offer close', right: { text: 'Do this →', c: '#3B82F6' } },
            ].map((t) => (
              <div key={t.name} style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#fff', border: `0.5px solid ${t.sel ? '#3B82F6' : '#E5E7EB'}`, borderRadius: 4, padding: '3px 5px' }}>
                <span style={{ fontSize: 7, background: '#EFF6FF', color: '#1D4ED8', padding: '1px 4px', borderRadius: 2, fontWeight: 500, flexShrink: 0 }}>{t.pl}</span>
                <span style={{ fontSize: 8, color: '#111', flex: 1 }}>{t.name}</span>
                <span style={{ fontSize: 7, color: t.right.c, flexShrink: 0 }}>{t.right.text}</span>
              </div>
            ))}
          </div>
        </div>
        {/* Copy variants */}
        <div style={{ width: 100, flexShrink: 0 }}>
          <div style={{ padding: '5px 7px', fontSize: 7, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#9BA1AE', borderBottom: '0.5px solid #E5E7EB' }}>Copy options</div>
          {[
            { label: 'Option A', text: 'Fridays just got better. 20% off all drinks this Friday only.', sel: true },
            { label: 'Option B', text: 'Your Friday deserves a proper sit-down. 20% off this week.', sel: false },
          ].map((v) => (
            <div key={v.label} style={{ margin: '5px 6px 0', background: '#fff', border: `0.5px solid ${v.sel ? '#3B82F6' : '#E5E7EB'}`, borderRadius: 5, padding: 5 }}>
              <div style={{ fontSize: 7, fontWeight: 500, color: '#3B82F6', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>{v.label}</div>
              <div style={{ fontSize: 8, color: '#374151', lineHeight: 1.4 }}>{v.text}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Feature 2: Content calendar */
function CalendarScreen() {
  return (
    <div style={{ background: '#FCFCFC', border: '0.5px solid #E5E7EB', borderRadius: 12, overflow: 'hidden' }}>
      <ScreenBar />
      <div style={{ display: 'flex', height: 180 }}>
        <Sidebar activeIndex={3} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '6px 9px', borderBottom: '0.5px solid #E5E7EB', background: '#fff' }}>
            <div style={{ fontSize: 10, fontWeight: 500, color: '#111' }}>Content calendar</div>
            <div style={{ fontSize: 8, color: '#9BA1AE' }}>Ember Coffee · This week</div>
          </div>
          <div style={{ padding: '7px 9px', display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div style={{ display: 'flex', gap: 5 }}>
              <div style={{ flex: 1, background: '#EFF6FF', border: '0.5px solid #DBEAFE', borderRadius: 5, padding: '5px 7px' }}>
                <div style={{ fontSize: 7, fontWeight: 500, color: '#1D4ED8', marginBottom: 2 }}>Mon</div>
                <div style={{ fontSize: 8, color: '#1E40AF' }}>Instagram post — new roast drop</div>
              </div>
              <div style={{ flex: 1, background: '#F0FDF4', border: '0.5px solid #BBF7D0', borderRadius: 5, padding: '5px 7px' }}>
                <div style={{ fontSize: 7, fontWeight: 500, color: '#166534', marginBottom: 2 }}>Wed</div>
                <div style={{ fontSize: 8, color: '#15803D' }}>Email — loyalty members only</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 5 }}>
              <div style={{ flex: 1, background: '#FFF7ED', border: '0.5px solid #FED7AA', borderRadius: 5, padding: '5px 7px' }}>
                <div style={{ fontSize: 7, fontWeight: 500, color: '#9A3412', marginBottom: 2 }}>Fri</div>
                <div style={{ fontSize: 8, color: '#C2410C' }}>Story — Friday slow day promo</div>
              </div>
              <div style={{ flex: 1, background: '#F8FAFC', border: '0.5px solid #E5E7EB', borderRadius: 5, padding: '5px 7px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ fontSize: 8, color: '#9BA1AE', textAlign: 'center' }}>+ 3 more queued</div>
              </div>
            </div>
            <div style={{ background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 5, padding: '5px 7px', borderLeft: '2px solid #F5349B' }}>
              <div style={{ fontSize: 7, color: '#9D174D', fontWeight: 500, marginBottom: 2 }}>Maya suggestion</div>
              <div style={{ fontSize: 8, color: '#374151' }}>Tuesday is quiet — want a behind-the-scenes post?</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Feature 3: Leads / follow-up */
function LeadsScreen() {
  return (
    <div style={{ background: '#FCFCFC', border: '0.5px solid #E5E7EB', borderRadius: 12, overflow: 'hidden' }}>
      <ScreenBar />
      <div style={{ display: 'flex', height: 180 }}>
        <Sidebar activeIndex={1} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '6px 9px', borderBottom: '0.5px solid #E5E7EB', background: '#fff' }}>
            <div style={{ fontSize: 10, fontWeight: 500, color: '#111' }}>Needs your attention</div>
            <div style={{ fontSize: 8, color: '#9BA1AE' }}>3 items · Ember Coffee</div>
          </div>
          <div style={{ padding: '7px 9px', display: 'flex', flexDirection: 'column', gap: 5 }}>
            {[
              { dot: '#10B981', title: 'New 4★ review — Google', sub: '2 hours ago · Maya drafted a reply', btnText: 'Reply', btnBg: '#10B981' },
              { dot: '#FCA509', title: 'Cold lead — Sarah M.', sub: 'No reply in 14 days · follow-up ready', btnText: 'Send', btnBg: '#FCA509' },
              { dot: '#F5349B', title: 'Table inquiry unanswered', sub: '6 hours · Maya wrote a response', btnText: 'Approve', btnBg: '#F5349B' },
            ].map((item) => (
              <div key={item.title} style={{ background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 6, padding: '6px 8px', display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: item.dot, flexShrink: 0, marginTop: 3 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 9, fontWeight: 500, color: '#111' }}>{item.title}</div>
                  <div style={{ fontSize: 8, color: '#9BA1AE', marginTop: 1 }}>{item.sub}</div>
                </div>
                <button style={{ background: item.btnBg, color: '#fff', fontSize: 7, fontWeight: 500, padding: '2px 6px', borderRadius: 3, border: 'none', flexShrink: 0, cursor: 'default' }}>{item.btnText}</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Feature 4: Competitor watch */
function CompetitorScreen() {
  return (
    <div style={{ background: '#FCFCFC', border: '0.5px solid #E5E7EB', borderRadius: 12, overflow: 'hidden' }}>
      <ScreenBar />
      <div style={{ display: 'flex', height: 180 }}>
        <Sidebar activeIndex={-1} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '6px 9px', borderBottom: '0.5px solid #E5E7EB', background: '#fff' }}>
            <div style={{ fontSize: 10, fontWeight: 500, color: '#111' }}>Competitor watch</div>
            <div style={{ fontSize: 8, color: '#9BA1AE' }}>Last scanned: 2 hours ago</div>
          </div>
          <div style={{ padding: '7px 9px', display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div style={{ background: '#FEF2F2', border: '0.5px solid #FECACA', borderRadius: 6, padding: '6px 8px' }}>
              <div style={{ fontSize: 7, fontWeight: 500, color: '#991B1B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>Maya flagged</div>
              <div style={{ fontSize: 9, fontWeight: 500, color: '#111', marginBottom: 2 }}>Rival Coffee Co. launched a 15% off promo</div>
              <div style={{ fontSize: 8, color: '#9BA1AE' }}>Running on Instagram since yesterday · Want a counter-offer?</div>
            </div>
            {[
              { dot: '#FCA509', name: 'The Press Bar — Instagram ad running', ago: '2d ago' },
              { dot: '#3B82F6', name: 'Grounds Market — email campaign launched', ago: '3d ago' },
            ].map((r) => (
              <div key={r.name} style={{ background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 5, padding: '5px 7px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: r.dot, flexShrink: 0 }} />
                <div style={{ flex: 1, fontSize: 9, color: '#111' }}>{r.name}</div>
                <div style={{ fontSize: 7, color: '#9BA1AE' }}>{r.ago}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   PAGE SECTIONS
   ══════════════════════════════════════════════════════════════════ */

function Hero() {
  return (
    <div
      className="relative overflow-hidden flex flex-col"
      style={{ backgroundColor: '#F9F9FA', color: '#0d0d0d', minHeight: '100vh' }}
    >
      {/* Metaballs — preserved exactly */}
      <div className="absolute inset-0 pointer-events-none">
        <Metaballs
          speed={1}
          count={10}
          size={0.36}
          scale={1}
          colors={['#F5349B', '#EE533B', '#FCA509', '#10B981', '#3286FE']}
          colorBack="#00000000"
          style={{
            backgroundColor: '#F9F9FA',
            mixBlendMode: 'multiply',
            width: '100%',
            height: '100%',
            display: 'block',
          }}
        />
      </div>

      {/* Nav */}
      <header style={{ height: 52, borderBottom: '0.5px solid rgba(229,231,235,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 40px', position: 'relative', zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 26, height: 26, background: '#111', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 500, color: '#F5349B' }}>7</div>
          <span style={{ fontSize: 13, fontWeight: 500, color: '#111' }}>AGENT<span style={{ color: '#F5349B' }}>7</span>EVEN</span>
        </div>
        <nav style={{ display: 'flex', gap: 24 }}>
          {['How it works', 'Use cases', 'Pricing', 'Blog'].map((l) => (
            <a key={l} href="#" style={{ fontSize: 13, color: '#6B7280', textDecoration: 'none' }}>{l}</a>
          ))}
        </nav>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: '#374151' }}>Sign in</span>
          <a href="#" style={{ fontSize: 13, fontWeight: 500, color: '#fff', background: '#3B82F6', borderRadius: 7, padding: '7px 16px', textDecoration: 'none' }}>Get access</a>
        </div>
      </header>

      {/* Hero body */}
      <div className="relative z-10 flex-1 flex items-center" style={{ maxWidth: 980, margin: '0 auto', padding: '80px 40px 72px', display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 56, alignItems: 'center', width: '100%' }}>
        <div>
          <p style={{ fontSize: 12, color: '#9BA1AE', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981', display: 'inline-block' }} />
            AI marketing platform for small businesses
          </p>
          <h1 style={{ fontSize: 44, fontWeight: 500, lineHeight: 1.08, color: '#111', letterSpacing: '-0.025em', marginBottom: 14 }}>
            Meet <em style={{ fontStyle: 'normal', color: '#F5349B' }}>Maya</em>,<br />
            the marketing team<br />
            that never clocks out.
          </h1>
          <p style={{ fontSize: 16, color: '#6B7280', lineHeight: 1.6, marginBottom: 8 }}>
            Campaigns planned, copy drafted, content posted — in your voice, approved by you.
          </p>
          <p style={{ fontSize: 12, fontWeight: 500, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#9BA1AE', marginBottom: 28 }}>
            No agency. No busywork. No missed momentum.
          </p>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <a href="#" style={{ background: '#3B82F6', color: '#fff', fontSize: 14, fontWeight: 500, padding: '11px 24px', borderRadius: 8, border: 'none', textDecoration: 'none' }}>Get access</a>
            <a href="#" style={{ background: '#fff', color: '#374151', fontSize: 14, padding: '11px 18px', borderRadius: 8, border: '0.5px solid #E5E7EB', textDecoration: 'none' }}>▷ See how it works</a>
          </div>
        </div>
        <HeroScreen />
      </div>
    </div>
  );
}

function TrustBar() {
  return (
    <div style={{ background: '#F9FAFB', borderTop: '0.5px solid #F3F4F6', borderBottom: '0.5px solid #F3F4F6', padding: '14px 40px', textAlign: 'center' }}>
      <p style={{ fontSize: 11, color: '#9BA1AE', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
        Trusted by small business owners, local brands, and solo founders
      </p>
    </div>
  );
}

/* Feature row component */
function FeatRow({
  flip, relief, headline, scene, bullets, screen,
}: {
  flip?: boolean;
  relief: string;
  headline: React.ReactNode;
  scene: string;
  bullets: string[];
  screen: React.ReactNode;
}) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)',
      gap: 48,
      alignItems: 'center',
      padding: '48px 0',
      borderTop: '0.5px solid #F3F4F6',
    }}>
      <div style={{ order: flip ? 2 : 1 }}>
        <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9BA1AE', marginBottom: 10 }}>{relief}</div>
        <h3 style={{ fontSize: 26, fontWeight: 500, color: '#111', letterSpacing: '-0.01em', lineHeight: 1.2, marginBottom: 10 }}>{headline}</h3>
        <p style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.7, marginBottom: 18 }}>{scene}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {bullets.map((b) => (
            <div key={b} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, color: '#374151', lineHeight: 1.5 }}>
              <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                <Check size={10} color="#10B981" />
              </div>
              {b}
            </div>
          ))}
        </div>
      </div>
      <div style={{ order: flip ? 1 : 2 }}>{screen}</div>
    </div>
  );
}

function Features() {
  return (
    <div style={{ padding: '80px 40px', maxWidth: 980, margin: '0 auto' }}>
      <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#3B82F6', marginBottom: 12 }}>
        The kind of help that keeps up with everything you do
      </div>
      <h2 style={{ fontSize: 34, fontWeight: 500, color: '#111', letterSpacing: '-0.015em', marginBottom: 10, lineHeight: 1.15 }}>
        Now in your corner.<br />Maya runs your marketing<br />the way a world-class team would.
      </h2>
      <p style={{ fontSize: 15, color: '#6B7280', lineHeight: 1.7, maxWidth: 520, marginBottom: 48 }}>
        Over 8 hours a week of marketing work — planned, drafted, scheduled, and sent — while you run your business.
      </p>

      <FeatRow
        relief="Campaigns"
        headline={<>Your week,<br />promoted.</>}
        scene="You say the offer. Maya builds the full push — email, posts, captions — and has it ready before you close your laptop."
        bullets={[
          'The campaign drafted while you were on the job',
          'Every channel covered, nothing left to figure out',
          'Ready to approve, not ready to start from scratch',
        ]}
        screen={<CampaignScreen />}
      />

      <FeatRow
        flip
        relief="Content"
        headline={<>The feed,<br />handled.</>}
        scene="Your social presence stays alive even on your busiest weeks. Maya posts in your voice so it always sounds like you — not like software."
        bullets={[
          'Posts written the way you\'d write them',
          'Scheduled and out without touching a tool',
          'Consistent even when life isn\'t',
        ]}
        screen={<CalendarScreen />}
      />

      <FeatRow
        relief="Follow-up"
        headline={<>The leads,<br />still warm.</>}
        scene="The inquiry from Tuesday. The customer you meant to win back. The review that deserved a reply. Maya catches what slips through."
        bullets={[
          'Cold leads followed up before they go cold for good',
          'Reviews answered in your voice, same day',
          'Nothing dropped because you were heads-down',
        ]}
        screen={<LeadsScreen />}
      />

      <FeatRow
        flip
        relief="Competitors"
        headline={<>The market,<br />watched.</>}
        scene="Maya tracks what your competitors are running so you're never the last to know — and never caught flat-footed on a Monday."
        bullets={[
          'Rival promotions flagged before they cost you',
          'Trends surfaced before they peak',
          'You move first, not in reaction',
        ]}
        screen={<CompetitorScreen />}
      />
    </div>
  );
}

function ForSection() {
  const tiles = [
    { icon: ShoppingBag, label: 'E-commerce brands', sub: 'The store stops going quiet between launches.', slug: 'ecommerce' },
    { icon: MapPin, label: 'Local service businesses', sub: 'Stay visible without staying up late.', slug: 'local-service' },
    { icon: User, label: 'Creators & solo founders', sub: 'Finally be in two places at once.', slug: 'coaches-creators' },
    { icon: Building, label: 'Agencies', sub: 'The production capacity you\'d otherwise hire.', slug: 'agencies' },
  ];
  return (
    <div style={{ background: '#F9FAFB', borderTop: '0.5px solid #F3F4F6', padding: '72px 40px' }}>
      <div style={{ maxWidth: 980, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#3B82F6', marginBottom: 12 }}>
            Built for the way you work
          </div>
          <h2 style={{ fontSize: 34, fontWeight: 500, color: '#111', letterSpacing: '-0.015em', lineHeight: 1.15 }}>
            Maya is built for your kind of business.
          </h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 }}>
          {tiles.map(({ icon: Icon, label, sub, slug }) => (
            <Link
              key={slug}
              href={`/lab-use-cases/${slug}`}
              style={{ border: '0.5px solid #E5E7EB', borderRadius: 12, padding: 20, background: '#fff', textDecoration: 'none', display: 'block' }}
            >
              <div style={{ marginBottom: 12, color: '#6B7280' }}><Icon size={22} /></div>
              <div style={{ fontSize: 14, fontWeight: 500, color: '#111', marginBottom: 5 }}>{label}</div>
              <p style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.55, marginBottom: 10 }}>{sub}</p>
              <span style={{ fontSize: 11, color: '#3B82F6', display: 'flex', alignItems: 'center', gap: 3 }}>
                Learn more <ArrowRight size={10} />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function CtaSection() {
  return (
    <div style={{ background: '#111', padding: '80px 40px', textAlign: 'center' }}>
      <h2 style={{ fontSize: 36, fontWeight: 500, color: '#fff', letterSpacing: '-0.02em', lineHeight: 1.15, marginBottom: 12 }}>
        Work like you have a full<br />marketing team.<br />Because now you do.
      </h2>
      <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.5)', marginBottom: 32, lineHeight: 1.6 }}>
        Hire Maya and spend your hours on the work only you can do.
      </p>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
        <a href="#" style={{ background: '#fff', color: '#111', fontSize: 14, fontWeight: 500, padding: '11px 24px', borderRadius: 8, border: 'none', textDecoration: 'none' }}>Get access</a>
        <Link href="/lab-use-cases" style={{ background: 'transparent', color: 'rgba(255,255,255,0.6)', fontSize: 14, padding: '11px 18px', borderRadius: 8, border: '0.5px solid rgba(255,255,255,0.2)', textDecoration: 'none' }}>See use cases</Link>
      </div>
    </div>
  );
}

function Footer() {
  return (
    <footer style={{ background: '#fff', borderTop: '0.5px solid #E5E7EB', padding: '40px 40px 24px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.5fr) repeat(3,minmax(0,1fr))', gap: 32, marginBottom: 32 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <div style={{ width: 22, height: 22, background: '#111', borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 500, color: '#F5349B' }}>7</div>
            <span style={{ fontSize: 13, fontWeight: 500, color: '#111' }}>AGENT<span style={{ color: '#F5349B' }}>7</span>EVEN</span>
          </div>
          <p style={{ fontSize: 12, color: '#9BA1AE', marginTop: 8, lineHeight: 1.6, maxWidth: 180 }}>The AI-first marketing platform for small businesses.</p>
        </div>
        {[
          { heading: 'Product', links: ['Maya', 'Agents', 'Canvas', 'Pricing'] },
          { heading: 'Use cases', links: ['E-commerce', 'Local service', 'Creators', 'Agencies'] },
          { heading: 'Company', links: ['About', 'Blog', 'Contact', 'Privacy'] },
        ].map(({ heading, links }) => (
          <div key={heading}>
            <h4 style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9BA1AE', marginBottom: 12 }}>{heading}</h4>
            {links.map((l) => (
              <a key={l} href="#" style={{ display: 'block', fontSize: 12, color: '#6B7280', textDecoration: 'none', marginBottom: 7 }}>{l}</a>
            ))}
          </div>
        ))}
      </div>
      <div style={{ borderTop: '0.5px solid #F3F4F6', paddingTop: 20, display: 'flex', justifyContent: 'space-between' }}>
        <p style={{ fontSize: 11, color: '#9BA1AE' }}>© 2026 Agent7even. All rights reserved.</p>
        <p style={{ fontSize: 11, color: '#9BA1AE' }}>Privacy · Terms</p>
      </div>
    </footer>
  );
}

/* ══════════════════════════════════════════════════════════════════
   PAGE ROOT
   ══════════════════════════════════════════════════════════════════ */
export default function Lab3Page() {
  return (
    <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <Hero />
      <TrustBar />
      <Features />
      <ForSection />
      <CtaSection />
      <Footer />

      <div className="fixed bottom-4 right-4 z-50 bg-black/70 text-white text-xs px-3 py-1.5 rounded-full backdrop-blur-sm">
        🧪 /lab3
      </div>
    </div>
  );
}
