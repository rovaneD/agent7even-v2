import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  await supabase
    .from('profiles')
    .update({ getting_started_dismissed: true })
    .eq('clerk_user_id', userId)

  return NextResponse.json({ ok: true })
}
