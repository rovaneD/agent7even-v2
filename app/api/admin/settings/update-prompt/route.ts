import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdminApi, adminApiError } from '@/lib/requireAdmin'

export async function POST(req: Request) {
  const authResult = await requireAdminApi()
  if ('error' in authResult) return adminApiError(authResult)

  const supabase = createServiceClient()

  const { id, is_active } = await req.json()
  if (!id) return NextResponse.json({ error: 'Prompt ID required' }, { status: 400 })

  const { error } = await supabase
    .from('prompt_library')
    .update({ is_active })
    .eq('id', id)

  if (error) {
    console.error('Prompt update error:', error)
    return NextResponse.json({ error: 'Failed to update prompt' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
