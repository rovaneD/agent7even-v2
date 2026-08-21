import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { brandKitGateResponse, requireBrandKitWorkspace } from '@/lib/brandKit/brandKitWorkspace'

export async function POST(req: Request) {
  const supabase = createServiceClient()
  const gate = await requireBrandKitWorkspace(supabase)
  if (!gate.ok) return brandKitGateResponse(gate)
  const profileId = gate.workspaceId

  const { id, role, name, hex, rgb, notes, sort_order } = await req.json()

  let savedRow: Record<string, unknown> | null = null

  if (id) {
    // UPDATE existing color — verify ownership via user_id
    const { data, error } = await supabase
      .from('brand_kit_colors')
      .update({ role, name, hex, rgb, notes })
      .eq('id', id)
      .eq('user_id', profileId)
      .select()
      .single()

    if (error) {
      console.error('Color update error:', error)
      return NextResponse.json({ error: 'Failed to update color' }, { status: 500 })
    }

    savedRow = data
  } else {
    // INSERT new color
    const { data, error } = await supabase
      .from('brand_kit_colors')
      .insert({ user_id: profileId, role, name, hex, rgb, notes, sort_order })
      .select()
      .single()

    if (error) {
      console.error('Color insert error:', error)
      return NextResponse.json({ error: 'Failed to create color' }, { status: 500 })
    }

    savedRow = data
  }

  return NextResponse.json({ success: true, color: savedRow })
}
