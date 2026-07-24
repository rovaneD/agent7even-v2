import { logActivity } from '@/lib/activity'
import { createNotification } from '@/lib/createNotification'
import { sendTransactionalEmail } from '@/lib/email/sendTransactionalEmail'
import { getNotifyEmail } from '@/lib/getNotifyEmail'
import { createServiceClient } from '@/lib/supabase/server'

const SIGNUP_NOTIFY_EVENT = 'admin_signup_notified'

async function adminSignupAlreadyNotified(profileId: string): Promise<boolean> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('client_activity_log')
    .select('id')
    .eq('user_id', profileId)
    .eq('event_type', SIGNUP_NOTIFY_EVENT)
    .limit(1)
    .maybeSingle()
  return Boolean(data)
}

/** Email + in-app notify platform admins when a new Clerk user gets a profile. */
export async function notifyAdminNewSignup(opts: {
  profileId: string
  email: string
  fullName?: string
  joinedViaTeamInvite?: boolean
}) {
  const supabase = createServiceClient()
  const who = opts.fullName?.trim() || opts.email
  const inviteNote = opts.joinedViaTeamInvite ? ' (via team invite)' : ''
  const clientPath = `/admin/clients/${opts.profileId}`

  const notifyEmail = await getNotifyEmail()
  if (notifyEmail) {
    try {
      await sendTransactionalEmail({
        to: notifyEmail,
        subject: `New signup — ${who}`,
        title: 'New user signup',
        body: [
          `Name: ${opts.fullName?.trim() || '—'}`,
          `Email: ${opts.email}`,
          `Joined via team invite: ${opts.joinedViaTeamInvite ? 'yes' : 'no'}`,
        ].join('\n'),
        link: clientPath,
        ctaLabel: 'View client →',
      })
    } catch (err) {
      console.error('Admin signup email failed:', err)
    }
  }

  const { data: adminProfiles } = await supabase
    .from('profiles')
    .select('id')
    .in('role', ['admin', 'owner'])

  await Promise.all(
    (adminProfiles ?? []).map((admin) =>
      createNotification({
        userId: admin.id,
        title: 'New user signup',
        body: `${who} just signed up${inviteNote}.`,
        type: 'order_status',
        link: clientPath,
        sendEmail: false,
      })
    )
  )
}

/** Idempotent — safe from Clerk webhook and ensureProfile on the same signup. */
export async function notifyAdminNewSignupOnce(opts: {
  profileId: string
  email: string
  fullName?: string
  joinedViaTeamInvite?: boolean
}) {
  if (await adminSignupAlreadyNotified(opts.profileId)) return

  await notifyAdminNewSignup(opts)

  await logActivity(opts.profileId, SIGNUP_NOTIFY_EVENT, {
    email: opts.email,
    joinedViaTeamInvite: opts.joinedViaTeamInvite ?? false,
  }).catch(err => console.error('Admin signup notify marker failed:', err))
}
