import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { activateTeamInviteForProfile } from '@/lib/team/activateTeamInvite'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const token = searchParams.get('token')
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.agent7even.com'

  if (!token) {
    return NextResponse.redirect(`${appUrl}/sign-in?error=invalid_invite`)
  }

  const supabase = createServiceClient()

  const { data: invite } = await supabase
    .from('team_members')
    .select('invited_email')
    .eq('invite_token', token)
    .eq('status', 'pending')
    .single()

  if (!invite) {
    return NextResponse.redirect(`${appUrl}/sign-in?error=invite_expired`)
  }

  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('id')
    .ilike('email', invite.invited_email)
    .neq('status', 'churned')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (existingProfile) {
    const activation = await activateTeamInviteForProfile(supabase, existingProfile.id, invite.invited_email)
    if (activation?.refused) {
      return NextResponse.redirect(`${appUrl}/dashboard?error=invite_existing_workspace`)
    }
    return NextResponse.redirect(`${appUrl}/dashboard?team_joined=true`)
  }

  const signUpUrl = `${appUrl}/sign-up?invite_token=${token}&email=${encodeURIComponent(invite.invited_email)}`
  return NextResponse.redirect(signUpUrl)
}
