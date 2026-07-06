import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { resolveFoundationWorkspaceForClerkUser } from '@/lib/foundation/resolveFoundationWorkspace'

async function resolveWorkspaceId(clerkUserId: string) {
  const supabase = createServiceClient()
  const session = await resolveFoundationWorkspaceForClerkUser(supabase, clerkUserId)
  return session?.workspaceId ?? null
}

/** Persist Review Findings selections on a knowledge row — never touches Foundation identity. */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const workspaceId = await resolveWorkspaceId(userId)
    if (!workspaceId) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const { confirmed_fields } = body as { confirmed_fields?: Record<string, unknown> }

    if (!confirmed_fields || typeof confirmed_fields !== 'object' || Array.isArray(confirmed_fields)) {
      return NextResponse.json({ error: 'confirmed_fields object required' }, { status: 400 })
    }

    const supabase = createServiceClient()
    const { data: row, error } = await supabase
      .from('foundation_knowledge')
      .update({
        confirmed_fields,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('profile_id', workspaceId)
      .select('id, confirmed_fields')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json({ success: true, confirmed_fields: row.confirmed_fields })
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const workspaceId = await resolveWorkspaceId(userId)
    if (!workspaceId) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

    const { id } = await params
    const supabase = createServiceClient()

    const { data: row } = await supabase
      .from('foundation_knowledge')
      .select('storage_path, profile_id')
      .eq('id', id)
      .eq('profile_id', workspaceId)
      .single()

    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    if (row.storage_path) {
      await supabase.storage
        .from('foundation-knowledge')
        .remove([row.storage_path as string])
    }

    await supabase
      .from('foundation_knowledge')
      .delete()
      .eq('id', id)
      .eq('profile_id', workspaceId)

    await supabase
      .from('profiles')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', workspaceId)

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
