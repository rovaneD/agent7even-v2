import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getResendClient } from '@/lib/resend'

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { platform, value } = await req.json()

  if (!platform || !value?.trim()) {
    return NextResponse.json({ error: 'Missing platform or value' }, { status: 400 })
  }

  const supabase = createServiceClient()

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, company_name, email')
    .eq('clerk_user_id', userId)
    .single()

  if (profileError || !profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  const columnMap: Record<string, string> = {
    google_analytics: 'ga_measurement_id',
    instagram: 'instagram_handle',
    meta: 'meta_ad_account_id',
  }

  const column = columnMap[platform]
  if (!column) return NextResponse.json({ error: 'Unknown platform' }, { status: 400 })

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ [column]: value.trim() })
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
    const resend = getResendClient()
    if (!resend) throw new Error('Missing RESEND_API_KEY')

    await resend.emails.send({
      from: 'Agent7even <noreply@agent7even.com>',
      to: process.env.NOTIFY_EMAIL!,
      subject: `Analytics connection request — ${platformLabels[platform]}`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
          <h2 style="color:#0d0d0d;">New Analytics Connection Request</h2>
          <p><strong>Client:</strong> ${profile.company_name ?? profile.email}</p>
          <p><strong>Platform:</strong> ${platformLabels[platform]}</p>
          <p><strong>${fieldLabels[platform]}:</strong> ${value.trim()}</p>
          <p style="color:#666;font-size:13px;margin-top:24px;">
            Log into the admin panel to view this client's profile and confirm the connection once set up.
          </p>
        </div>
      `,
    })
  } catch {
    // Email failure is non-fatal — connection was saved
  }

  return NextResponse.json({ success: true })
}
