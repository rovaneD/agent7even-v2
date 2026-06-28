import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdminApi, adminApiError } from '@/lib/requireAdmin'

export async function POST(req: Request) {
  const authResult = await requireAdminApi()
  if ('error' in authResult) return adminApiError(authResult)

  const supabase = createServiceClient()

  const { key, value } = await req.json()
  if (!key) return NextResponse.json({ error: 'Key required' }, { status: 400 })

  const { error } = await supabase
    .from('platform_settings')
    .upsert({
      key,
      value,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'key' })

  if (error) {
    console.error('Settings update error:', error)
    return NextResponse.json({ error: 'Failed to save setting' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
