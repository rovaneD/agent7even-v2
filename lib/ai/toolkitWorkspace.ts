import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getTeamPermissions, hasPermission } from '@/lib/teamPermissions'
import {
  getWorkspaceAuthContext,
  workspaceActorId,
  workspaceDataUserId,
  type WorkspaceSession,
} from '@/lib/profiles/workspaceSession'

export type ToolkitWorkspaceProfile = {
  id: string
  plan: string | null
  status: string | null
  billing_exempt: boolean | null
  stripe_subscription_id: string | null
  company_name: string | null
}

export type ToolkitWorkspaceGate =
  | { ok: true; workspaceId: string; memberId: string }
  | { ok: false; status: 401 | 403; error: string }

/**
 * AI Toolkit pages/APIs must use the workspace owner for plan, Brand Kit, and
 * run limits. Member profiles typically have `plan: null`, so gating on the
 * actor 403s default-permissioned teammates even though the UI is available.
 */
export function toolkitWorkspaceGate(input: {
  session: WorkspaceSession | null
  hasToolkitPermission: boolean
}): ToolkitWorkspaceGate {
  if (!input.session) {
    return { ok: false, status: 401, error: 'Unauthorized' }
  }
  if (!input.hasToolkitPermission) {
    return { ok: false, status: 403, error: 'AI Toolkit access required' }
  }
  return {
    ok: true,
    workspaceId: workspaceDataUserId(input.session),
    memberId: workspaceActorId(input.session),
  }
}

export type ToolkitWorkspaceResult =
  | {
      ok: true
      workspaceId: string
      memberId: string
      profile: ToolkitWorkspaceProfile
    }
  | { ok: false; status: 401 | 403 | 404; error: string }

const OWNER_PROFILE_SELECT =
  'id, plan, status, billing_exempt, stripe_subscription_id, company_name'

/** Auth + ai_toolkit permission + workspace owner profile for Toolkit APIs. */
export async function requireToolkitWorkspace(
  supabase: SupabaseClient,
): Promise<ToolkitWorkspaceResult> {
  const ctx = await getWorkspaceAuthContext(supabase)
  const perms = ctx ? await getTeamPermissions(ctx.session.memberId) : null
  const gate = toolkitWorkspaceGate({
    session: ctx?.session ?? null,
    hasToolkitPermission: perms ? hasPermission(perms, 'ai_toolkit') : false,
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
    profile: profile as ToolkitWorkspaceProfile,
  }
}

export function toolkitWorkspaceGateResponse(
  result: Extract<ToolkitWorkspaceResult, { ok: false }>,
): NextResponse {
  return NextResponse.json({ error: result.error }, { status: result.status })
}
