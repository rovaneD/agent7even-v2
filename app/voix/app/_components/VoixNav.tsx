'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { UserButton } from '@clerk/nextjs'

type Props = {
  accountId: string
  accountName: string
  accounts: { id: string; name: string }[]
  openFollowups: number
  pendingAppointments?: number
  isAdmin: boolean
}

export default function VoixNav({ accountId, accountName, accounts, openFollowups, pendingAppointments = 0, isAdmin }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const base = `/voix/app/${accountId}`
  const links = [
    { href: `${base}/calls`, label: 'Calls' },
    { href: `${base}/appointments`, label: 'Appointments', badge: pendingAppointments },
    { href: `${base}/followups`, label: 'Follow-ups', badge: openFollowups },
  ]

  return (
    <header className="sticky top-0 z-20 border-b border-[#ECEDF1] bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:h-16 sm:flex-nowrap sm:py-0 sm:px-6">
        <Link href={`${base}/calls`} className="flex shrink-0 items-center gap-2 text-[15px] font-semibold tracking-tight">
          <span className="inline-block h-6 w-6 rounded-full bg-gradient-to-br from-[#F7B3CF] to-[#3355D6]" />
          Voix
        </Link>

        <div className="hidden h-6 w-px bg-[#ECEDF1] sm:block" />

        {accounts.length > 1 ? (
          <select
            aria-label="Spa"
            value={accountId}
            onChange={(e) => router.push(`/voix/app/${e.target.value}/calls`)}
            className="max-w-[40vw] truncate rounded-lg border border-[#ECEDF1] bg-white px-2 py-1.5 text-sm font-medium"
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        ) : (
          <span className="min-w-0 max-w-[45vw] truncate text-sm font-medium text-[#4A5061]">{accountName}</span>
        )}

        <div className="ml-auto shrink-0 sm:hidden">
          <UserButton />
        </div>

        <nav className="-mx-4 flex w-[calc(100%+2rem)] items-center gap-1 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:ml-auto sm:w-auto sm:overflow-visible sm:px-0 sm:pb-0">
          {links.map((l) => {
            const active = pathname.startsWith(l.href)
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-medium transition ${
                  active ? 'bg-[#1B2236] text-white' : 'text-[#4A5061] hover:bg-[#F2F3F6]'
                }`}
              >
                {l.label}
                {l.badge ? (
                  <span
                    className={`min-w-5 rounded-full px-1.5 text-center text-xs leading-5 ${
                      active ? 'bg-white text-[#1B2236]' : 'bg-[#3355D6] text-white'
                    }`}
                  >
                    {l.badge}
                  </span>
                ) : null}
              </Link>
            )
          })}
          {isAdmin ? (
            <Link
              href="/voix/app/admin"
              className={`shrink-0 whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-medium ${
                pathname.startsWith('/voix/app/admin') ? 'bg-[#1B2236] text-white' : 'text-[#4A5061] hover:bg-[#F2F3F6]'
              }`}
            >
              Admin
            </Link>
          ) : null}
          <div className="ml-2 hidden sm:block">
            <UserButton />
          </div>
        </nav>
      </div>
    </header>
  )
}
