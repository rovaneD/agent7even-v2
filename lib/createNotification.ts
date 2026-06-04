import { createServiceClient } from '@/lib/supabase/server'
import { getNotifyEmail } from '@/lib/getNotifyEmail'
import { getResendClient } from '@/lib/resend'

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

interface CreateNotificationParams {
  userId: string          // profiles.id of recipient
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
          from: 'Agent7even <hello@agent7even.com>',
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
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background: #0d0d0d; border-radius: 12px; overflow: hidden;">
      <div style="padding: 32px 40px 24px; border-bottom: 1px solid #1f1f1f;">
        <span style="font-size: 12px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: #c8522a;">Agent7even</span>
      </div>
      <div style="padding: 40px;">
        <h2 style="font-size: 20px; font-weight: 600; color: #f5f4f0; margin: 0 0 12px;">${title}</h2>
        <p style="font-size: 15px; color: #888; line-height: 1.7; margin: 0 0 32px;">${body}</p>
        ${link ? `
          <a href="${appUrl}${link}" style="display: inline-block; background: #c8522a; color: #f5f4f0; text-decoration: none; font-size: 14px; font-weight: 600; padding: 14px 28px; border-radius: 8px;">
            View in dashboard →
          </a>
        ` : ''}
      </div>
      <div style="padding: 24px 40px; border-top: 1px solid #1f1f1f;">
        <p style="font-size: 12px; color: #444; margin: 0;">
          Questions? <a href="mailto:hello@agent7even.com" style="color: #c8522a;">hello@agent7even.com</a>
        </p>
      </div>
    </div>
  `
}
