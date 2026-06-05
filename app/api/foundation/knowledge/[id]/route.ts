import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const supabase = createServiceClient()

    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('clerk_user_id', userId)
      .single()
    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

    // Fetch storage_path before deleting the row
    const { data: row } = await supabase
      .from('foundation_knowledge')
      .select('storage_path, profile_id')
      .eq('id', id)
      .eq('profile_id', profile.id)
      .single()

    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Remove from storage if a file was stored
    if (row.storage_path) {
      await supabase.storage
        .from('foundation-knowledge')
        .remove([row.storage_path])
    }

    await supabase
      .from('foundation_knowledge')
      .delete()
      .eq('id', id)
      .eq('profile_id', profile.id)

    // Decrement count
    await supabase
      .from('profiles')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', profile.id)

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
