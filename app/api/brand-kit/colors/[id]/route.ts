import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { brandKitGateResponse, requireBrandKitWorkspace } from '@/lib/brandKit/brandKitWorkspace'

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const supabase = createServiceClient()
  const gate = await requireBrandKitWorkspace(supabase)
  if (!gate.ok) return brandKitGateResponse(gate)
  const profileId = gate.workspaceId

  const { error } = await supabase
    .from('brand_kit_colors')
    .delete()
    .eq('id', id)
    .eq('user_id', profileId)

  if (error) {
    console.error('Color delete error:', error)
    return NextResponse.json({ error: 'Failed to delete color' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
