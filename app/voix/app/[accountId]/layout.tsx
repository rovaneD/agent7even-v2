import type { ReactNode } from 'react'
import { requireVoixAccount } from '@/lib/voix/access'
import VoixNav from '../_components/VoixNav'

export const dynamic = 'force-dynamic'

export default async function VoixAccountLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ accountId: string }>
}) {
  const { accountId } = await params
  const { viewer, account, supabase } = await requireVoixAccount(accountId)

  const nowIso = new Date().toISOString()
  const { count } = await supabase
    .from('voix_followups')
    .select('id', { count: 'exact', head: true })
    .eq('account_id', account.id)
    .or(`status.eq.open,and(status.eq.snoozed,snoozed_until.lte.${nowIso})`)

  const { count: pending } = await supabase
    .from('voix_appointments')
    .select('id', { count: 'exact', head: true })
    .eq('account_id', account.id)
    .eq('status', 'pending')

  const accounts = viewer.memberships.map((m) => ({ id: m.account.id, name: m.account.name }))
  if (!accounts.some((a) => a.id === account.id)) accounts.unshift({ id: account.id, name: account.name })

  return (
    <>
      <VoixNav
        accountId={account.id}
        accountName={account.name}
        accounts={accounts}
        openFollowups={count ?? 0}
        pendingAppointments={pending ?? 0}
        isAdmin={viewer.isAdmin}
      />
      <main className="mx-auto max-w-6xl px-4 pb-20 pt-6 sm:px-6 sm:pt-8">{children}</main>
    </>
  )
}
