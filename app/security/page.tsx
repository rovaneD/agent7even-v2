import Link from 'next/link'

export const metadata = {
  title: 'Security — Agent7even',
  description: 'How Agent7even protects your data and accounts.',
}

const LAST_UPDATED = 'June 9, 2026'
const CONTACT_EMAIL = 'support@agent7even.ai'

export default function SecurityPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link href="/" className="flex items-center">
            <img src="/agent7even_logo.svg" alt="Agent7even" className="h-[34px] w-auto" />
          </Link>
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
            ← Back to agent7even.ai
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-6 py-14">
        <div className="mb-10">
          <p className="text-xs font-semibold tracking-widest uppercase text-[#64748B] mb-2">Legal</p>
          <h1 className="text-4xl font-bold text-gray-900 mb-3">Security</h1>
          <p className="text-sm text-gray-400">Last updated: {LAST_UPDATED}</p>
        </div>

        <div className="prose prose-gray max-w-none space-y-10 text-[15px] leading-relaxed text-gray-600">

          <section>
            <p>
              Protecting your business data is core to how Agent7even is built. This page summarizes
              the security practices behind the platform.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">1. Data Encryption</h2>
            <ul className="space-y-2 list-disc pl-5">
              <li>All traffic to and from the platform is encrypted in transit with HTTPS / TLS.</li>
              <li>Data is encrypted at rest in our database infrastructure.</li>
              <li>Sensitive credentials such as OAuth tokens and API keys are stored encrypted and are never exposed to the browser.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">2. Account Security</h2>
            <ul className="space-y-2 list-disc pl-5">
              <li>Authentication is handled by Clerk, a SOC 2 Type II certified identity provider.</li>
              <li>Sessions are managed with secure, httpOnly cookies.</li>
              <li>Team access is role-based — members only see what their role allows.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">3. Data Isolation</h2>
            <p>
              Your data lives in a PostgreSQL database (Supabase) protected by row-level security
              policies. Every query is scoped to your account — your business data, connected account
              data, and AI outputs are never visible to other Agent7even customers.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">4. Third-Party Integrations</h2>
            <ul className="space-y-2 list-disc pl-5">
              <li>Connections to Google Analytics and social platforms use OAuth — we never see or store your passwords.</li>
              <li>We request the minimum scopes needed (for example, read-only access to your analytics data).</li>
              <li>You can disconnect any integration at any time, which immediately deletes the stored tokens.</li>
              <li>Payments are processed by Stripe; raw card details never touch our servers.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">5. Infrastructure</h2>
            <p>
              The platform runs on Vercel with automatic security patching, DDoS mitigation, and
              isolated serverless execution. Database and storage are hosted by Supabase on
              SOC 2 compliant infrastructure.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">6. Data Deletion</h2>
            <p>
              You can request deletion of your account and all associated data at any time using our{' '}
              <Link href="/data-deletion" className="text-[#64748B] hover:underline">User Data Deletion</Link>
              {' '}page. Disconnecting an integration removes its stored credentials immediately, and
              cancelled accounts are purged after a 30-day grace period.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">7. Reporting a Vulnerability</h2>
            <p>
              If you believe you have found a security issue in Agent7even, please report it to us
              right away:
            </p>
            <div className="mt-4 bg-gray-50 rounded-2xl p-5 space-y-1">
              <p className="font-semibold text-gray-900">Agent7even Security</p>
              <p><a href={`mailto:${CONTACT_EMAIL}`} className="text-[#64748B] no-underline hover:underline">{CONTACT_EMAIL}</a></p>
              <p><a href="/" className="text-[#64748B] no-underline hover:underline">agent7even.ai</a></p>
            </div>
          </section>

        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100 mt-16">
        <div className="max-w-3xl mx-auto px-6 py-6 flex items-center justify-between text-xs text-gray-400">
          <span>© {new Date().getFullYear()} Agent7even. All rights reserved.</span>
          <div className="flex gap-4">
            <Link href="/data-deletion" className="hover:text-gray-600 transition-colors">Data Deletion</Link>
            <Link href="/privacy" className="hover:text-gray-600 transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-gray-600 transition-colors">Terms of Service</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
