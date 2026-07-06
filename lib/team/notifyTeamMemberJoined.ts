import { createServiceClient } from '@/lib/supabase/server'
import { createNotification } from '@/lib/createNotification'
import { getNotifyEmail } from '@/lib/getNotifyEmail'
import { sendTransactionalEmail } from '@/lib/email/sendTransactionalEmail'

const PLAN_LABELS: Record<string, string> = {
  starter: 'Starter',
  growth: 'Growth',
  proagent: 'ProAgent',
}

export async function notifyTeamMemberJoined(opts: {
  accountId: string
  memberEmail: string
  memberName?: string | null
  memberProfileId?: string | null
}) {
  const supabase = createServiceClient()
  const who = opts.memberName?.trim() || opts.memberEmail

  if (opts.memberProfileId) {
    const { data: existing } = await supabase
      .from('notifications')
      .select('id')
      .eq('user_id', opts.accountId)
      .eq('type', 'team_member_joined')
      .eq('sender_id', opts.memberProfileId)
      .limit(1)
      .maybeSingle()

    if (existing) return
  }

  const { data: owner } = await supabase
    .from('profiles')
    .select('id, full_name, email, company_name, plan')
    .eq('id', opts.accountId)
    .single()

  const company = owner?.company_name ?? 'their workspace'
  const ownerName = owner?.full_name?.trim() || owner?.email || 'Account owner'
  const planLabel = owner?.plan ? (PLAN_LABELS[owner.plan] ?? owner.plan) : '—'
  const adminClientPath = opts.memberProfileId
    ? `/admin/clients/${opts.memberProfileId}`
    : `/admin/clients/${opts.accountId}`

  await createNotification({
    userId: opts.accountId,
    senderId: opts.memberProfileId ?? null,
    title: 'Team member joined',
    body: `${who} accepted your team invitation.`,
    type: 'team_member_joined',
    link: '/dashboard/team',
  })

  if (owner?.email) {
    try {
      await sendTransactionalEmail({
        to: owner.email,
        subject: `${who} joined your ${company} team on Agent7even`,
        title: 'Team member joined',
        body: `${who} (${opts.memberEmail}) accepted your invitation and now has access to your shared workspace.\n\nManage permissions anytime from Team settings.`,
        link: '/dashboard/team',
        ctaLabel: 'View team →',
      })
    } catch (err) {
      console.error('[team] owner join email failed:', err)
    }
  }

  try {
    const notifyEmail = await getNotifyEmail()
    await sendTransactionalEmail({
      to: notifyEmail,
      subject: `Team member joined — ${company}`,
      title: 'New team member',
      body: [
        `Member: ${who} (${opts.memberEmail})`,
        `Workspace: ${company}`,
        `Owner: ${ownerName}${owner?.email ? ` (${owner.email})` : ''}`,
        `Plan: ${planLabel}`,
      ].join('\n'),
      link: adminClientPath,
      ctaLabel: 'View in admin →',
    })
  } catch (err) {
    console.error('[team] admin join email failed:', err)
  }
}
