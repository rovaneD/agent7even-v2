import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getClerkSessionEmail } from '@/lib/clerk/sessionUser'
import { createServiceClient } from '@/lib/supabase/server'
import { resolveClerkProfile } from '@/lib/profiles/resolveClerkProfile'
import { getNotifyEmail } from '@/lib/getNotifyEmail'
import { sendTransactionalEmail } from '@/lib/email/sendTransactionalEmail'

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { platform, value } = await req.json()

  if (!platform || !value?.trim()) {
    return NextResponse.json({ error: 'Missing platform or value' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const email = await getClerkSessionEmail()
  const profile = await resolveClerkProfile<{
    id: string
    company_name: string | null
    email: string | null
    stripe_customer_id: string | null
    stripe_subscription_id: string | null
    plan: string | null
    created_at: string
  }>(
    supabase,
    userId,
    'id, company_name, email',
    email,
  )

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  const columnMap: Record<string, string> = {
    google_analytics: 'ga_measurement_id',
    instagram: 'instagram_handle',
    meta: 'meta_ad_account_id',
  }

  const column = columnMap[platform]
  if (!column) return NextResponse.json({ error: 'Unknown platform' }, { status: 400 })

  const updates: Record<string, string | boolean> = { [column]: value.trim() }
  if (platform === 'google_analytics') updates.ga_connected = true

  const { error: updateError } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', profile.id)

  if (updateError) {
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 })
  }

  const platformLabels: Record<string, string> = {
    google_analytics: 'Google Analytics',
    instagram: 'Instagram',
    meta: 'Meta Ads',
  }

  const fieldLabels: Record<string, string> = {
    google_analytics: 'Measurement ID',
    instagram: 'Handle',
    meta: 'Ad Account ID',
  }

  try {
    const notifyEmail = await getNotifyEmail()
    await sendTransactionalEmail({
      to: notifyEmail,
      subject: `Analytics connection request — ${platformLabels[platform]}`,
      title: 'New analytics connection request',
      body: `Client: ${profile.company_name ?? profile.email}\nPlatform: ${platformLabels[platform]}\n${fieldLabels[platform]}: ${value.trim()}\n\nLog into the admin panel to view this client's profile and confirm the connection once set up.`,
    })
  } catch {
    // Email failure is non-fatal — connection was saved
  }

  return NextResponse.json({ success: true })
}
