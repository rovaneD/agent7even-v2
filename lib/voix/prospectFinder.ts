import { generateText } from 'ai'
import Exa from 'exa-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import { openrouter } from '@/lib/ai/client'
import { normalizeInstagram } from '@/lib/voix/pilotRequests'

/**
 * Outreach top-up for Voix. When every spa in Outreach has been contacted,
 * research the next batch of independent med spas anywhere in the US and add them
 * as "To contact" with an outreach plan in the notes:
 *   1. an after-hours call (if nobody answers, that missed call is the pitch),
 *   2. an email built around that call,
 *   3. an Instagram DM as a backup (DMs from non-followers land in message requests).
 *
 * Search: Exa (3 city searches). Writing: one Claude call over the candidates.
 * Roughly a few cents per run.
 */

export const BATCH_SIZE = 5
const MODEL = 'anthropic/claude-sonnet-5.5'
const STALE_RUN_MS = 5 * 60 * 1000

export type TopUpTrigger = 'queue_empty' | 'cron' | 'manual'
export type TopUpResult =
  | { ran: false; reason: string }
  | { ran: true; added: number; candidates: number; spas: string[] }

// Metros to rotate through. Three are picked per run, skipping cities we already have most of.
const CITIES = [
  'Phoenix, AZ', 'Scottsdale, AZ', 'Tucson, AZ', 'San Diego, CA', 'Sacramento, CA', 'San Jose, CA', 'Fresno, CA',
  'Denver, CO', 'Colorado Springs, CO', 'Miami, FL', 'Tampa, FL', 'Orlando, FL', 'Jacksonville, FL', 'Naples, FL',
  'Atlanta, GA', 'Boise, ID', 'Chicago, IL', 'Indianapolis, IN', 'Louisville, KY', 'New Orleans, LA', 'Boston, MA',
  'Baltimore, MD', 'Detroit, MI', 'Minneapolis, MN', 'Kansas City, MO', 'St. Louis, MO', 'Charlotte, NC', 'Raleigh, NC',
  'Omaha, NE', 'Las Vegas, NV', 'Albuquerque, NM', 'Columbus, OH', 'Cincinnati, OH', 'Tulsa, OK', 'Portland, OR',
  'Philadelphia, PA', 'Pittsburgh, PA', 'Charleston, SC', 'Nashville, TN', 'Memphis, TN', 'Austin, TX', 'Dallas, TX',
  'Houston, TX', 'San Antonio, TX', 'Fort Worth, TX', 'Salt Lake City, UT', 'Richmond, VA', 'Seattle, WA', 'Spokane, WA',
  'Milwaukee, WI',
]

// Directories, social sites and booking platforms: never a spa's own site.
const EXCLUDE_DOMAINS = [
  'yelp.com', 'groupon.com', 'facebook.com', 'instagram.com', 'tiktok.com', 'linkedin.com', 'realself.com',
  'yellowpages.com', 'mapquest.com', 'healthgrades.com', 'vagaro.com', 'fresha.com', 'booksy.com', 'zocdoc.com',
  'americanmedspa.org', 'reddit.com', 'youtube.com', 'tripadvisor.com', 'bbb.org', 'allure.com', 'thumbtack.com',
]

// Large chains: they buy through head office, not a quick owner yes.
const CHAIN_HINTS = [
  'nakedmd', 'idealimage', 'laseraway', 'skinlaundry', 'everbody', 'alchemy43', 'thelipbar', 'radiancemedspa',
  'milanlaser', 'sono-bello', 'sonobello', 'lasercliniquemedspa', 'skinspirit', 'heydaypartners', 'massageenvy',
  'hand-and-stone', 'handandstone', 'face-foundrie', 'facefoundrie', 'hydrafacial.com', 'botoxcosmetic.com', 'allergan',
  'aesthetics-360', 'beautyandthemed', 'unveilmedspa', 'evolve-medspa', 
]

type Candidate = { url: string; host: string; title: string; text: string; emails: string[]; phones: string[] }

type Pick = {
  website: string
  spa_name: string
  city: string
  instagram: string | null
  contact_name: string | null
  phone: string | null
  email: string | null
  angle: string
  call_note: string
  email_subject: string
  email_body: string
  dm: string
  checks: string
}

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi
const PHONE_RE = /(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g
const JUNK_EMAIL = /(example|sentry|wixpress|domain\.com|yourname|email\.com|\.(png|jpe?g|gif|webp|svg)$)/i

function contactsIn(text: string): { emails: string[]; phones: string[] } {
  const emails = [...new Set((text.match(EMAIL_RE) ?? []).map((e) => e.toLowerCase()).filter((e) => !JUNK_EMAIL.test(e)))]
  const phones = [...new Set((text.match(PHONE_RE) ?? []).map((p) => p.trim()))]
  return { emails: emails.slice(0, 3), phones: phones.slice(0, 3) }
}

export function hostOf(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    return new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).host.replace(/^www\./, '').toLowerCase()
  } catch {
    return null
  }
}

