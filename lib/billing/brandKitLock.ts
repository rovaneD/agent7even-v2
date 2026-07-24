import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Brand Kit is unlocked during trial (trial v2, July 2026).
 * Kept for API compatibility — always returns false.
 */
export const BRAND_KIT_TRIAL_LOCKED = 'BRAND_KIT_TRIAL_LOCKED'

export async function isBrandKitLockedForClerkUser(
  _supabaseOrClerkUserId: SupabaseClient | string,
  clerkUserId?: string,
): Promise<boolean> {
  void (_supabaseOrClerkUserId && clerkUserId)
  return false
}
