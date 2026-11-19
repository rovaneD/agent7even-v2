import type { CSSProperties, ReactNode } from 'react'
import Link from 'next/link'
import VoixHero from './VoixHero'
import PilotForm from './PilotForm'
import MissedCallCost from './MissedCallCost'
import VoixTracker from './VoixTracker'
import { DEMO_TEL, SALES_TEL, blue, body, eyebrow, h2, ink, line, muted, pillDark, pillLight, sans, serif, wrap } from './voixStyles'

const blueOrb = 'radial-gradient(circle at 35% 30%, #FFFFFF 0%, #A9C8FF 38%, #3A6FF2 100%)'

const card: CSSProperties = { borderRadius: 24, overflow: 'hidden', minHeight: 520, padding: '28px 28px 36px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 32 }
const lightCard: CSSProperties = { ...card, background: '#F3F4F6' }
const cardH3: CSSProperties = { margin: 0, fontSize: 21, fontWeight: 600 }

function FeatureFoot({ title, text, dark }: { title: string; text: string; dark?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 40, color: dark ? '#FFFFFF' : ink }}>
      <h3 style={cardH3}>{title}</h3>
      <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55, color: dark ? 'rgba(255,255,255,0.9)' : body }}>{text}</p>
    </div>
  )
}

function Num({ n, dark }: { n: string; dark?: boolean }) {
  return <span style={{ fontSize: 12, color: dark ? 'rgba(255,255,255,0.85)' : muted }}>{n}</span>
}

function Step({ n, title, children }: { n: string; title: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, borderTop: '1px solid #D5D8E0', paddingTop: 24 }}>
      <span style={{ fontFamily: serif, fontSize: 44, lineHeight: 1, color: blue }}>{n}</span>
      <h3 style={{ margin: 0, fontSize: 19, fontWeight: 600 }}>{title}</h3>
      <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: body }}>{children}</p>
    </div>
  )
}

/** Sales-line CTA: says what the button does, with the number in small type. */
function ExperienceVoix() {
  if (!SALES_TEL) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
      <a href={SALES_TEL} style={{ ...pillDark, padding: '12px 20px', fontSize: 14, whiteSpace: 'nowrap' }}>
        Experience Voix
      </a>
      {/* Non-breaking space and hyphen keep "No sign-up." together (no widow). */}
      <span style={{ fontSize: 12, lineHeight: 1.4, color: muted }}>{'Starts a call to our AI line. No\u00a0sign\u2011up.'}</span>
    </div>
  )
}

const faqs: [string, string][] = [
  ['Will callers know they’re talking to an AI?', 'Yes. Voix says so at the start of every call, and callers can ask for a person at any time.'],
  ['Does it replace my front desk?', 'No. It covers the calls your team can’t take, so they can focus on the clients in front of them.'],
  ['Can I change what it says?', 'Anytime. Update a price, policy or special, approve it, and Voix uses it from the next call.'],
  ['Do I need a new phone number?', 'No. You forward missed and after-hours calls to Voix. Your number stays the same.'],
  ['How many spas are in the pilot?', 'Ten founding spas. We review every application and pick spas where Voix can make the biggest difference. If the first group fills, we’ll offer you a place in the next one.'],
  ['Which booking software does Voix work with?', 'All of them, in request mode: Voix collects the service and the time that suits the caller, and your team confirms it in your own software. We’re building direct booking system by system, starting with the systems our pilot spas use. Tell us yours in the application.'],
  ['What does it cost after the pilot?', 'Founding spas pay $149 a month per location, with unlimited calls, and keep that price for 12 months. No setup fee, no contract. If you don’t continue after the 14 days, you simply stop forwarding calls.'],
]

const safety: [string, string][] = [
  ['Honest from the first word.', 'Every call opens by saying it’s an AI assistant for your spa.'],
  ['No medical advice.', 'Questions about suitability, medications or side effects go to a provider callback.'],
  ['Urgent concerns go straight to people.', 'A caller describing a reaction is told to call 911 if it’s an emergency, and your team is alerted for an urgent callback.'],
  ['Only what booking needs.', 'Name, contact details, service and time. Nothing more.'],
]

