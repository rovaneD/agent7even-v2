import { createServiceClient } from '@/lib/supabase/server'
import { CANONICAL_SITE_URL } from '@/lib/siteUrls'

const AGENT7EVEN_COMPANY = /agent7even/i
const AGENT7EVEN_SITE = /agent7even\.(ai|com)/i

export function isAgent7evenProfile(
  companyName?: string | null,
  websiteUrl?: string | null,
): boolean {
  return AGENT7EVEN_COMPANY.test(companyName ?? '') || AGENT7EVEN_SITE.test(websiteUrl ?? '')
}

function inputText(input: Record<string, unknown> | undefined, key: string): string {
  const value = input?.[key]
  return typeof value === 'string' ? value.trim() : ''
}

function buildUniversalCampaignOfferRules(taskInput?: Record<string, unknown>): string {
  const explicitOffer = inputText(taskInput, 'offer')

  return `OFFER & CTA RULES (authoritative — override Foundation guesses and training defaults):
- Never invent trial length, subscription price, discounts, guarantees, onboarding calls, or booking links unless they appear in task input or verified product metadata below.
- Campaign timeline (e.g. "14 days") is the **campaign duration**, not a free-trial length. Never conflate them in copy or Offer Assumption lines.
- If task input includes an explicit offer/product, use it — but still obey verified product metadata when this business is Agent7even.
${explicitOffer ? `- Task input offer/product: ${explicitOffer}` : '- Task input offer/product: (blank — state one clear assumption in **Offer Assumption**; do not fabricate calls, trials, or pricing).'}
- Primary trial CTA label when promoting a free trial: "Start your free trial" (not "Book a call" or "Schedule a demo" unless task input requires it).
- Put the offer assumption in **Offer Assumption:** — keep it factual and aligned with these rules.`
}

function buildAgent7evenProductOfferBlock(): string {
  const pricingUrl = `${CANONICAL_SITE_URL}/pricing`
  const signUpUrl = `${CANONICAL_SITE_URL}/sign-up`

  return `AGENT7EVEN PRODUCT OFFER (authoritative for this account — overrides Foundation SaaS guesses):
- **Starter:** $49/mo ($490/yr) — **3-day free trial only** (card collected upfront; no charge until day 4). This is the only plan with a trial.
- **Growth:** $89/mo ($890/yr) — no trial; charged immediately.
- **ProAgent:** $149/mo ($1,490/yr) — no trial; charged immediately.
- **Never claim:** 14-day (or any non-3-day) free trial, "free trial on Growth/ProAgent", invented onboarding calls, "Book a free call", or discount pricing unless task input explicitly provides approved promo terms.
- **CTA destination for trial/signup campaigns:** ${pricingUrl} (label: "Start your free trial"). Sign-up nav: ${signUpUrl}.
- **Positioning tone:** OS-forward and approval-first. Agency-frustration angles are allowed when audience input calls for it, but do not use false offer terms to support the angle.
- In **Offer Assumption**, cite the 3-day Starter trial and ${pricingUrl} — not a 14-day trial.`
}

/** Injected into Campaign Builder system prompts so offers match live product truth. */
export async function buildCampaignOfferGuardrails(
  userId: string,
  taskInput?: Record<string, unknown>,
): Promise<string> {
  const supabase = createServiceClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('company_name, website_url')
    .eq('id', userId)
    .maybeSingle()

  const parts = [buildUniversalCampaignOfferRules(taskInput)]

  if (isAgent7evenProfile(profile?.company_name, profile?.website_url)) {
    parts.push(buildAgent7evenProductOfferBlock())
  }

  return parts.join('\n\n')
}
