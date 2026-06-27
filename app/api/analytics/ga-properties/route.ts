import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/server'
import { refreshGoogleAccessToken } from '@/lib/googleOAuth'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('ga_refresh_token')
    .eq('clerk_user_id', userId)
    .single()

  if (!profile?.ga_refresh_token) {
    return NextResponse.json({ error: 'Not connected' }, { status: 404 })
  }

  const accessToken = await refreshGoogleAccessToken(profile.ga_refresh_token)
  if (!accessToken) {
    return NextResponse.json({ error: 'Token refresh failed' }, { status: 401 })
  }

  // accountSummaries returns all accounts + their GA4 properties in one call
  const res = await fetch(
    'https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=200',
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  const data = await res.json()

  if (data.error) {
    return NextResponse.json({
      error: data.error.message,
      errorCode: data.error.code,
      properties: [],
    }, { status: 400 })
  }

  const properties: { id: string; name: string; account: string }[] = []
  for (const account of data.accountSummaries ?? []) {
    for (const prop of account.propertySummaries ?? []) {
      properties.push({
        id: (prop.property as string).replace('properties/', ''),
        name: prop.displayName as string,
        account: account.displayName as string,
      })
    }
  }

  return NextResponse.json({ properties })
}
