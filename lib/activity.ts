import { createServiceClient } from '@/lib/supabase/server'
import { resolveClerkProfile } from '@/lib/profiles/resolveClerkProfile'

export async function logActivity(
  profileId: string,
  eventType: string,
  metadata?: Record<string, unknown>,
  workspaceId?: string,
) {
  const supabase = createServiceClient()
  await Promise.all([
    supabase
      .from('profiles')
      .update({ last_active_at: new Date().toISOString() })
      .eq('id', profileId),
    supabase
      .from('client_activity_log')
      .insert({
        user_id: profileId,
        workspace_id: workspaceId ?? profileId,
        event_type: eventType,
        metadata: metadata ?? null,
      }),
  ])
}

// Convenience wrapper for routes that only have the Clerk user ID
export async function trackActivity(
  clerkUserId: string,
  eventType: string,
  metadata?: Record<string, unknown>,
  workspaceId?: string,
) {
  const supabase = createServiceClient()
  const profile = await resolveClerkProfile(supabase, clerkUserId, 'id')
  if (!profile) return
  await logActivity(profile.id, eventType, metadata, workspaceId)
}
