import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getClerkSessionEmail } from '@/lib/clerk/sessionUser'
import { createServiceClient } from '@/lib/supabase/server'
import { refreshGaAccessTokenForClerkUser } from '@/lib/analytics/gaOAuthProfile'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const email = await getClerkSessionEmail()

  const refreshed = await refreshGaAccessTokenForClerkUser(supabase, userId, email)
  if (!refreshed.ok) {
    return NextResponse.json(
      {
        error: refreshed.reason,
        needsReconnect: refreshed.needsReconnect,
        properties: [],
      },
      { status: refreshed.needsReconnect ? 401 : 404 },
    )
  }

  const res = await fetch(
    'https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=200',
    { headers: { Authorization: `Bearer ${refreshed.accessToken}` } },
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
