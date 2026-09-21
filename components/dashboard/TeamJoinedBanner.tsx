'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AlertTriangle, UserCheck, X } from 'lucide-react'

type Props = {
  companyName: string | null
}

export default function TeamJoinedBanner({ companyName }: Props) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [mode, setMode] = useState<'joined' | 'blocked' | null>(null)

  useEffect(() => {
    if (searchParams.get('team_joined') === 'true') {
      setMode('joined')
    } else if (searchParams.get('error') === 'invite_existing_workspace') {
      setMode('blocked')
    }
  }, [searchParams])

  if (!mode) return null

  function dismiss() {
    setMode(null)
    const params = new URLSearchParams(searchParams.toString())
    params.delete('team_joined')
    params.delete('error')
    const query = params.toString()
    router.replace(query ? `/dashboard?${query}` : '/dashboard', { scroll: false })
  }

  const label = companyName?.trim() || 'your team'
  const blocked = mode === 'blocked'

  return (
    <div className={`mb-6 flex items-start gap-3 rounded-2xl border px-4 py-3.5 ${
      blocked ? 'border-amber-200 bg-amber-50' : 'border-[#BFDBFE] bg-[#EFF6FF]'
    }`}>
      <div className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-white ${
        blocked ? 'text-amber-600' : 'text-[#3B82F6]'
      }`}>
        {blocked ? <AlertTriangle size={16} /> : <UserCheck size={16} />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-text-primary">
          {blocked
            ? 'Invitation not applied — this account already has a workspace'
            : `You joined ${label}'s workspace`}
        </p>
        <p className="mt-0.5 text-xs leading-relaxed text-text-sec">
          {blocked
            ? 'Your Foundation, billing, and team stay on this account. Ask the owner to invite a different email if you still need access to their workspace.'
            : 'Foundation, campaigns, and brand context come from the account owner. Your access follows the permissions they set in Team.'}
        </p>
      </div>
      <button
        type="button"
        onClick={dismiss}
        className="rounded p-1 text-text-muted transition-colors hover:text-text-primary"
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>
    </div>
  )
}
