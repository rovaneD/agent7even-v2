import { createServiceClient } from '@/lib/supabase/server'

const TTL_MS = 10 * 60 * 1000 // 10 minutes

/** Store a nonce bound to this clerk_id + provider. Returns the nonce to use as OAuth state. */
export async function createOAuthState(clerkId: string, provider: string): Promise<string> {
  const nonce = crypto.randomUUID()
  const supabase = createServiceClient()
  await supabase.from('oauth_states').insert({
    nonce,
    clerk_id:   clerkId,
    provider,
    expires_at: new Date(Date.now() + TTL_MS).toISOString(),
  })
  return nonce
}

/**
 * Validate and consume a nonce. Returns the bound clerk_id on success, null on any failure
 * (unknown nonce, wrong provider, expired). DELETE-on-read makes it single-use.
 */
export async function consumeOAuthState(nonce: string, provider: string): Promise<string | null> {
  if (!nonce) return null
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('oauth_states')
    .delete()
    .eq('nonce', nonce)
    .eq('provider', provider)
    .gt('expires_at', new Date().toISOString())
    .select('clerk_id')
    .single()
  return data?.clerk_id ?? null
}
