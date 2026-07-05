'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { UserCheck, X } from 'lucide-react'

type Props = {
  companyName: string | null
}

export default function TeamJoinedBanner({ companyName }: Props) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (searchParams.get('team_joined') === 'true') {
      setVisible(true)
    }
  }, [searchParams])

  if (!visible) return null

  function dismiss() {
    setVisible(false)
    const params = new URLSearchParams(searchParams.toString())
    params.delete('team_joined')
    const query = params.toString()
    router.replace(query ? `/dashboard?${query}` : '/dashboard', { scroll: false })
  }

  const label = companyName?.trim() || 'your team'

  return (
    <div className="mb-6 flex items-start gap-3 rounded-2xl border border-[#BFDBFE] bg-[#EFF6FF] px-4 py-3.5">
      <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-white text-[#3B82F6]">
        <UserCheck size={16} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-text-primary">
          You joined {label}&apos;s workspace
        </p>
        <p className="mt-0.5 text-xs leading-relaxed text-text-sec">
          Foundation, campaigns, and brand context come from the account owner. Your access follows the permissions they set in Team.
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
