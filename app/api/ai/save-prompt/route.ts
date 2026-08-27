import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import {
  requireToolkitWorkspace,
  toolkitWorkspaceGateResponse,
} from '@/lib/ai/toolkitWorkspace'

export async function POST(req: NextRequest) {
  const { title, prompt, category } = await req.json()
  if (!title || !prompt) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const supabase = createServiceClient()
  const workspace = await requireToolkitWorkspace(supabase)
  if (!workspace.ok) return toolkitWorkspaceGateResponse(workspace)

  const { data, error } = await supabase
    .from('saved_prompts')
    .insert({
      user_id: workspace.memberId,
      title,
      prompt,
      category: category ?? 'general',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ saved: data })
}
