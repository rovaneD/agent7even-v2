import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'
import { validatePublicWebsiteUrl } from '@/lib/security/publicWebsiteUrl'

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { companyName, websiteUrl, instagramHandle, emailDigest, emailApprovals, emailWeekly } = await req.json()

  const supabase = createServiceClient()

  const updatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }
  if (companyName      !== undefined) updatePayload.company_name      = companyName || null
  if (websiteUrl       !== undefined) {
    if (websiteUrl) {
      const validated = await validatePublicWebsiteUrl(websiteUrl)
      if (!validated.ok) {
        return NextResponse.json({ error: validated.reason }, { status: 400 })
      }
      updatePayload.website_url = validated.url
    } else {
      updatePayload.website_url = null
    }
  }
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
  revalidatePath('/dashboard/foundation')

  return NextResponse.json({ success: true })
}