function pickCities(existingCities: string[], n = 3): string[] {
  const counts = new Map<string, number>()
  for (const c of existingCities) {
    const key = c.toLowerCase()
    for (const city of CITIES) if (key.includes(city.split(',')[0].toLowerCase())) counts.set(city, (counts.get(city) ?? 0) + 1)
  }
  const pool = [...CITIES].sort(() => Math.random() - 0.5).sort((a, b) => (counts.get(a) ?? 0) - (counts.get(b) ?? 0))
  return pool.slice(0, n)
}

async function searchCandidates(cities: string[], skipHosts: Set<string>): Promise<Candidate[]> {
  const key = process.env.EXA_API_KEY
  if (!key) throw new Error('EXA_API_KEY is not set')
  const exa = new Exa(key)
  const results = await Promise.all(
    cities.map((city) =>
      exa
        .search(`independent med spa in ${city} offering Botox, fillers and free consultations`, {
          type: 'auto',
          numResults: 10,
          excludeDomains: EXCLUDE_DOMAINS,
          contents: { text: { maxCharacters: 8000 } },
        })
        .then((r) => r.results ?? [])
        .catch((err) => {
          console.error('[voix/prospectFinder] Exa search failed for', city, err)
          return []
        })
    )
  )
  const seen = new Set<string>()
  const out: Candidate[] = []
  for (const r of results.flat()) {
    const host = hostOf(r.url)
    if (!host || seen.has(host) || skipHosts.has(host)) continue
    if (CHAIN_HINTS.some((c) => host.includes(c))) continue
    const text = (r as { text?: string }).text?.trim()
    if (!text) continue
    seen.add(host)
    out.push({ url: r.url, host, title: r.title ?? '', text, ...contactsIn(text) })
  }
  return out.slice(0, 18)
}

const SYSTEM = `You research med spas for Voix, an AI receptionist for med spas made by Agent7even.
Voix answers every call, handles treatment questions and books consultations, even when the team is busy or closed.
Pilot offer (use exactly these facts, nothing else): 10 pilot spots, 14 days free, no credit card. Sign-up: agent7even.ai/voix.

From the candidate websites, choose the spas that best fit the pilot:
- Independent, owner-run, 1 to 3 locations. Reject chains, franchise networks with many studios, hospitals,
  dermatology groups with many doctors, directories, blogs, product brands and anything that is not a med spa's own site.
- Prefer spas with a phone number AND an email address on the site. Short hours, no weekend hours, a request form for
  new patients, free or paid consultations, current specials or a small team are good angles.

Outreach leads with a phone call, then an email. Instagram DMs are only a backup, because DMs from accounts they
don't follow land in message requests. For each chosen spa, write:
- angle: one sentence on why Voix fits this spa, based only on facts in its text.
- call_note: when to call and what to listen for. Pick a time when the front desk is likely closed or busy, based on
  the hours in the text if given (say "after closing" or "at lunch" if hours are unknown), and give it in the spa's
  local time. If someone answers, ask who manages the front desk and phones.
- email_subject: short and plain, e.g. "I called <Spa name> at [time]".
- email_body: an email to send after the call, under 120 words. Open with the missed call using placeholders the sender
  fills in: "I called <Spa name> on [day] at [time] and [it went to voicemail / no one picked up]." Then: if that was a
  new client, they'd likely have booked with the next spa that answered. Then one specific, true compliment from the
  site. Then introduce Voix in one sentence (answers every call, handles treatment questions, books consultations,
  even when the team is busy or closed). Then the pilot offer and a question: "Would you be open to trying it?"
  Sign off as "Rovane, Agent7even". Address it to the owner by name only if the site clearly names them, else "Hi <Spa name> team".
  Plain and friendly, no emoji, no links, no em dashes. Do not add an address or unsubscribe line; the sender adds it.
- dm: a short Instagram DM backup (3 to 4 sentences, same facts, ends with the same question).
- checks: what to verify before sending (unconfirmed owner, unknown hours, dated specials, agency-run site, no email found, etc.).

Rules: use only facts that appear in the candidate text. Never invent names, numbers, hours, reviews, emails or handles.
email: choose from "Emails found" for that candidate (prefer info@, hello@, contact@, front desk), else null.
phone: choose from "Phones found" or the text, else null. instagram: the handle only if it appears in the text, else null.
contact_name: only if the site names the owner or lead provider, else null. city: "City, ST".
Return ONLY JSON: {"picks":[{"website":"","spa_name":"","city":"","instagram":null,"contact_name":null,"phone":null,
"email":null,"angle":"","call_note":"","email_subject":"","email_body":"","dm":"","checks":""}]}.
Return at most the number asked for, fewer if fewer fit.`

function stripFence(raw: string): string {
  return raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
}

