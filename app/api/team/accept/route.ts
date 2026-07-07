import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

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

  const signUpUrl = `${appUrl}/sign-up?invite_token=${token}&email=${encodeURIComponent(invite.invited_email)}`
  return NextResponse.redirect(signUpUrl)
}
