import { auth } from '@clerk/nextjs/server'
import { getClerkSessionEmail } from '@/lib/clerk/sessionUser'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getDashboardProfileForClerkUser } from '@/lib/profiles/getDashboardProfile'

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { deliverableId, filePath: legacyFilePath } = await req.json()
  if (!deliverableId && !legacyFilePath) return NextResponse.json({ error: 'Deliverable ID required' }, { status: 400 })

  const supabase = createServiceClient()
  const email = await getClerkSessionEmail()
  const profile = await getDashboardProfileForClerkUser(supabase, userId, email)

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const isAdmin = profile.role === 'admin' || profile.role === 'owner'

  const query = supabase
    .from('deliverables')
    .select('id, file_url, uploaded_by, projects!inner(user_id)')

  const { data: deliverable } = await (deliverableId
    ? query.eq('id', deliverableId).single()
    : query.eq('file_url', legacyFilePath).single())

  if (!deliverable?.file_url) {
    return NextResponse.json({ error: 'Deliverable not found' }, { status: 404 })
  }

  const project = Array.isArray(deliverable.projects) ? deliverable.projects[0] : deliverable.projects
  const ownsFile = project?.user_id === profile.id || deliverable.uploaded_by === profile.id

  if (!ownsFile && !isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { data, error } = await supabase.storage
    .from('deliverables')
    .createSignedUrl(deliverable.file_url, 60)

  if (error || !data?.signedUrl) {
    console.error('Signed URL error:', error)
    return NextResponse.json({ error: 'Failed to generate download link.' }, { status: 500 })
  }

  return NextResponse.json({ url: data.signedUrl })
}
