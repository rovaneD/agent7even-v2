import Link from 'next/link'

export const metadata = {
  title: 'Privacy Policy — Agent7even',
  description: 'How Agent7even collects, uses, and protects your information.',
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

export default function PrivacyPage() {
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
          <h1 className="text-4xl font-bold text-gray-900 mb-3">Privacy Policy</h1>
          <p className="text-sm text-gray-400">Last updated: {LAST_UPDATED}</p>
        </div>

        <div className="prose prose-gray max-w-none space-y-10 text-[15px] leading-relaxed text-gray-600">

          <section>
            <p>
              Agent7even (&ldquo;we&rdquo;, &ldquo;our&rdquo;, or &ldquo;us&rdquo;) operates the marketing
              website at <LegalLink href={MARKETING_URL}>{MARKETING_URL}</LegalLink> and the client dashboard
              at <LegalLink href={APP_URL}>{APP_URL}</LegalLink>. This Privacy Policy explains how we collect,
              use, and protect information when you use our platform.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">1. Information We Collect</h2>
            <p className="mb-4">We collect information you provide directly and information generated through your use of the platform:</p>
            <ul className="space-y-2 list-disc pl-5">
              <li><strong>Account information</strong> — name, email address, and profile details when you sign up via Clerk authentication.</li>
              <li><strong>Business information</strong> — company name, business type, website URL, and marketing goals collected during onboarding.</li>
              <li><strong>Connected account data</strong> — when you connect third-party platforms (Google Analytics, Instagram, Facebook, and other social networks), we store access credentials and retrieve performance data on your behalf.</li>
              <li><strong>Usage data</strong> — how you interact with the dashboard, features you use, and AI prompt activity.</li>
              <li><strong>Billing information</strong> — subscription and payment data processed by Stripe. We do not store raw payment card details.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">2. Google Analytics Data</h2>
            <p className="mb-4">
              Agent7even integrates with the Google Analytics Data API and Google Analytics Admin API to display
              your website performance data inside your dashboard. Specifically:
            </p>
            <ul className="space-y-2 list-disc pl-5">
              <li>
                We request the <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm">analytics.readonly</code> OAuth
                scope to read your GA4 property data. We do not modify, delete, or write any Google Analytics data.
              </li>
              <li>
                When you connect Google Analytics, we store an OAuth refresh token and your Google account email
                in our database. This allows us to display your analytics data without requiring you to sign in
                to Google each time.
              </li>
              <li>
                Your Google Analytics data is displayed only to you inside your dashboard and is not shared
                with other users or third parties.
              </li>
              <li>
                You can disconnect Google Analytics at any time from the Analytics tab, which immediately
                deletes your stored OAuth token from our systems.
              </li>
              <li>
                Our use of Google user data complies with the{' '}
                <a
                  href="https://developers.google.com/terms/api-services-user-data-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#64748B] no-underline hover:underline"
                >
                  Google API Services User Data Policy
                </a>
                , including the Limited Use requirements.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">3. Instagram, Facebook, and Social Platform Data</h2>
            <p className="mb-4">
              When you connect Instagram, Facebook, or other social accounts through our dashboard, you authorize
              Agent7even to access Meta Platform Data and related social data on your behalf, only within the
              permissions you approve at connect time. We use this data solely to provide features you request, such as:
            </p>
            <ul className="space-y-2 list-disc pl-5 mb-4">
              <li>Organic social analytics (reach, engagement, followers, post performance)</li>
              <li>Scheduling and publishing posts to your connected accounts</li>
              <li>Inbox and engagement tools (comments and direct messages, where permitted)</li>
            </ul>
            <ul className="space-y-2 list-disc pl-5">
              <li>
                Each client connects their own account via OAuth. We do not access social accounts you have not
                explicitly authorized.
              </li>
              <li>
                Social data is scoped to your tenant account and is not shared with other Agent7even clients.
                We do not sell Platform Data or use it to build profiles unrelated to providing the service.
              </li>
              <li>
                We use authorized infrastructure providers to connect to social platforms on your behalf.
                Those providers process tokens and API requests necessary to deliver the features above.
              </li>
              <li>
                You can disconnect any social account at any time from the Connect accounts panel in your
                dashboard, which stops further data collection from that account.
              </li>
              <li>
                You can revoke Meta permissions at any time in your{' '}
                <a
                  href="https://www.facebook.com/settings?tab=applications"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#64748B] no-underline hover:underline"
                >
                  Facebook Apps and Websites settings
                </a>.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">4. How We Use Your Information</h2>
            <ul className="space-y-2 list-disc pl-5">
              <li>To operate and personalize your dashboard experience.</li>
              <li>To display your connected account performance data (Google Analytics, social, ads).</li>
              <li>To schedule, publish, and manage social content you authorize.</li>
              <li>To process service requests and orders through the platform.</li>
              <li>To run AI-powered tools using prompts and inputs you provide.</li>
              <li>To communicate with you about your account and active services.</li>
              <li>To process billing and manage your subscription via Stripe.</li>
              <li>To improve the platform based on aggregate usage patterns.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">5. Data Storage and Security</h2>
            <p>
              Your data is stored in a Supabase (PostgreSQL) database with row-level security policies
              that ensure you can only access your own data. All connections use HTTPS encryption in transit.
              Sensitive credentials (OAuth tokens, API keys) are stored encrypted.
            </p>
            <p className="mt-3">
              We retain your data for as long as your account is active. You may request deletion of your
              account and all associated data at any time using our{' '}
              <Link href="/data-deletion" className="text-[#64748B] hover:underline">User Data Deletion</Link>
              {' '}form or by contacting us at{' '}
              <LegalLink href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</LegalLink>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">6. Third-Party Services</h2>
            <p className="mb-3">We use the following third-party services to operate the platform:</p>
            <div className="space-y-3">
              {[
                { name: 'Clerk', use: 'User authentication and account management', url: 'https://clerk.com/privacy' },
                { name: 'Supabase', use: 'Database and data storage', url: 'https://supabase.com/privacy' },
                { name: 'Stripe', use: 'Payment processing and subscription billing', url: 'https://stripe.com/privacy' },
                { name: 'Resend', use: 'Transactional email delivery', url: 'https://resend.com/privacy' },
                { name: 'Anthropic', use: 'AI-powered content generation (Claude API)', url: 'https://www.anthropic.com/privacy' },
                { name: 'Vercel', use: 'Application hosting and deployment', url: 'https://vercel.com/legal/privacy-policy' },
                { name: 'Google', use: 'Analytics data access (with your explicit authorization)', url: 'https://policies.google.com/privacy' },
                { name: 'Meta', use: 'Instagram and Facebook data access (with your explicit authorization)', url: 'https://www.facebook.com/privacy/policy/' },
              ].map(({ name, use, url }) => (
                <div key={name} className="flex gap-3">
                  <span className="font-semibold text-gray-800 w-24 flex-shrink-0">{name}</span>
                  <span className="text-gray-500">
                    {use} —{' '}
                    <a href={url} target="_blank" rel="noopener noreferrer" className="text-[#64748B] no-underline hover:underline">
                      Privacy Policy
                    </a>
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">7. Data Sharing</h2>
            <p>
              We do not sell, trade, or rent your personal information to third parties. We share data
              only with the service providers listed above, and only as necessary to operate the platform.
              Your business data and connected account data are never shared with other Agent7even clients.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">8. Your Rights</h2>
            <p>You have the right to:</p>
            <ul className="space-y-2 list-disc pl-5 mt-3">
              <li>Access the personal data we hold about you.</li>
              <li>Correct inaccurate information in your account.</li>
              <li>Request deletion of your account and associated data via our{' '}
                <Link href="/data-deletion" className="text-[#64748B] hover:underline">User Data Deletion</Link> page.</li>
              <li>Disconnect any third-party integrations at any time from your dashboard.</li>
              <li>Revoke Google OAuth access at any time via your{' '}
                <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer" className="text-[#64748B] no-underline hover:underline">
                  Google Account permissions
                </a>.
              </li>
              <li>Revoke Meta (Instagram/Facebook) access at any time via your{' '}
                <a href="https://www.facebook.com/settings?tab=applications" target="_blank" rel="noopener noreferrer" className="text-[#64748B] no-underline hover:underline">
                  Facebook Apps and Websites settings
                </a>.
              </li>
            </ul>
            <p className="mt-4">
              To exercise any of these rights, contact us at{' '}
              <LegalLink href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</LegalLink>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">9. Cookies</h2>
            <p>
              We use essential cookies for authentication (managed by Clerk). We do not use advertising
              cookies or third-party tracking cookies.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">10. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of material changes
              by email or through a notice in the dashboard. Continued use of the platform after changes
              constitutes acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">11. Contact</h2>
            <p>
              If you have questions about this Privacy Policy or how we handle your data, please contact us:
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
            <Link href="/terms" className="hover:text-gray-600 transition-colors">Terms of Service</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
