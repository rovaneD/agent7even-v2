import { auth, currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getDashboardProfileForClerkUser } from '@/lib/profiles/getDashboardProfile'

export type AdminContext = {
  userId: string
  role: string
  profileId: string
  /** Same as profileId — for routes that use admin.id */
  id: string
}

async function resolveAdminProfile(userId: string): Promise<AdminContext | null> {
  const user = await currentUser()
  const email = user?.emailAddresses?.[0]?.emailAddress ?? null

  const supabase = createServiceClient()
  const profile = await getDashboardProfileForClerkUser(supabase, userId, email)

  if (!profile?.role || !['admin', 'owner'].includes(profile.role)) {
    return null
  }

  return {
    userId,
    role: profile.role,
    profileId: profile.id,
    id: profile.id,
  }
}

export async function requireAdmin(): Promise<AdminContext> {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const admin = await resolveAdminProfile(userId)
  if (!admin) redirect('/dashboard')

  return admin
}

export async function requireAdminApi(): Promise<
  { admin: AdminContext } | { error: 'unauthorized' | 'forbidden' }
> {
  const { userId } = await auth()
  if (!userId) return { error: 'unauthorized' }

  const admin = await resolveAdminProfile(userId)
  if (!admin) return { error: 'forbidden' }

  return { admin }
}

export function adminApiError(result: { error: 'unauthorized' | 'forbidden' }) {
  const status = result.error === 'unauthorized' ? 401 : 403
  const message = result.error === 'unauthorized' ? 'Unauthorized' : 'Forbidden'
  return NextResponse.json({ error: message }, { status })
}
