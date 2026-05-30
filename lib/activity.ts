import { createServiceClient } from '@/lib/supabase/server'

export async function logActivity(
  profileId: string,
  eventType: string,
  metadata?: Record<string, unknown>
) {
  const supabase = createServiceClient()
  await Promise.all([
    supabase
      .from('profiles')
      .update({ last_active_at: new Date().toISOString() })
      .eq('id', profileId),
    supabase
      .from('client_activity_log')
      .insert({ user_id: profileId, event_type: eventType, metadata: metadata ?? null }),
  ])
}

// Convenience wrapper for routes that only have the Clerk user ID
export async function trackActivity(
  clerkUserId: string,
  eventType: string,
  metadata?: Record<string, unknown>
) {
  const supabase = createServiceClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('clerk_user_id', clerkUserId)
    .single()
  if (!profile) return
  await logActivity(profile.id, eventType, metadata)
}
