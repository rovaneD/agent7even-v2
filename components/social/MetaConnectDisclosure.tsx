'use client'

import { ZERNIO_HEADLESS_PLATFORMS } from '@/lib/social/publisher'

const PLATFORM_LABELS: Record<string, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  threads: 'Threads',
}

export function isMetaOAuthPlatform(platform: string): boolean {
  return ZERNIO_HEADLESS_PLATFORMS.has(platform)
}

export function metaOAuthPlatformLabel(platform: string): string {
  return PLATFORM_LABELS[platform] ?? platform
}

/** Static notice in connect panels — Meta OAuth shows our publishing partner's app name. */
export function SocialMetaConnectNotice({ className = '' }: { className?: string }) {
  return (
    <div className={`rounded-lg border border-pink-100 bg-pink-50 px-3 py-2.5 ${className}`}>
      <p className="text-[11px] text-pink-950 leading-relaxed">
        Instagram, Facebook, and Threads use Meta&apos;s authorization screen. It may show{' '}
        <span className="font-medium">&quot;Social Media Connector&quot;</span> — that&apos;s our publishing
        partner verifying access, not a separate login. Click{' '}
        <span className="font-medium">Allow</span>; don&apos;t click the app name link.
      </p>
    </div>
  )
}

export function MetaConnectDisclosureModal({
  open,
  platform,
  mode = 'connect',
  onCancel,
  onContinue,
}: {
  open: boolean
  platform: string | null
  /** Reconnect shows Meta permission re-consent steps — Meta skips the scope screen on repeat OAuth. */
  mode?: 'connect' | 'reconnect'
  onCancel: () => void
  onContinue: () => void
}) {
  if (!open || !platform) return null

  const label = metaOAuthPlatformLabel(platform)
  const isReconnect = mode === 'reconnect'

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <p className="text-[15px] font-semibold text-text mb-1">
          {isReconnect ? `Reconnect ${label}` : `Before you connect ${label}`}
        </p>
        {isReconnect ? (
          <>
            <p className="text-[13px] text-text-sec mb-3">
              Meta often <span className="font-medium text-text">skips the permissions screen</span> on reconnect
              if you already authorized the app — even when a scope like{' '}
              <span className="font-medium text-text">instagram_business_basic</span> was missing. That causes
              empty analytics with no error.
            </p>
            <div className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2.5 mb-3 space-y-2">
              <p className="text-[12px] font-semibold text-amber-950">Step 1 — Remove the old authorization (only if permissions were wrong)</p>
              <p className="text-[12px] text-amber-950 leading-relaxed">
                If Instagram → Apps and websites already shows{' '}
                <span className="font-medium">all permissions ON</span> (basic business info, manage
                insights, publish, etc.), skip this step — your Instagram side is fine.
              </p>
              <p className="text-[12px] text-amber-950 leading-relaxed">
                Otherwise open{' '}
                <a
                  href="https://www.facebook.com/settings?tab=business_tools"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium underline"
                >
                  Facebook → Settings → Business integrations
                </a>
                , find <span className="font-medium">&quot;Social Media Connector&quot;</span>, and click{' '}
                <span className="font-medium">Remove</span> so Meta shows the full consent screen again.
              </p>
            </div>
            <div className="rounded-xl border border-pink-100 bg-pink-50 px-3 py-2.5 mb-5">
              <p className="text-[12px] font-semibold text-pink-950 mb-1">Step 2 — Refresh the token in Agent7even</p>
              <p className="text-[12px] text-pink-950 leading-relaxed">
                Click Continue below. We disconnect the stale connection and run OAuth again. Meta may
                skip the permission screen — that&apos;s OK when Instagram already shows all toggles ON. Allow
                up to 24 hours for analytics backfill after reconnect.
              </p>
            </div>
          </>
        ) : (
          <>
            <p className="text-[13px] text-text-sec mb-4">
              Meta will ask you to authorize access. The screen may show{' '}
              <span className="font-medium text-text">&quot;Social Media Connector&quot;</span> — that&apos;s our
              publishing partner handling the connection, not a third-party account you need to sign into.
            </p>
            <div className="rounded-xl border border-pink-100 bg-pink-50 px-3 py-2.5 mb-5">
              <p className="text-[12px] text-pink-950 leading-relaxed">
                Click <span className="font-medium">Allow</span> to continue. Do not click the app name link — it
                opens our partner&apos;s site and is not part of connecting your {label} account.
              </p>
            </div>
          </>
        )}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 border border-gray-200 text-sm font-medium text-text-sec px-4 py-2 rounded-xl hover:border-gray-300 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onContinue}
            className="flex-1 bg-[#3B82F6] text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-[#2563EB] transition-colors"
          >
            {isReconnect ? 'Continue to Meta' : `Continue to ${label}`}
          </button>
        </div>
      </div>
    </div>
  )
}
