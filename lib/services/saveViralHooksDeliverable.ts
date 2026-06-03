import { createNotification } from '@/lib/createNotification'
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

  const { data: existingDeliverable } = await supabase
    .from('deliverables')
    .select('*')
    .eq('user_id', profileId)
    .eq('project_name', projectName)
    .eq('file_name', fileName)
    .maybeSingle()

  if (existingDeliverable) return existingDeliverable

  const pdf = buildTextPdf(
    order.title,
    `${orderNumber} · Generated ${new Date(order.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
    generatedOutput
  )
  const buffer = new TextEncoder().encode(pdf)
  const filePath = `${profileId}/${projectName.replace(/\s+/g, '_')}/${Date.now()}_${fileName}`

  const { error: storageError } = await supabase.storage
    .from('deliverables')
    .upload(filePath, buffer, {
      contentType: 'application/pdf',
      upsert: false,
    })

  if (storageError) throw storageError

  const { data: deliverable, error: deliverableError } = await supabase
    .from('deliverables')
    .insert({
      user_id: profileId,
      uploaded_by: profileId,
      project_name: projectName,
      file_name: fileName,
      file_path: filePath,
      file_size: buffer.byteLength,
      file_type: 'application/pdf',
      notes,
      uploaded_by_role: 'admin',
    })
    .select()
    .single()

  if (deliverableError) {
    await supabase.storage.from('deliverables').remove([filePath])
    throw deliverableError
  }

  await createNotification({
    userId: profileId,
    title: 'Viral Hooks saved to Deliverables',
    body: `${fileName} has been added to your Viral Hooks folder.`,
    type: 'deliverable_uploaded',
    link: '/dashboard/deliverables',
    sendEmail: false,
  })

  return deliverable
}
