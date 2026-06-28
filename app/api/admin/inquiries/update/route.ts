import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createNotification } from '@/lib/createNotification'
import { requireAdminApi, adminApiError } from '@/lib/requireAdmin'

export async function POST(req: Request) {
  const authResult = await requireAdminApi()
  if ('error' in authResult) return adminApiError(authResult)
  const { admin: adminProfile } = authResult

  const supabase = createServiceClient()

  const { id, status, admin_notes, proposal_url } = await req.json()
  if (!id) return NextResponse.json({ error: 'Inquiry ID required' }, { status: 400 })

  // Fetch current inquiry to check status change
  const { data: existing } = await supabase
    .from('project_inquiries')
    .select('status, project_name, user_id')
    .eq('id', id)
    .single()

  const { error } = await supabase
    .from('project_inquiries')
    .update({
      status,
      admin_notes: admin_notes || null,
      proposal_url: proposal_url || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) {
    console.error('Inquiry update error:', error)
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }

  // Notify client on key status changes
  if (existing && status !== existing.status) {
    const messages: Record<string, { title: string; body: string }> = {
      reviewing: {
        title: 'Your project inquiry is being reviewed',
        body: `We've started reviewing your inquiry for ${existing.project_name}. We'll be in touch soon.`,
      },
      proposal_sent: {
        title: 'Your project proposal is ready',
        body: `We've sent a proposal for ${existing.project_name}. Check your email or the link in your inquiry.`,
      },
      accepted: {
        title: 'Project accepted — let\'s get started!',
        body: `Your project ${existing.project_name} has been accepted. The team will reach out to kick things off.`,
      },
      declined: {
        title: 'Project inquiry update',
        body: `We've reviewed your inquiry for ${existing.project_name} and have an update for you. Please check your email.`,
      },
    }

    const msg = messages[status]
    if (msg) {
      await createNotification({
        userId: existing.user_id,
        title: msg.title,
        body: msg.body,
        type: 'order_status',
        link: '/dashboard/services',
        sendEmail: ['proposal_sent', 'accepted', 'declined'].includes(status),
        emailSubject: msg.title,
      })
    }
  }

  return NextResponse.json({ success: true })
}
