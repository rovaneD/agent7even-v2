import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createNotification } from '@/lib/createNotification'
import {
  findOrCreateProject,
  normalizeDeliverable,
  safeStorageSegment,
  uploadDeliverableFile,
} from '@/lib/deliverables/projectDeliverables'

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()

  const { data: adminProfile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('clerk_user_id', userId)
    .single()

  if (!adminProfile || !['admin', 'owner'].includes(adminProfile.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const projectName = formData.get('projectName') as string
  const notes = formData.get('notes') as string
  const clientId = formData.get('clientId') as string

  if (!file || !projectName || !clientId) {
    return NextResponse.json({ error: 'File, project name, and client ID required' }, { status: 400 })
  }

  if (file.size > 50 * 1024 * 1024) {
    return NextResponse.json({ error: 'File too large. Maximum size is 50MB.' }, { status: 400 })
  }

  const project = await findOrCreateProject({
    supabase,
    userId: clientId,
    title: projectName.trim(),
    description: 'Agent7even uploaded deliverables and project files.',
  })
  const filePath = `${clientId}/${safeStorageSegment(projectName)}/${Date.now()}_${safeStorageSegment(file.name)}`
  const buffer = new Uint8Array(await file.arrayBuffer())

  try {
    await uploadDeliverableFile({
      supabase,
      filePath,
      body: buffer,
      contentType: file.type || 'application/octet-stream',
    })
  } catch (error) {
    console.error('Storage upload error:', error)
    return NextResponse.json({ error: 'Upload failed. Please try again.' }, { status: 500 })
  }

  const { data: deliverable, error: dbError } = await supabase
    .from('deliverables')
    .insert({
      project_id: project.id,
      uploaded_by: adminProfile.id,
      title: file.name,
      file_url: filePath,
      file_size: file.size,
      file_type: file.type || null,
      description: notes || null,
    })
    .select('*, projects(title)')
    .single()

  if (dbError) {
    console.error('DB insert error:', dbError)
    await supabase.storage.from('deliverables').remove([filePath])
    return NextResponse.json({ error: 'Failed to save file record.' }, { status: 500 })
  }

  await createNotification({
    userId: clientId,
    title: 'New deliverable uploaded',
    body: `${file.name} has been added to your ${projectName} folder.`,
    type: 'deliverable_uploaded',
    link: '/dashboard/deliverables',
    sendEmail: true,
    emailSubject: `New file delivered: ${file.name}`,
  })

  return NextResponse.json({ deliverable: normalizeDeliverable(deliverable) })
}
