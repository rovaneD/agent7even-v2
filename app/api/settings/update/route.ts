import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { companyName, websiteUrl, instagramHandle, emailDigest, emailApprovals, emailWeekly } = await req.json()

  const supabase = createServiceClient()

  const updatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }
  if (companyName      !== undefined) updatePayload.company_name      = companyName || null
  if (websiteUrl       !== undefined) updatePayload.website_url       = websiteUrl || null
  if (instagramHandle  !== undefined) updatePayload.instagram_handle  = instagramHandle || null
  if (emailDigest      !== undefined) updatePayload.email_digest      = emailDigest
  if (emailApprovals   !== undefined) updatePayload.email_approvals   = emailApprovals
  if (emailWeekly      !== undefined) updatePayload.email_weekly      = emailWeekly

  const { error } = await supabase
    .from('profiles')
    .update(updatePayload)
    .eq('clerk_user_id', userId)

  if (error) {
    console.error('Settings update error:', error)
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }

  revalidatePath('/dashboard/settings')
  revalidatePath('/dashboard/analytics')

  return NextResponse.json({ success: true })
}
