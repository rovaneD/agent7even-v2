import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { brandKitGateResponse, requireBrandKitWorkspace } from '@/lib/brandKit/brandKitWorkspace'

export async function POST(req: Request) {
  const supabase = createServiceClient()
  const gate = await requireBrandKitWorkspace(supabase)
  if (!gate.ok) return brandKitGateResponse(gate)
  const profileId = gate.workspaceId

  const { sectionKey, completed } = await req.json()

  if (!sectionKey || completed === undefined) {
    return NextResponse.json({ error: 'Missing required fields: sectionKey, completed' }, { status: 400 })
  }

  const { error } = await supabase
    .from('brand_kit_sections')
    .upsert(
      {
        user_id: profileId,
        section_key: sectionKey,
        completed,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,section_key' }
    )

  if (error) {
    console.error('Section complete upsert error:', error)
    return NextResponse.json({ error: 'Failed to update section' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
