import { permanentRedirect } from 'next/navigation'

/** Legacy SEO URL — content merged into /how-it-works; no anti-agency positioning. */
export default function AiVsAgencyRedirect() {
  permanentRedirect('/how-it-works')
}
