import { createNotification } from '@/lib/createNotification'

export async function notifyTeamMemberJoined(opts: {
  accountId: string
  memberEmail: string
  memberName?: string | null
  memberProfileId?: string | null
}) {
  const who = opts.memberName?.trim() || opts.memberEmail

  await createNotification({
    userId: opts.accountId,
    senderId: opts.memberProfileId ?? null,
    title: 'Team member joined',
    body: `${who} accepted your team invitation.`,
    type: 'team_member_joined',
    link: '/dashboard/team',
  })
}
