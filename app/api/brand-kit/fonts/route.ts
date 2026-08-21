import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { brandKitGateResponse, requireBrandKitWorkspace } from '@/lib/brandKit/brandKitWorkspace'

export async function POST(req: Request) {
  const supabase = createServiceClient()
  const gate = await requireBrandKitWorkspace(supabase)
  if (!gate.ok) return brandKitGateResponse(gate)
  const profileId = gate.workspaceId

  const { role, family, weight, size_guide, source_url, notes } = await req.json()

  // One font per role per user — upsert on conflict (user_id, role)
  const { error } = await supabase
    .from('brand_kit_fonts')
    .upsert(
      { user_id: profileId, role, family, weight, size_guide, source_url, notes },
      { onConflict: 'user_id,role' }
    )

  if (error) {
    console.error('Font upsert error:', error)
    return NextResponse.json({ error: 'Failed to save font' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
