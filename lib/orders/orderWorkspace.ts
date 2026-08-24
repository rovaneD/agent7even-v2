import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getTeamPermissions, hasPermission } from '@/lib/teamPermissions'
import {
  getWorkspaceAuthContext,
  workspaceActorId,
  workspaceDataUserId,
  type WorkspaceSession,
} from '@/lib/profiles/workspaceSession'

export type OrderWorkspaceProfile = {
  id: string
  email: string | null
  full_name: string | null
  company_name: string | null
  plan: string | null
  status: string | null
  billing_exempt: boolean | null
  foundation_answers: Record<string, unknown> | null
  business_type: string | null
  ideal_customer: string | null
  top_goals: string | null
  marketing_challenge: string | null
}

export type OrderWorkspaceGate =
  | { ok: true; workspaceId: string; memberId: string }
  | { ok: false; status: 401 | 403; error: string }

/**
 * Services pages list `.eq('user_id', workspaceId)`. Writes must use the same
 * key or team-submitted orders 403 (member has no plan) or vanish on refresh.
 */
export function orderWorkspaceGate(input: {
  session: WorkspaceSession | null
  hasServicesPermission: boolean
}): OrderWorkspaceGate {
  if (!input.session) {
    return { ok: false, status: 401, error: 'Unauthorized' }
  }
  if (!input.hasServicesPermission) {
    return { ok: false, status: 403, error: 'Services access required' }
  }
  return {
    ok: true,
    workspaceId: workspaceDataUserId(input.session),
    memberId: workspaceActorId(input.session),
  }
}

export type OrderWorkspaceResult =
  | {
      ok: true
      workspaceId: string
      memberId: string
      profile: OrderWorkspaceProfile
    }
  | { ok: false; status: 401 | 403 | 404; error: string }

const OWNER_PROFILE_SELECT =
  'id, email, full_name, company_name, plan, status, billing_exempt, foundation_answers, business_type, ideal_customer, top_goals, marketing_challenge'

/** Auth + services permission + workspace owner profile for Services/order APIs. */
export async function requireOrderWorkspace(
  supabase: SupabaseClient,
): Promise<OrderWorkspaceResult> {
  const ctx = await getWorkspaceAuthContext(supabase)
  const perms = ctx ? await getTeamPermissions(ctx.session.memberId) : null
  const gate = orderWorkspaceGate({
    session: ctx?.session ?? null,
    hasServicesPermission: perms ? hasPermission(perms, 'services') : false,
  })
  if (!gate.ok) return gate

  const { data: profile } = await supabase
    .from('profiles')
    .select(OWNER_PROFILE_SELECT)
    .eq('id', gate.workspaceId)
    .maybeSingle()

  if (!profile?.id) {
    return { ok: false, status: 404, error: 'Profile not found' }
  }

  return {
    ok: true,
    workspaceId: gate.workspaceId,
    memberId: gate.memberId,
    profile: profile as OrderWorkspaceProfile,
  }
}

export function orderWorkspaceGateResponse(
  result: Extract<OrderWorkspaceResult, { ok: false }>,
): NextResponse {
  return NextResponse.json({ error: result.error }, { status: result.status })
}
