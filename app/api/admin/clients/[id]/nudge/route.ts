import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdminApi, adminApiError } from '@/lib/requireAdmin'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAdminApi()
  if ('error' in authResult) return adminApiError(authResult)

  const { id } = await params
  const supabase = createServiceClient()

  const { data: client } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('id', id)
    .single()

  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const firstName = client.full_name?.split(' ')[0] ?? 'there'

  await supabase.from('notifications').insert({
    user_id: client.id,
    type:    'maya_nudge',
    title:   'Maya has work ready for you',
    body:    `Hey ${firstName} — it's been a few days. Your agents are ready to run and there's work waiting. Want to pick up where we left off?`,
    link:    '/dashboard',
    read:    false,
  })

  return NextResponse.json({ success: true })
}