export default function VoixLanding() {
  return (
    <div style={{ fontFamily: sans, color: ink, background: '#FFFFFF', width: '100%' }}>
      <VoixTracker />
      <header style={{ ...wrap, paddingTop: 20, paddingBottom: 20, display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16, borderBottom: `1px solid ${line}` }}>
        <Link href="/voix" style={{ display: 'flex', alignItems: 'baseline', gap: 10, textDecoration: 'none', color: ink }}>
          <span style={{ fontFamily: serif, fontSize: 34, letterSpacing: '-0.01em', lineHeight: 1 }}>Voix</span>
          <span style={{ fontSize: 12, color: muted }}>by Agent7even</span>
        </Link>
        <nav aria-label="Voix" style={{ display: 'flex', flexWrap: 'wrap', gap: 'clamp(16px, 3vw, 40px)', fontSize: 15 }}>
          <a href="#how" style={{ color: ink, textDecoration: 'none' }}>How it works</a>
          <a href="#features" style={{ color: ink, textDecoration: 'none' }}>Features</a>
          <a href="#safety" style={{ color: ink, textDecoration: 'none' }}>Safety</a>
          <a href="#faq" style={{ color: ink, textDecoration: 'none' }}>FAQ</a>
        </nav>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {DEMO_TEL && <a href={DEMO_TEL} style={{ ...pillLight, padding: '13px 22px', fontSize: 15 }}>Call the spa demo</a>}
          <a href="#pilot" style={{ ...pillDark, padding: '13px 22px', fontSize: 15 }}>Apply for a pilot spot</a>
        </div>
      </header>

      <main>
        <section id="top" style={{ ...wrap, paddingTop: 28, paddingBottom: 72, display: 'flex', flexWrap: 'wrap', gap: 48, alignItems: 'stretch' }}>
          <div style={{ flex: '1 1 400px', minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 48, paddingTop: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
              <p style={{ margin: 0, alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: muted, background: '#F2F3F6', borderRadius: 999, padding: '7px 14px' }}>
                <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: 999, background: blue, display: 'inline-block' }} />
                Applications open for 10 founding pilot spas
              </p>
              <h1 style={{ margin: 0, fontFamily: serif, fontWeight: 400, fontSize: 'clamp(52px, 7vw, 88px)', lineHeight: 0.95, letterSpacing: '-0.025em' }}>The front desk that never misses a call.</h1>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <p style={{ margin: 0, fontSize: 17, lineHeight: 1.6, color: body, maxWidth: 440 }}>An AI receptionist customized to your med spa. Voix answers missed and after-hours calls in your spa’s voice, uses only the answers you approve, and captures every consultation request.</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                <a href="#pilot" style={pillDark}>Apply for one of 10 spots</a>
                <a href="#how" style={pillLight}>See how it works</a>
              </div>
              <p style={{ margin: 0, fontSize: 13, color: muted }}>Your number. Your voice. Always there.</p>
              {SALES_TEL && (
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 14, marginTop: 12, maxWidth: 560 }}>
                  <span aria-hidden="true" style={{ flex: '0 0 auto', width: 36, height: 36, borderRadius: 999, background: 'radial-gradient(circle at 35% 30%, #FFFFFF 0%, #C9D4FF 35%, #3355D6 100%)' }} />
                  <div style={{ flex: '1 1 300px', minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Rather talk it through?</p>
                    <p style={{ margin: '2px 0 0', fontSize: 14, lineHeight: 1.5, color: body }}>Talk to Voix live. It answers your questions<br /><span style={{ whiteSpace: 'nowrap' }}>and can request your setup call.</span></p>
                  </div>
                  <ExperienceVoix />
                </div>
              )}
            </div>
          </div>
          <VoixHero />
        </section>

        <MissedCallCost />

        <section id="features" style={{ borderTop: `1px solid ${line}` }}>
          <div style={{ ...wrap, paddingTop: 72, paddingBottom: 96, display: 'flex', flexDirection: 'column', gap: 48 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end', gap: 32 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 720 }}>
                <p style={eyebrow}>Every call, handled with care</p>
                <h2 style={h2}>Built for the way a med spa actually runs.</h2>
              </div>
              <p style={{ margin: 0, fontSize: 16, lineHeight: 1.6, color: body, maxWidth: 420 }}>Booking is only half the job. Voix knows when to hand off, never takes card numbers, and stays inside the answers you approve.</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(340px, 100%), 1fr))', gap: 14 }}>
              <div style={{ ...card, background: 'radial-gradient(120% 100% at 25% 10%, #C6E4F1 0%, #5B9CC3 48%, #1E5A86 100%)', color: '#FFFFFF' }}>
                <Num n="01" dark />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ background: '#FFFFFF', borderRadius: 20, padding: '18px 20px', display: 'flex', gap: 14, alignItems: 'center', color: ink }}>
                    <span aria-hidden="true" style={{ flex: '0 0 auto', width: 40, height: 40, borderRadius: 999, background: blueOrb }} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><strong style={{ fontSize: 15 }}>Voix</strong><span style={{ fontSize: 13, color: muted }}>8:42 pm</span></div>
                      <span style={{ fontSize: 14, color: body }}>Lip filler consult booked · Fri 11:00</span>
                    </div>
                  </div>
                  <p style={{ margin: 0, fontSize: 14, paddingLeft: 6, color: 'rgba(255,255,255,0.92)' }}>Summary sent to your front desk</p>
                </div>
                <FeatureFoot dark title="Captures requests while you’re closed" text="Evening and weekend callers get a real conversation and a request your team confirms, not a recording that lists your hours." />
              </div>

              <div style={lightCard}>
                <Num n="02" />
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                  <span style={{ fontSize: 13, color: muted }}>Thursday · Friday</span>
                  <span style={{ fontSize: 18, fontWeight: 500 }}>Open consult times</span>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, width: '100%', maxWidth: 300 }}>
                    {['Thu 2:00', 'Thu 4:30', 'Fri 11:00 ✓', 'Fri 3:15'].map((t) => {
                      const on = t.includes('✓')
                      return <span key={t} style={{ background: on ? ink : '#E4E6EB', color: on ? '#FFFFFF' : ink, fontWeight: on ? 600 : 400, borderRadius: 12, padding: '16px 0', textAlign: 'center', fontSize: 15 }}>{t}</span>
                    })}
                  </div>
                </div>
                <FeatureFoot title="Works with your booking software" text="Voix collects the service and the time that suits the caller. Your team confirms it in the software you already use." />
              </div>

              <div style={{ ...card, background: 'radial-gradient(120% 100% at 30% 10%, #E2CDB2 0%, #B08862 50%, #744B32 100%)', color: '#FFFFFF' }}>
                <Num n="03" dark />
                <div style={{ background: 'rgba(70,46,30,0.6)', borderRadius: 20, padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <span style={{ fontSize: 15, fontWeight: 600 }}>Approved answer</span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <span style={{ fontSize: 13, padding: '6px 14px', borderRadius: 999, background: 'rgba(255,255,255,0.14)' }}>Draft</span>
                    <span style={{ fontSize: 13, padding: '6px 14px', borderRadius: 999, background: '#E9D2B4', color: '#4A2F1E', fontWeight: 500 }}>Approved</span>
                  </div>
                  <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, background: 'rgba(255,255,255,0.12)', borderRadius: 14, padding: 14 }}>“Lip filler pricing starts at your listed rate per syringe. Your provider confirms at a free consultation.”</p>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)' }}>Approved by the spa owner · used from the next call</span>
                </div>
                <FeatureFoot dark title="You approve every answer" text="Prices, policies and specials say exactly what you approved. Nothing goes live without you." />
              </div>

              <div style={{ ...lightCard, minHeight: 500 }}>
                <Num n="04" />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <span style={{ fontSize: 13, color: muted, paddingLeft: 4 }}>Text message</span>
                  <p style={{ margin: 0, background: '#FFFFFF', borderRadius: 18, padding: '18px 20px', fontSize: 15, lineHeight: 1.5 }}>For your security, I can’t take card details over the phone.</p>
                  <span style={{ alignSelf: 'flex-start', fontSize: 14, background: ink, color: '#FFFFFF', borderRadius: 999, padding: '10px 18px' }}>Deposits stay with your team</span>
                </div>
                <FeatureFoot title="No card numbers on calls" text="Voix never asks for card details over the phone. Deposits stay in your booking software." />
              </div>

              <div style={{ ...card, minHeight: 500, background: 'radial-gradient(120% 100% at 30% 0%, #6A7A96 0%, #2E3C58 50%, #141B2D 100%)', color: '#FFFFFF' }}>
                <Num n="05" dark />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ background: '#FFFFFF', borderRadius: 18, padding: 20, display: 'flex', flexDirection: 'column', gap: 10, color: ink }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><strong style={{ fontSize: 14 }}>Provider callback requested</strong><span style={{ fontSize: 12, color: '#B4532A', fontWeight: 600 }}>Priority</span></div>
                    <span style={{ fontSize: 14, color: body, lineHeight: 1.5 }}>Caller asked whether filler is safe with a medication. No advice given. Routed to a provider.</span>
                  </div>
                  <p style={{ margin: 0, fontSize: 13, paddingLeft: 4, color: 'rgba(255,255,255,0.85)' }}>Your team takes it from here.</p>
                </div>
                <FeatureFoot dark title="Clinical questions go to your team" text="Voix never gives medical advice. Urgent concerns are flagged to your team right away." />
              </div>

              <div style={{ ...lightCard, minHeight: 500 }}>
                <Num n="06" />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[
                    ['Line 1', 'Lip filler consult', 'Request sent'],
                    ['Line 2', 'Pricing question', 'Answered'],
                    ['Line 3', 'Reschedule', 'Request: Mon'],
                  ].map(([lineName, topic, outcome]) => (
                    <div key={lineName} style={{ background: '#FFFFFF', borderRadius: 16, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span aria-hidden="true" style={{ flex: '0 0 auto', width: 10, height: 10, borderRadius: 999, background: '#2F9E6E' }} />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
                        <span style={{ fontSize: 12, color: muted }}>{lineName} · live</span>
                        <span style={{ fontSize: 14 }}>{topic}</span>
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{outcome}</span>
                    </div>
                  ))}
                </div>
                <FeatureFoot title="Every caller, at the same time" text="On launch days and Monday mornings, Voix answers several calls at once. Nobody hears a busy signal or waits on hold." />
              </div>
            </div>
          </div>
        </section>

        <section id="how">
          <div style={{ ...wrap, paddingTop: 24, paddingBottom: 96, display: 'flex', flexDirection: 'column', gap: 48 }}>
            <h2 style={h2}>Live in days. Your voice, your rules.</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))', gap: 40 }}>
              <Step n="01" title="We learn your spa">One 30-minute call covers your treatments, pricing, policies and how you like to sound. We handle the setup.</Step>
              <Step n="02" title="You approve every answer">Review the script and the answers Voix can give. Nothing goes live until you approve it.</Step>
              <Step n="03" title="Voix answers and captures requests">Forward missed and after-hours calls. Your number stays the same, and you get a summary of every call.</Step>
            </div>
          </div>
        </section>

        <section id="safety" style={{ ...wrap, paddingBottom: 96 }}>
          <div style={{ background: ink, color: '#F2F3F7', borderRadius: 28, padding: 'clamp(32px, 5vw, 56px) clamp(24px, 4vw, 40px)', display: 'flex', flexWrap: 'wrap', gap: 56 }}>
            <div style={{ flex: '1 1 380px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 18 }}>
              <p style={{ ...eyebrow, color: '#AEB6CC' }}>Built for medical aesthetics</p>
              <h2 style={{ ...h2, fontSize: 'clamp(40px, 4.5vw, 56px)' }}>A receptionist, never a provider.</h2>
              <p style={{ margin: 0, fontSize: 16, lineHeight: 1.6, color: '#C9CEDD' }}>Voix takes booking requests and answers the questions you’ve approved. Clinical decisions stay with your team.</p>
            </div>
            <ul style={{ flex: '1 1 440px', minWidth: 0, margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 20, fontSize: 15, lineHeight: 1.55 }}>
              {safety.map(([t, d]) => (
                <li key={t} style={{ borderTop: '1px solid #343D55', paddingTop: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <strong style={{ color: '#FFFFFF', fontWeight: 600 }}>{t}</strong>
                  <span style={{ color: '#C9CEDD' }}>{d}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="pilot" style={{ background: '#F3F4F6' }}>
          <div style={{ ...wrap, paddingTop: 88, paddingBottom: 88, display: 'flex', flexWrap: 'wrap', gap: 64, alignItems: 'flex-start' }}>
            <div style={{ flex: '1 1 440px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 24, paddingTop: 16 }}>
              <p style={eyebrow}>Founding pilot</p>
              <h2 style={h2}>Try Voix free for 14 days.</h2>
              <p style={{ margin: 0, fontSize: 16, lineHeight: 1.6, color: body, maxWidth: 460 }}>We’re opening 10 founding spots and working closely with each spa to get Voix right. We review every application and reply within one business day. We do the setup; you tell us what works.</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 40, marginTop: 8 }}>
                <div style={{ flex: '1 1 200px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>You get</h3>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, lineHeight: 1.75, color: body }}>
                    <li>Full setup, at no cost</li>
                    <li>14 days of answered calls</li>
                    <li>A results report at the end</li>
                  </ul>
                </div>
                <div style={{ flex: '1 1 200px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>We ask for</h3>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, lineHeight: 1.75, color: body }}>
                    <li>A 30-minute setup call</li>
                    <li>Access to your booking software</li>
                    <li>A short weekly check-in</li>
                  </ul>
                </div>
              </div>
              {SALES_TEL && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, background: '#FFFFFF', borderRadius: 20, padding: '18px 20px', marginTop: 8, maxWidth: 620 }}>
                  <span aria-hidden="true" style={{ flex: '0 0 auto', width: 40, height: 40, borderRadius: 999, background: 'radial-gradient(circle at 35% 30%, #FFFFFF 0%, #C9D4FF 35%, #3355D6 100%)' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Rather talk it through?</p>
                    <p style={{ margin: '2px 0 0', fontSize: 14, lineHeight: 1.5, color: body }}>Talk to Voix live. It answers your questions<br /><span style={{ whiteSpace: 'nowrap' }}>and can request your setup call.</span></p>
                  </div>
                  <ExperienceVoix />
                </div>
              )}
            </div>
            <PilotForm />
          </div>
        </section>

        <section id="faq">
          <div style={{ ...wrap, paddingTop: 88, paddingBottom: 88, display: 'flex', flexWrap: 'wrap', gap: 64 }}>
            <div style={{ flex: '1 1 320px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <p style={eyebrow}>Good to know</p>
              <h2 style={h2}>Questions, answered.</h2>
            </div>
            <div style={{ flex: '2 1 560px', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
              {faqs.map(([q, a], i) => (
                <div key={q} style={{ borderTop: '1px solid #E1E4EA', borderBottom: i === faqs.length - 1 ? '1px solid #E1E4EA' : undefined, padding: '24px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{q}</h3>
                  <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: body }}>{a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer style={{ background: ink, color: '#C9CEDD' }}>
        <div style={{ ...wrap, paddingTop: 56, paddingBottom: 56, display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end', gap: 24, fontSize: 13 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <span style={{ fontFamily: serif, fontSize: 56, lineHeight: 1, color: '#FFFFFF' }}>Voix</span>
            <span>A product of Agent7even, alongside Maya and Atlas.</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 40 }}>
            <Link href="/" style={{ color: '#C9CEDD', textDecoration: 'none' }}>agent7even.ai</Link>
            <Link href="/privacy" style={{ color: '#C9CEDD', textDecoration: 'none' }}>Privacy</Link>
            <Link href="/terms" style={{ color: '#C9CEDD', textDecoration: 'none' }}>Terms</Link>
            <span>© 2026 Agent7even</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
