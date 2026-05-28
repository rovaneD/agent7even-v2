import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()

  const { data: profileRow } = await supabase
    .from('profiles')
    .select('id')
    .eq('clerk_user_id', userId)
    .single()

  if (!profileRow) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const { data: campaigns, error } = await supabase
    .from('campaigns')
    .select('id, title, plan, status, created_at')
    .eq('user_id', profileRow.id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('campaigns list error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ campaigns: campaigns ?? [] })
}
