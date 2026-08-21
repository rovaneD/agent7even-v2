import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getTeamPermissions, hasPermission } from '@/lib/teamPermissions'
import { getWorkspaceAuthContext } from '@/lib/profiles/workspaceSession'

export type BrandKitSession = {
  memberId: string
  workspaceId: string
}

export type BrandKitGateOk = {
  ok: true
  workspaceId: string
  memberId: string
}

export type BrandKitGateFail = {
  ok: false
  status: 401 | 403
  error: string
}

export type BrandKitGateResult = BrandKitGateOk | BrandKitGateFail

/**
 * Decide the Brand Kit write tenancy key.
 *
 * Team members with `brand_kit` must mutate the owner workspace id — the
 * dashboard page reads `.eq('user_id', workspaceId)`. Writing the member
 * profile id makes saves appear to succeed and then vanish on refresh.
 */
export function brandKitMutationGate(input: {
  session: BrandKitSession | null
  hasBrandKitPermission: boolean
}): BrandKitGateResult {
  if (!input.session) {
    return { ok: false, status: 401, error: 'Unauthorized' }
  }
  if (!input.hasBrandKitPermission) {
    return { ok: false, status: 403, error: 'Brand Kit access required' }
  }
  return {
    ok: true,
    workspaceId: input.session.workspaceId,
    memberId: input.session.memberId,
  }
}

export type BrandKitWorkspace =
  | (BrandKitGateOk & { clerkUserId: string })
  | BrandKitGateFail

/** Auth + brand_kit permission + workspace write key for Brand Kit API routes. */
export async function requireBrandKitWorkspace(
  supabase: SupabaseClient,
): Promise<BrandKitWorkspace> {
  const ctx = await getWorkspaceAuthContext(supabase)
  if (!ctx) return { ok: false, status: 401, error: 'Unauthorized' }

  const perms = await getTeamPermissions(ctx.session.memberId)
  const gated = brandKitMutationGate({
    session: ctx.session,
    hasBrandKitPermission: hasPermission(perms, 'brand_kit'),
  })
  if (!gated.ok) return gated

  return { ...gated, clerkUserId: ctx.clerkUserId }
}

export function brandKitGateResponse(result: BrandKitGateFail): NextResponse {
  return NextResponse.json({ error: result.error }, { status: result.status })
}
