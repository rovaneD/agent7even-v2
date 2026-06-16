import Link from 'next/link'

export const metadata = {
  title: 'Terms of Service — Agent7even',
  description: 'Terms and conditions for using the Agent7even platform.',
}

const LAST_UPDATED = 'June 15, 2026'
const CONTACT_EMAIL = 'support@agent7even.ai'
const MARKETING_URL = 'https://www.agent7even.ai'
const APP_URL = 'https://app.agent7even.com'

function LegalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} className="text-[#64748B] no-underline hover:underline">
      {children}
    </a>
  )
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link href="/" className="flex items-center">
            <img src="/agent7even_logo.svg" alt="Agent7even" className="h-[34px] w-auto" />
          </Link>
          <a
            href={MARKETING_URL}
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            ← Back to agent7even.ai
          </a>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-14">
        <div className="mb-10">
          <p className="text-xs font-semibold tracking-widest uppercase text-[#64748B] mb-2">Legal</p>
          <h1 className="text-4xl font-bold text-gray-900 mb-3">Terms of Service</h1>
          <p className="text-sm text-gray-400">Last updated: {LAST_UPDATED}</p>
        </div>

        <div className="prose prose-gray max-w-none space-y-10 text-[15px] leading-relaxed text-gray-600">

          <section>
            <p>
              These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and use of the Agent7even
              client dashboard at <LegalLink href={APP_URL}>{APP_URL}</LegalLink> and related services
              described at <LegalLink href={MARKETING_URL}>{MARKETING_URL}</LegalLink>.
              By creating an account or using the platform, you agree to these Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">1. The Service</h2>
            <p>
              Agent7even is a subscription SaaS platform for small businesses. The dashboard includes tools
              for analytics, AI-powered content, social publishing, inbox management, billing, and related
              marketing workflows. You must connect your own third-party accounts (such as Google Analytics
              or social profiles) to use many features.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">2. Accounts</h2>
            <ul className="space-y-2 list-disc pl-5">
              <li>You must provide accurate information when creating your account.</li>
              <li>You are responsible for maintaining the security of your login credentials.</li>
              <li>You must be at least 18 years old and authorized to represent your business.</li>
              <li>One account per business. You may not share account access with unauthorized parties.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">3. Subscriptions and Billing</h2>
            <ul className="space-y-2 list-disc pl-5">
              <li>Paid plans are billed monthly or annually as shown at checkout.</li>
              <li>Payments are processed by Stripe. By subscribing, you authorize recurring charges.</li>
              <li>You may cancel your subscription at any time via the Billing tab. Access continues until the end of the current billing period.</li>
              <li>Refunds are handled on a case-by-case basis. Contact us at{' '}
                <LegalLink href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</LegalLink>{' '}
                within 7 days of a charge if you believe an error occurred.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">4. Third-Party Integrations</h2>
            <p className="mb-3">
              The platform allows you to connect third-party accounts such as Google Analytics, Instagram,
              Facebook, and other social networks. By connecting an account, you authorize Agent7even to
              access the data and perform the actions needed to provide the features you use, including:
            </p>
            <ul className="space-y-2 list-disc pl-5 mb-3">
              <li>Reading analytics and performance metrics</li>
              <li>Scheduling and publishing content you approve</li>
              <li>Managing comments and messages in the inbox, where permitted by the platform</li>
            </ul>
            <p>
              You may disconnect integrations at any time from your dashboard. Agent7even is not responsible
              for the availability, accuracy, or policy changes of third-party platforms. You remain responsible
              for content published through your connected accounts and for complying with each platform&rsquo;s terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">5. AI Tools</h2>
            <p>
              The AI Toolkit uses third-party AI models (Anthropic Claude) to generate content. You are
              responsible for reviewing and using any AI-generated content appropriately. Agent7even does
              not guarantee the accuracy, legality, or fitness of AI outputs for any particular purpose.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">6. Acceptable Use</h2>
            <p className="mb-3">You agree not to:</p>
            <ul className="space-y-2 list-disc pl-5">
              <li>Use the platform for any unlawful purpose.</li>
              <li>Attempt to access other users&rsquo; data.</li>
              <li>Reverse engineer, scrape, or systematically extract data from the platform.</li>
              <li>Use AI tools to generate spam, misleading content, or content that violates applicable laws.</li>
              <li>Publish content through connected social accounts that violates platform rules or applicable law.</li>
              <li>Interfere with the platform&rsquo;s operation or security.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">7. Intellectual Property</h2>
            <p>
              The Agent7even platform, branding, and software are owned by Agent7even. Content you create
              using the platform (AI-generated copy, saved prompts, etc.) belongs to you. You grant
              Agent7even a limited license to store and display your content as necessary to provide the service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">8. Limitation of Liability</h2>
            <p>
              Agent7even is provided &ldquo;as is&rdquo; without warranties of any kind. To the maximum extent
              permitted by law, Agent7even is not liable for indirect, incidental, or consequential damages
              arising from your use of the platform. Our total liability for any claim is limited to the
              amount you paid us in the 3 months preceding the claim.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">9. Termination</h2>
            <p>
              You may cancel your account at any time. We may suspend or terminate accounts that violate
              these Terms, with or without notice. Upon termination, your access to the platform ends and
              your data may be deleted after a 30-day grace period.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">10. Changes</h2>
            <p>
              We may update these Terms from time to time. Material changes will be communicated by email
              or in-app notice. Continued use of the platform after changes take effect constitutes
              your acceptance of the updated Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">11. Contact</h2>
            <p>
              Questions about these Terms? Contact us:
            </p>
            <div className="mt-4 bg-gray-50 rounded-2xl p-5 space-y-1">
              <p className="font-semibold text-gray-900">Agent7even</p>
              <p><LegalLink href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</LegalLink></p>
              <p>Website: <LegalLink href={MARKETING_URL}>www.agent7even.ai</LegalLink></p>
              <p>Dashboard: <LegalLink href={APP_URL}>app.agent7even.com</LegalLink></p>
            </div>
          </section>

        </div>
      </main>

      <footer className="border-t border-gray-100 mt-16">
        <div className="max-w-3xl mx-auto px-6 py-6 flex items-center justify-between text-xs text-gray-400">
          <span>© {new Date().getFullYear()} Agent7even. All rights reserved.</span>
          <div className="flex gap-4">
            <Link href="/data-deletion" className="hover:text-gray-600 transition-colors">Data Deletion</Link>
            <Link href="/privacy" className="hover:text-gray-600 transition-colors">Privacy Policy</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