async function choosePicks(candidates: Candidate[], count: number): Promise<Pick[]> {
  const listing = candidates
    .map(
      (c, i) =>
        `### Candidate ${i + 1}\nURL: ${c.url}\nTitle: ${c.title}\nEmails found: ${c.emails.join(', ') || 'none'}\nPhones found: ${c.phones.join(', ') || 'none'}\n${c.text.slice(0, 1600)}`
    )
    .join('\n\n')
  const { text } = await generateText({
    model: openrouter(MODEL),
    system: SYSTEM,
    messages: [{ role: 'user', content: `Choose up to ${count} spas.\n\n${listing}` }],
    maxOutputTokens: 8000,
  })
  const parsed = JSON.parse(stripFence(text)) as { picks?: Partial<Pick>[] }
  const byHost = new Map(candidates.map((c) => [c.host, c]))
  return (parsed.picks ?? [])
    .filter((p): p is Pick => !!p.website && !!p.spa_name && !!p.email_body && byHost.has(hostOf(p.website) ?? ''))
    .slice(0, count)
}

const FOOTER = `--\nAgent7even · ${process.env.VOIX_OUTREACH_ADDRESS || '[your business address]'}\nReply "stop" and I won't email again.`

function notesFor(p: Pick, date: string): string {
  return [
    `Auto-added ${date}. ${p.angle}`,
    `\n1) Call${p.phone ? ` ${p.phone}` : ''}: ${p.call_note}`,
    `\n2) Email${p.email ? ` ${p.email}` : ' (no email found: use the contact form)'}\nSubject: ${p.email_subject}\n\n${p.email_body}\n\n${FOOTER}`,
    p.dm ? `\n3) Instagram DM (backup, follow and engage first):\n${p.dm}` : null,
    p.checks ? `\nBefore sending: ${p.checks}` : null,
  ]
    .filter(Boolean)
    .join('\n')
    .slice(0, 4000)
}

/** Start a run unless one is already going. Returns the run id, or null if busy. */
async function startRun(supabase: SupabaseClient, trigger: TopUpTrigger): Promise<string | null> {
  await supabase
    .from('voix_prospect_runs')
    .update({ status: 'failed', error: 'Timed out', finished_at: new Date().toISOString() })
    .eq('status', 'running')
    .lt('started_at', new Date(Date.now() - STALE_RUN_MS).toISOString())
  const { data, error } = await supabase.from('voix_prospect_runs').insert({ trigger }).select('id').single()
  if (error) return null // unique index: another run is in progress
  return data.id as string
}

export async function toContactCount(supabase: SupabaseClient): Promise<number> {
  const { count } = await supabase
    .from('voix_prospects')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'to_contact')
  return count ?? 0
}

/**
 * Add the next batch when nothing is left to contact. `manual` skips the empty-queue check.
 */
export async function topUpProspects(supabase: SupabaseClient, trigger: TopUpTrigger): Promise<TopUpResult> {
  if (trigger !== 'manual' && (await toContactCount(supabase)) > 0) return { ran: false, reason: 'Spas still to contact' }

  const runId = await startRun(supabase, trigger)
  if (!runId) return { ran: false, reason: 'A search is already running' }

  try {
    const { data: existing } = await supabase.from('voix_prospects').select('website, city')
    const skipHosts = new Set((existing ?? []).map((r) => hostOf(r.website)).filter((h): h is string => !!h))
    const cities = pickCities((existing ?? []).map((r) => r.city ?? ''))

    const candidates = await searchCandidates(cities, skipHosts)
    if (!candidates.length) throw new Error(`No new candidates found in ${cities.join(', ')}`)

    const picks = await choosePicks(candidates, BATCH_SIZE)
    const date = new Date().toISOString().slice(0, 10)
    const rows = picks.map((p) => ({
      spa_name: p.spa_name.slice(0, 120),
      website: p.website.slice(0, 300),
      instagram: normalizeInstagram(p.instagram),
      city: p.city?.slice(0, 80) || null,
      contact_name: p.contact_name?.slice(0, 120) || null,
      email: p.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email) ? p.email.toLowerCase().slice(0, 200) : null,
      phone: p.phone?.slice(0, 40) || null,
      channel: p.phone ? 'phone' : p.email ? 'email' : 'ig_dm',
      status: 'to_contact',
      notes: notesFor(p, date),
    }))
    if (rows.length) {
      const { error } = await supabase.from('voix_prospects').insert(rows)
      if (error) throw error
    }

    await supabase
      .from('voix_prospect_runs')
      .update({ status: 'done', candidates: candidates.length, added: rows.length, finished_at: new Date().toISOString() })
      .eq('id', runId)
    return { ran: true, added: rows.length, candidates: candidates.length, spas: rows.map((r) => r.spa_name) }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[voix/prospectFinder] top-up failed', err)
    await supabase
      .from('voix_prospect_runs')
      .update({ status: 'failed', error: message.slice(0, 500), finished_at: new Date().toISOString() })
      .eq('id', runId)
    throw err
  }
}
