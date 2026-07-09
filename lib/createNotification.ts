import { createServiceClient } from '@/lib/supabase/server'
import { getNotifyEmail } from '@/lib/getNotifyEmail'
import { getResendClient } from '@/lib/resend'
import { buildTransactionalEmailHtml, transactionalFromAddress } from '@/lib/email/transactionalTemplate'

export type NotificationType =
  | 'order_status'
  | 'order_delivered'
  | 'support_reply'
  | 'support_closed'
  | 'deliverable_uploaded'
  | 'brand_kit_generated'
  | 'plan_activated'
  | 'trial_ending'
  | 'credit_topup'
  | 'approval_pending'
  | 'payment_failed'
  | 'subscription_canceled'
  | 'team_member_joined'
  | 'maya_nudge'
  | 'foundation_milestone'
  | 'assignment_created'
  | 'assignment_submitted'
  | 'task_note'
  | 'task_note_mention'
  | 'approval_note'
  | 'approval_note_mention'

interface CreateNotificationParams {
  userId: string          // profiles.id of recipient
  senderId?: string | null
  title: string
  body: string
  type: NotificationType
  link?: string
  sendEmail?: boolean
  emailSubject?: string
  emailHtml?: string
}

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.agent7even.com'

export async function createNotification({
  userId,
  senderId,
  title,
  body,
  type,
  link,
  sendEmail = false,
  emailSubject,
  emailHtml,
}: CreateNotificationParams) {
  const supabase = createServiceClient()

  // Create in-app notification
  const { error } = await supabase.from('notifications').insert({
    user_id: userId,
    sender_id: senderId ?? null,
    title,
    body,
    type,
    link: link ?? null,
    read: false,
    email_sent: false,
  })

  if (error) {
    console.error('Failed to create notification:', error)
  }

  // Send email if requested
  if (sendEmail && emailSubject) {
    try {
      const resend = getResendClient()
      if (!resend) throw new Error('Missing RESEND_API_KEY')

      // Get recipient email
      const { data: profile } = await supabase
        .from('profiles')
        .select('email, full_name, role')
        .eq('id', userId)
        .single()

      if (profile?.email) {
        const toEmail = ['admin', 'owner'].includes(profile.role ?? '')
          ? await getNotifyEmail()
          : profile.email

        await resend.emails.send({
          from: transactionalFromAddress(),
          to: toEmail,
          subject: emailSubject,
          html: emailHtml ?? buildDefaultEmailHtml(title, body, link),
        })

        // Mark email as sent
        await supabase
          .from('notifications')
          .update({ email_sent: true })
          .eq('user_id', userId)
          .eq('title', title)
          .order('created_at', { ascending: false })
          .limit(1)
      }
    } catch (err) {
      console.error('Notification email failed:', err)
    }
  }
}

function buildDefaultEmailHtml(title: string, body: string, link?: string) {
  return buildTransactionalEmailHtml({
    title,
    body,
    link,
    appBaseUrl: appUrl,
  })
}
