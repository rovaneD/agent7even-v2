import type { WorkspaceTeamMemberRow } from '@/lib/team/teamRoster'

export function formatNoteTimestamp(iso: string): string {
  const date = new Date(iso)
  const now = new Date()
  const sameDay = date.toDateString() === now.toDateString()
  if (sameDay) {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export function rosterForMentions(
  owner: { id: string; name: string; email: string },
  members: WorkspaceTeamMemberRow[],
): string[] {
  const labels = [`@${owner.name.split(/\s+/)[0] || 'owner'}`]
  for (const member of members) {
    if (member.status !== 'active') continue
    const first = member.name.split(/\s+/)[0]
    if (first) labels.push(`@${first}`)
  }
  return labels
}

export function buildApprovalMentionHints(
  owner: { id: string; name: string; email: string },
  teamRoster: WorkspaceTeamMemberRow[],
): string[] {
  return rosterForMentions(owner, teamRoster)
}
