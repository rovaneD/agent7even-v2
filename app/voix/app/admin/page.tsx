import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireVoixViewer, ACCOUNT_SELECT } from '@/lib/voix/access'
import type { VoixAccount, VoixMember } from '@/lib/voix/types'
import AdminConsole from './AdminConsole'

export const dynamic = 'force-dynamic'

export default async function VoixAdminPage() {
  const { viewer, supabase } = await requireVoixViewer()
  if (!viewer.isAdmin) redirect('/voix/app')

  const [{ data: accounts }, { data: members }] = await Promise.all([
    supabase.from('voix_accounts').select(ACCOUNT_SELECT).order('created_at', { ascending: true }),
    supabase.from('voix_members').select('id, account_id, email, full_name, clerk_user_id, role, invited_at, joined_at').order('invited_at'),
  ])

  const callCount = new Map<string, { real: number; sample: number }>()
  await Promise.all(
    ((accounts ?? []) as VoixAccount[]).map(async (a) => {
      const [{ count: real }, { count: sample }] = await Promise.all([
        supabase.from('voix_calls').select('id', { count: 'exact', head: true }).eq('account_id', a.id).eq('is_sample', false),
        supabase.from('voix_calls').select('id', { count: 'exact', head: true }).eq('account_id', a.id).eq('is_sample', true),
      ])
      callCount.set(a.id, { real: real ?? 0, sample: sample ?? 0 })
    }),
  )

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.agent7even.ai').replace(/\/$/, '')

  return (
    <div className="mx-auto max-w-5xl px-4 pb-20 pt-8 sm:px-6">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/voix/app" className="text-sm font-medium text-[#3355D6]">
            ← Voix
          </Link>
          <h1 className="mt-2 text-[40px] leading-none" style={{ fontFamily: 'var(--voix-serif), Georgia, serif' }}>
            Voix admin
          </h1>
          <p className="mt-2 text-sm text-[#5B6070]">Set up pilot spas, link their Retell agent and invite their staff.</p>
        </div>
        <div className="rounded-xl border border-[#ECEDF1] bg-white px-4 py-3 text-xs text-[#4A5061]">
          <div className="font-semibold text-[#1B2236]">Retell webhook URL</div>
          <code className="mt-1 block select-all">{appUrl}/api/voix/retell</code>
        </div>
      </div>
      <AdminConsole
        accounts={((accounts ?? []) as VoixAccount[]).map((a) => ({
          ...a,
          members: ((members ?? []) as VoixMember[]).filter((m) => m.account_id === a.id),
          calls: callCount.get(a.id) ?? { real: 0, sample: 0 },
        }))}
      />
    </div>
  )
}
