import Link from 'next/link'
import DataDeletionRequestForm from './DataDeletionRequestForm'

export const metadata = {
  title: 'User Data Deletion — Agent7even',
  description: 'Request deletion of your Agent7even account data and connected platform data.',
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

export default function DataDeletionPage() {
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
          <h1 className="text-4xl font-bold text-gray-900 mb-3">User Data Deletion</h1>
          <p className="text-sm text-gray-400">Last updated: {LAST_UPDATED}</p>
        </div>

        <div className="space-y-10 text-[15px] leading-relaxed text-gray-600">

          <section>
            <p>
              You can request deletion of personal data Agent7even holds about you, including data obtained
              through connected platforms such as Instagram, Facebook, and Google Analytics. Use the form
              below or email us at{' '}
              <LegalLink href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</LegalLink>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">What we delete</h2>
            <ul className="space-y-2 list-disc pl-5">
              <li>Your Agent7even account profile and settings</li>
              <li>Connected integration tokens and cached analytics or social data</li>
              <li>AI prompts, outputs, and workspace content stored in your account</li>
              <li>Billing metadata retained only as long as required for legal or tax obligations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">If you still have dashboard access</h2>
            <p>
              Signed-in users can disconnect integrations from the Analytics → Connect accounts panel
              at <LegalLink href={APP_URL}>{APP_URL}</LegalLink>, which immediately removes stored OAuth
              tokens for that integration. To delete your full account, use the form below or cancel your
              subscription and contact support.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">Processing time</h2>
            <p>
              We verify requests using the email address associated with your account. We aim to complete
              verified deletion requests within 30 days and will confirm by email when processing is finished.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">Submit a deletion request</h2>
            <DataDeletionRequestForm />
          </section>

          <section className="text-[13px] text-gray-500">
            <p>
              See also our{' '}
              <Link href="/privacy" className="text-[#64748B] hover:underline">Privacy Policy</Link>
              {' '}and{' '}
              <Link href="/terms" className="text-[#64748B] hover:underline">Terms of Service</Link>.
            </p>
          </section>

        </div>
      </main>

      <footer className="border-t border-gray-100 mt-16">
        <div className="max-w-3xl mx-auto px-6 py-6 flex items-center justify-between text-xs text-gray-400">
          <span>© {new Date().getFullYear()} Agent7even. All rights reserved.</span>
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:text-gray-600 transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-gray-600 transition-colors">Terms of Service</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
