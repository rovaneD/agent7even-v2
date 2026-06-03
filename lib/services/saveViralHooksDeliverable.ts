import { createNotification } from '@/lib/createNotification'
import {
  errorMessage,
  findOrCreateProject,
  normalizeDeliverable,
  safeStorageSegment,
  uploadDeliverableFile,
} from '@/lib/deliverables/projectDeliverables'
import { formatOrderNumber } from '@/lib/orders/formatOrderNumber'
import { buildTextPdf } from '@/lib/pdf/textPdf'

function safeFileSegment(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'viral-hooks'
}

export async function saveViralHooksDeliverable({
  supabase,
  profileId,
  order,
  generatedOutput,
}: {
  supabase: any
  profileId: string
  order: any
  generatedOutput: string
}) {
  const orderNumber = formatOrderNumber(order)
  const projectName = 'Viral Hooks'
  const fileName = `${safeFileSegment(orderNumber)}-viral-hooks.pdf`
  const notes = `Generated from ${orderNumber}.`
  const project = await findOrCreateProject({
    supabase,
    userId: profileId,
    title: projectName,
    description: 'Self-serve generated viral hook assets.',
  })

  const { data: existingDeliverable } = await supabase
    .from('deliverables')
    .select('*, projects(title)')
    .eq('project_id', project.id)
    .eq('title', fileName)
    .maybeSingle()

  if (existingDeliverable) return normalizeDeliverable(existingDeliverable)

  const pdf = buildTextPdf(
    order.title,
    `${orderNumber} · Generated ${new Date(order.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
    generatedOutput
  )
  const buffer = new TextEncoder().encode(pdf)
  const filePath = `${profileId}/${safeStorageSegment(projectName)}/${Date.now()}_${fileName}`
  await uploadDeliverableFile({
    supabase,
    filePath,
    body: buffer,
    contentType: 'application/pdf',
  })

  const { data: deliverable, error: deliverableError } = await supabase
    .from('deliverables')
    .insert({
      project_id: project.id,
      uploaded_by: profileId,
      title: fileName,
      file_url: filePath,
      file_size: buffer.byteLength,
      file_type: 'application/pdf',
      description: notes,
    })
    .select('*, projects(title)')
    .single()

  if (deliverableError) {
    await supabase.storage.from('deliverables').remove([filePath])
    throw new Error(`Deliverables record insert failed: ${errorMessage(deliverableError)}`)
  }

  try {
    await createNotification({
      userId: profileId,
      title: 'Viral Hooks saved to Deliverables',
      body: `${fileName} has been added to your Viral Hooks folder.`,
      type: 'deliverable_uploaded',
      link: '/dashboard/deliverables',
      sendEmail: false,
    })
  } catch (notificationError) {
    console.error('Viral Hooks deliverable notification error:', notificationError)
  }

  return normalizeDeliverable(deliverable)
}
