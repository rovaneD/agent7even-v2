import { NextResponse } from 'next/server'
import {
  findOrCreateProject,
  normalizeDeliverable,
  safeStorageSegment,
  uploadDeliverableFile,
} from '@/lib/deliverables/projectDeliverables'
import {
  deliverableWorkspaceGateResponse,
  requireDeliverableWorkspace,
} from '@/lib/deliverables/deliverableWorkspace'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const supabase = createServiceClient()
  const workspace = await requireDeliverableWorkspace(supabase)
  if (!workspace.ok) return deliverableWorkspaceGateResponse(workspace)
  const { workspaceId, memberId } = workspace

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const projectName = formData.get('projectName') as string
  const notes = formData.get('notes') as string

  if (!file || !projectName) {
    return NextResponse.json({ error: 'File and project name required' }, { status: 400 })
  }

  if (file.size > 50 * 1024 * 1024) {
    return NextResponse.json({ error: 'File too large. Maximum size is 50MB.' }, { status: 400 })
  }

  const project = await findOrCreateProject({
    supabase,
    userId: workspaceId,
    title: projectName.trim(),
    description: 'Client uploaded deliverables and project files.',
  })
  const filePath = `${workspaceId}/${safeStorageSegment(projectName)}/${Date.now()}_${safeStorageSegment(file.name)}`
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
      uploaded_by: memberId,
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

  return NextResponse.json({ deliverable: normalizeDeliverable(deliverable) })
}
