import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { notifyTeamMemberJoined } from '@/lib/team/notifyTeamMemberJoined'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const token = searchParams.get('token')
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.agent7even.com'

  if (!token) {
    return NextResponse.redirect(`${appUrl}/sign-in?error=invalid_invite`)
  }

  const supabase = createServiceClient()

  // Find the invite
  const { data: invite } = await supabase
    .from('team_members')
    .select('*, profiles!team_members_account_id_fkey(company_name)')
    .eq('invite_token', token)
    .eq('status', 'pending')
    .single()

  if (!invite) {
    return NextResponse.redirect(`${appUrl}/sign-in?error=invite_expired`)
  }

  // Check if user already has a profile with this email
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('id, clerk_user_id')
    .eq('email', invite.invited_email)
    .single()

  if (existingProfile) {
    await supabase
      .from('team_members')
      .update({
        member_profile_id: existingProfile.id,
        status: 'active',
      })
      .eq('id', invite.id)

    await supabase
      .from('profiles')
      .update({
        account_id: invite.account_id,
        is_account_owner: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingProfile.id)

    await notifyTeamMemberJoined({
      accountId: invite.account_id,
      memberEmail: invite.invited_email,
    }).catch(err => console.error('[team/accept] join notification failed:', err))

    return NextResponse.redirect(`${appUrl}/dashboard?team_joined=true`)
  }

  // New user — redirect to sign-up with invite context
  const signUpUrl = `${appUrl}/sign-up?invite_token=${token}&email=${encodeURIComponent(invite.invited_email)}`
  return NextResponse.redirect(signUpUrl)
}
