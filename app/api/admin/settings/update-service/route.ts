import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdminApi, adminApiError } from '@/lib/requireAdmin'

export async function POST(req: Request) {
  const authResult = await requireAdminApi()
  if ('error' in authResult) return adminApiError(authResult)

  const supabase = createServiceClient()

  const { id, is_active } = await req.json()
  if (!id) return NextResponse.json({ error: 'Service ID required' }, { status: 400 })

  const { error } = await supabase
    .from('services')
    .update({ is_active })
    .eq('id', id)

  if (error) {
    console.error('Service update error:', error)
    return NextResponse.json({ error: 'Failed to update service' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
