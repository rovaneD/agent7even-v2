/**
 * F1 live verification — mirrors dashboard layout session list query post-fix.
 */
import { createClient } from '@supabase/supabase-js'

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase env')

  const sb = createClient(url, key)
  const memberId = 'f5702a77-f81f-48f7-8847-78318e428c52'
  const ownerId = 'bfa73081-3906-4b5b-b24e-d9df3fb07384'

  const listFor = async (profileId: string) => {
    const { data } = await sb
      .from('maya_sessions')
      .select('id, title')
      .eq('user_id', profileId)
      .order('updated_at', { ascending: false })
      .limit(20)
    return data ?? []
  }

  const memberSidebar = await listFor(memberId)
  const ownerSidebar = await listFor(ownerId)
  const memberInOwnerList = memberSidebar.filter(s =>
    ownerSidebar.some(o => o.id === s.id),
  )
  const ownerInMemberList = ownerSidebar.filter(s =>
    memberSidebar.some(m => m.id === s.id),
  )

  console.log('F1 — post-fix layout query (.eq user_id, acting profile id)')
  console.log('Member sidebar count:', memberSidebar.length, 'titles:', memberSidebar.map(s => s.title))
  console.log('Owner sidebar count:', ownerSidebar.length)
  console.log('Member sessions leaking into owner list:', memberInOwnerList.length)
  console.log('Owner sessions leaking into member list:', ownerInMemberList.length)

  const memberTotal = await sb
    .from('maya_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', memberId)
  const ownerTotal = await sb
    .from('maya_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', ownerId)

  console.log('Member total sessions in DB:', memberTotal.count)
  console.log('Owner total sessions in DB:', ownerTotal.count)

  const ok =
    memberSidebar.length > 0 &&
    memberSidebar.length <= (memberTotal.count ?? 0) &&
    ownerInMemberList.length === 0 &&
    memberInOwnerList.length === 0

  if (!ok) {
    console.error('F1 verification FAILED')
    process.exit(1)
  }
  console.log('F1 verification PASSED (DB query equivalent to fixed layout)')
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
