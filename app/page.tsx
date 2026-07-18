import type { Metadata } from 'next'
import './lab5/styles.css'
import MarketingJsonLd from '@/components/marketing/MarketingJsonLd'
import { marketingPageMetadata } from '@/lib/marketing/seoMetadata'
import Lab5HomePage from './lab5/page'

export const metadata: Metadata = marketingPageMetadata({
  title: 'AI Marketing Strategist & Automation for Small Business | Agent7even',
  description:
    'Maya AI plans campaigns, writes content, and queues everything for your approval. Start your 3-day free trial — no setup fees, cancel anytime.',
  path: '/',
})

export default function HomePage() {
  return (
    <>
      {/* Mobile-only critical CSS — must stay inside max-width so desktop WebGL/type are untouched */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media (max-width: 720px) {
              .lab5 .hero{position:relative;padding:40px 0 0;overflow-x:clip}
              .lab5 .hero-title{margin:0;font-weight:700;letter-spacing:-.03em;line-height:1.05;color:#0E0E11;font-size:clamp(34px,10vw,44px)}
              .lab5 .hero-metaballs{position:absolute;inset:-5% -20% 40% -20%;opacity:.44;filter:blur(52px);pointer-events:none;background:radial-gradient(circle at 32% 34%,rgba(245,52,155,.85),transparent 30%),radial-gradient(circle at 66% 28%,rgba(252,165,9,.8),transparent 28%),radial-gradient(circle at 52% 64%,rgba(50,134,254,.85),transparent 32%)}
              .lab5 .wrap{max-width:1200px;margin:0 auto;padding:0 20px}
            }
          `,
        }}
      />
      <MarketingJsonLd />
      <Lab5HomePage />
    </>
  )
}
