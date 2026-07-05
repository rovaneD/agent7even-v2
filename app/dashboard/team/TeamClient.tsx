'use client'

import { useState, useMemo } from 'react'
import { useMayaContext } from '@/hooks/useMayaContext'
import { buildTeamMayaContext } from '@/lib/maya/summaries/workspaceContext'
import type { WorkspaceActivityItem } from '@/lib/team/workspaceActivity'
import type { AssignedTaskRow } from '@/lib/team/taskAssignments'
import { COMMAND_CENTER_AGENTS } from '@/lib/agents/registry'
import { agentDisplayName } from '@/lib/agents/digestPreview'
import {
  Users, Plus, Mail, Trash2, Loader2, CheckCircle,
  AlertCircle, X, Shield, Settings, Eye, EyeOff,
  Clock, UserCheck, Activity, ClipboardList,
} from 'lucide-react'

interface Permission {
  billing: boolean
  services: boolean
  ai_toolkit: boolean
  analytics: boolean
  brand_kit: boolean
  deliverables: boolean
  support: boolean
}

interface TeamMember {
  id: string
  account_id: string
  member_profile_id: string | null
  role: string
  permissions: Permission
  status: string
  invited_email: string
  created_at: string
  profiles?: {
    id: string
    full_name: string | null
    email: string | null
    avatar_url: string | null
  }
}

interface Props {
  profileId: string
  companyName: string
  plan: string
  stripeSubscriptionId: string
  includedSeats: number
  activeMembers: number
  pendingMembers: number
  teamMembers: TeamMember[]
  activityItems?: WorkspaceActivityItem[]
  activityTeamCount?: number
  activityOwnerCount?: number
  openAssignments?: AssignedTaskRow[]
}

const PERMISSION_LABELS: Record<keyof Permission, string> = {
  billing: 'Billing & plan',
  services: 'Services & orders',
  ai_toolkit: 'AI Toolkit',
  analytics: 'Analytics',
  brand_kit: 'Brand Kit',
  deliverables: 'Deliverables',
  support: 'Support',
}

const DEFAULT_PERMISSIONS: Permission = {
  billing: false,
  services: true,
  ai_toolkit: true,
  analytics: true,
  brand_kit: true,
  deliverables: true,
  support: true,
}

const PLAN_LABELS: Record<string, string> = {
  starter: 'Starter',
  growth: 'Growth',
  proagent: 'ProAgent',
}

export default function TeamClient({
  profileId,
  companyName,
  plan,
  stripeSubscriptionId,
  includedSeats,
  activeMembers,
  pendingMembers,
  teamMembers: initial,
  activityItems = [],
  activityTeamCount = 0,
  activityOwnerCount = 0,
  openAssignments: initialOpenAssignments = [],
}: Props) {
  const [activeTab, setActiveTab] = useState<'members' | 'activity'>('members')
  const [activityFilter, setActivityFilter] = useState<'team' | 'all' | 'owner'>('team')
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>(initial)
  const [openAssignments, setOpenAssignments] = useState<AssignedTaskRow[]>(initialOpenAssignments)
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [assigneeProfileId, setAssigneeProfileId] = useState('')
  const [assignAgent, setAssignAgent] = useState('competitor_watcher')
  const [assignNote, setAssignNote] = useState('')
  const [assignDueAt, setAssignDueAt] = useState('')
  const [assigning, setAssigning] = useState(false)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [showPermissionsModal, setShowPermissionsModal] = useState(false)
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('member')
  const [invitePermissions, setInvitePermissions] = useState<Permission>(DEFAULT_PERMISSIONS)
  const [inviting, setInviting] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)
  const [savingPermissions, setSavingPermissions] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const totalMembers = activeMembers + pendingMembers
  const extraSeats = Math.max(0, totalMembers - includedSeats)
  const inviteWillNeedExtraSeat = (totalMembers + 1) >= includedSeats
  const canBillExtraSeat = Boolean(stripeSubscriptionId)
  const [inviteStep, setInviteStep] = useState<'details' | 'confirm'>('details')

  const mayaContext = useMemo(
    () =>
      buildTeamMayaContext({
        companyName,
        plan,
        includedSeats,
        totalMembers,
        activeMembers,
        pendingMembers,
        extraSeats,
        members: initial,
      }),
    [companyName, plan, includedSeats, totalMembers, activeMembers, pendingMembers, extraSeats, initial],
  )
  useMayaContext(mayaContext)

  function togglePermission(key: keyof Permission) {
    if (key === 'support') return // Support always visible
    setInvitePermissions(prev => ({ ...prev, [key]: !prev[key] }))
  }

  function toggleMemberPermission(key: keyof Permission) {
    if (!selectedMember || key === 'support') return
    setSelectedMember(prev => prev ? {
      ...prev,
      permissions: { ...prev.permissions, [key]: !prev.permissions[key] }
    } : null)
  }

  async function handleInvite() {
    if (!inviteEmail.trim()) return
    setInviting(true)
    setError(null)
    try {
      const res = await fetch('/api/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          role: inviteRole,
          permissions: invitePermissions,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to send invite')
      setTeamMembers(prev => [data.member, ...prev])
      setSuccess(`Invite sent to ${inviteEmail}`)
      setInviteEmail('')
      setInviteRole('member')
      setInvitePermissions(DEFAULT_PERMISSIONS)
      setInviteStep('details')
      setShowInviteModal(false)
      setTimeout(() => setSuccess(null), 4000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send invite')
    } finally {
      setInviting(false)
    }
  }

  function handleInvitePrimaryAction() {
    if (!inviteEmail.trim()) return
    setError(null)

    if (inviteWillNeedExtraSeat && !canBillExtraSeat) {
      setError('Add a paid subscription on Billing before inviting extra team seats ($15/mo each).')
      return
    }

    if (inviteStep === 'details' && inviteWillNeedExtraSeat) {
      setInviteStep('confirm')
      return
    }

    void handleInvite()
  }

  function closeInviteModal() {
    setShowInviteModal(false)
    setInviteStep('details')
    setError(null)
  }

  async function handleRemove(memberId: string, email: string) {
    if (!confirm(`Remove ${email} from your team? This will revoke their access immediately.`)) return
    setRemoving(memberId)
    try {
      const res = await fetch('/api/team/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId }),
      })
      if (!res.ok) throw new Error('Failed to remove member')
      setTeamMembers(prev => prev.filter(m => m.id !== memberId))
      setSuccess(`${email} has been removed`)
    } catch {
      setError('Failed to remove team member')
    } finally {
      setRemoving(null)
    }
  }

  async function handleSavePermissions() {
    if (!selectedMember) return
    setSavingPermissions(true)
    try {
      const res = await fetch('/api/team/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId: selectedMember.id,
          permissions: selectedMember.permissions,
          role: selectedMember.role,
        }),
      })
      if (!res.ok) throw new Error('Failed to save')
      setTeamMembers(prev => prev.map(m =>
        m.id === selectedMember.id ? { ...m, permissions: selectedMember.permissions, role: selectedMember.role } : m
      ))
      setSuccess('Permissions updated')
      setShowPermissionsModal(false)
    } catch {
      setError('Failed to update permissions')
    } finally {
      setSavingPermissions(false)
    }
  }

  function openPermissions(member: TeamMember) {
    setSelectedMember({ ...member })
    setShowPermissionsModal(true)
  }

  const filteredActivityItems = useMemo(() => {
    if (activityFilter === 'team') {
      return activityItems.filter(item => item.actorRole === 'member')
    }
    if (activityFilter === 'owner') {
      return activityItems.filter(item => item.actorRole === 'owner')
    }
    return activityItems
  }, [activityFilter, activityItems])

  const assignableMembers = teamMembers.filter(
    m => m.status === 'active' && m.member_profile_id,
  )

  async function handleAssignWork() {
    if (!assigneeProfileId || !assignNote.trim()) return
    setAssigning(true)
    setError(null)
    try {
      const res = await fetch('/api/agents/tasks/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assigneeProfileId,
          agent: assignAgent,
          assignmentNote: assignNote.trim(),
          assignmentDueAt: assignDueAt || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to assign work')
      setSuccess('Assignment sent')
      setShowAssignModal(false)
      setAssignNote('')
      setAssignDueAt('')
      setTimeout(() => setSuccess(null), 4000)
      window.location.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign work')
    } finally {
      setAssigning(false)
    }
  }

  const totalSeats = activeMembers + pendingMembers

  function formatActivityTime(iso: string) {
    const date = new Date(iso)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    if (diffHours < 1) return 'Just now'
    if (diffHours < 24) return `${diffHours}h ago`
    const diffDays = Math.floor(diffHours / 24)
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <div className="mx-auto max-w-[1240px] space-y-6 px-4 py-8 sm:px-8">

      <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
        <div className="flex flex-col gap-6 p-7 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-brand-primary">Team</p>
            <h1 className="text-[30px] font-semibold tracking-tight text-text">Workspace access</h1>
            <p className="mt-2 text-sm leading-6 text-text-sec">
              {companyName} — invite team members and control what each person can access.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-text-soft">Seats</p>
              <p className="mt-1 text-2xl font-semibold text-text">{totalSeats + 1}</p>
            </div>
            <button
              type="button"
              onClick={() => setShowAssignModal(true)}
              disabled={assignableMembers.length === 0}
              className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-text transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ClipboardList size={15} />
              Assign work
            </button>
            <button
              onClick={() => { setInviteStep('details'); setShowInviteModal(true) }}
              className="flex items-center gap-2 rounded-xl bg-brand-primary px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#2563EB]"
            >
              <Plus size={15} />
              Invite member
            </button>
          </div>
        </div>
      </section>

      <div className="flex gap-2 border-b border-gray-100">
        <button
          type="button"
          onClick={() => setActiveTab('members')}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${
            activeTab === 'members'
              ? 'border-brand-primary text-brand-primary'
              : 'border-transparent text-text-sec hover:text-text'
          }`}
        >
          <Users size={15} />
          Members
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('activity')}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${
            activeTab === 'activity'
              ? 'border-brand-primary text-brand-primary'
              : 'border-transparent text-text-sec hover:text-text'
          }`}
        >
          <Activity size={15} />
          Activity
        </button>
      </div>

      {activeTab === 'activity' ? (
        <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
          <div className="border-b border-gray-100 px-6 py-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-text">Team activity</h2>
                <p className="mt-1 text-sm text-text-sec">
                  {activityTeamCount === 0
                    ? 'No team member actions in the last 7 days yet.'
                    : `${activityTeamCount} team action${activityTeamCount === 1 ? '' : 's'} · ${activityOwnerCount} by you`}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {([
                  ['team', 'Team'],
                  ['owner', 'You'],
                  ['all', 'All'],
                ] as const).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setActivityFilter(key)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                      activityFilter === key
                        ? 'bg-brand-primary text-white'
                        : 'bg-gray-100 text-text-sec hover:bg-gray-200'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {filteredActivityItems.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-sm font-medium text-text">
                {activityFilter === 'team'
                  ? 'Your team has not taken action yet'
                  : activityFilter === 'owner'
                    ? 'No owner activity in the last 7 days'
                    : 'No workspace activity in the last 7 days'}
              </p>
              <p className="mx-auto mt-2 max-w-md text-sm text-text-sec">
                {activityFilter === 'team'
                  ? 'Assign agent work from the Members tab so teammates can run campaigns, research, and content in your workspace.'
                  : 'Agent runs, approvals, assignments, and joins will appear here.'}
              </p>
              {activityFilter === 'team' && assignableMembers.length > 0 && (
                <button
                  type="button"
                  onClick={() => { setActiveTab('members'); setShowAssignModal(true) }}
                  className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#2563EB]"
                >
                  <ClipboardList size={14} />
                  Assign work
                </button>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {filteredActivityItems.map(item => (
                <li key={item.id} className="flex items-start gap-4 px-6 py-4">
                  <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-brand-primary/10 text-brand-primary">
                    <Activity size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-text">{item.summary}</p>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                        item.actorRole === 'member'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-gray-100 text-text-soft'
                      }`}>
                        {item.actorRole === 'member' ? 'Team' : 'You'}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-text-sec">
                      {item.title}
                      {item.detail ? ` · ${item.detail}` : ''}
                    </p>
                  </div>
                  <div className="flex flex-shrink-0 flex-col items-end gap-1">
                    <span className="text-xs text-text-soft">{formatActivityTime(item.createdAt)}</span>
                    {item.link && (
                      <a href={item.link} className="text-xs font-semibold text-brand-primary hover:underline">
                        Open
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        <>
      {success && (
        <div className="flex items-center gap-3 rounded-xl border border-status-success/20 bg-status-success/10 px-4 py-3">
          <CheckCircle size={15} className="flex-shrink-0 text-status-success" />
          <p className="flex-1 text-sm text-status-success">{success}</p>
          <button onClick={() => setSuccess(null)}><X size={14} className="text-emerald-400" /></button>
        </div>
      )}
      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-status-danger/20 bg-status-danger/10 px-4 py-3">
          <AlertCircle size={15} className="flex-shrink-0 text-status-danger" />
          <p className="flex-1 text-sm text-status-danger">{error}</p>
          <button onClick={() => setError(null)}><X size={14} className="text-red-400" /></button>
        </div>
      )}

      {/* Seat usage card */}
      <div className="rounded-2xl border border-gray-100 bg-white p-6">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="text-sm font-semibold text-text">Seat usage</h2>
            <p className="mt-0.5 text-xs text-text-soft">
              {PLAN_LABELS[plan]} includes {includedSeats} seat{includedSeats !== 1 ? 's' : ''}.
              Additional seats are $15/mo each.
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-semibold text-text">{totalSeats + 1}</p>
            <p className="text-xs text-text-soft">total seats used</p>
          </div>
        </div>

        {/* Seat breakdown */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">You (account owner)</span>
            <span className="text-xs font-medium text-gray-400 bg-gray-50 px-2.5 py-1 rounded-full">Included</span>
          </div>
          {activeMembers > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">{activeMembers} active member{activeMembers !== 1 ? 's' : ''}</span>
              <span className="text-xs font-medium text-gray-400 bg-gray-50 px-2.5 py-1 rounded-full">
                {activeMembers <= includedSeats - 1 ? 'Included' : `$${Math.max(0, activeMembers - (includedSeats - 1)) * 15}/mo`}
              </span>
            </div>
          )}
          {pendingMembers > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">{pendingMembers} pending invite{pendingMembers !== 1 ? 's' : ''}</span>
              <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full">Pending</span>
            </div>
          )}
          {extraSeats > 0 && (
            <div className="pt-2 mt-2 border-t border-gray-50 flex items-center justify-between text-sm">
              <span className="font-medium text-gray-700">Extra seat charges</span>
              <span className="font-semibold text-text-sec">${extraSeats * 15}/mo added to your subscription</span>
            </div>
          )}
        </div>
      </div>

      {openAssignments.length > 0 && (
        <div className="rounded-2xl border border-gray-100 bg-white p-6">
          <h2 className="text-sm font-semibold text-text">Open assignments</h2>
          <p className="mt-0.5 text-xs text-text-soft">Waiting for a team member to start.</p>
          <ul className="mt-4 divide-y divide-gray-100">
            {openAssignments.map(item => (
              <li key={item.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-text">
                    {agentDisplayName(item.agent)} → {item.assigneeName ?? 'Team member'}
                  </p>
                  {item.assignment_note && (
                    <p className="mt-1 text-xs text-text-sec">{item.assignment_note}</p>
                  )}
                </div>
                {item.assignment_due_at && (
                  <span className="text-xs text-text-soft">
                    Due {new Date(item.assignment_due_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Team members list */}
      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
        <div className="border-b border-border px-6 py-4">
          <h2 className="text-sm font-semibold text-text">Team members</h2>
        </div>

        {teamMembers.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <Users size={24} className="text-gray-200 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-600 mb-1">No team members yet</p>
            <p className="text-xs text-gray-400 mb-5">
              Invite team members to give them access to your dashboard.
            </p>
            <button
              onClick={() => { setInviteStep('details'); setShowInviteModal(true) }}
              className="inline-flex items-center gap-2 text-sm font-medium text-text-sec bg-brand-primary/10 hover:bg-brand-primary/15 px-4 py-2.5 rounded-xl transition-colors"
            >
              <Plus size={14} />
              Invite your first team member
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {teamMembers.map(member => (
              <div key={member.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-4 sm:px-6">
                {/* Avatar */}
                <div className="w-9 h-9 rounded-xl bg-brand-primary/10 flex items-center justify-center flex-shrink-0">
                  {member.profiles?.avatar_url ? (
                    <img src={member.profiles.avatar_url} className="w-9 h-9 rounded-xl object-cover" alt="" />
                  ) : (
                    <span className="text-sm font-semibold text-text-sec">
                      {(member.profiles?.full_name ?? member.invited_email)?.[0]?.toUpperCase()}
                    </span>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {member.profiles?.full_name ?? member.invited_email}
                  </p>
                  <p className="text-xs text-gray-400 truncate">
                    {member.profiles?.email ?? member.invited_email}
                  </p>
                </div>

                {/* Status */}
                {member.status === 'pending' ? (
                  <span className="flex items-center gap-1.5 text-xs font-medium text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full flex-shrink-0">
                    <Clock size={11} />
                    Pending invite
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full flex-shrink-0">
                    <UserCheck size={11} />
                    Active
                  </span>
                )}

                {/* Role badge */}
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0 ${
                  member.role === 'admin'
                    ? 'bg-brand-primary/10 text-text-sec'
                    : 'bg-gray-100 text-gray-500'
                }`}>
                  {member.role}
                </span>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => openPermissions(member)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors"
                    title="Manage permissions"
                  >
                    <Settings size={15} />
                  </button>
                  <button
                    onClick={() => handleRemove(member.id, member.profiles?.email ?? member.invited_email)}
                    disabled={removing === member.id}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                    title="Remove member"
                  >
                    {removing === member.id
                      ? <Loader2 size={15} className="animate-spin" />
                      : <Trash2 size={15} />
                    }
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

        </>
      )}

      {/* Assign work modal */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5">
              <h3 className="text-[17px] font-semibold text-text">Assign agent work</h3>
              <button type="button" onClick={() => setShowAssignModal(false)}>
                <X size={18} className="text-gray-400 hover:text-gray-600" />
              </button>
            </div>
            <div className="space-y-4 p-6">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-text-soft">Team member</label>
                <select
                  value={assigneeProfileId}
                  onChange={e => setAssigneeProfileId(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-text"
                >
                  <option value="">Select member</option>
                  {assignableMembers.map(member => (
                    <option key={member.id} value={member.member_profile_id ?? ''}>
                      {member.profiles?.full_name ?? member.invited_email}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-text-soft">Agent</label>
                <select
                  value={assignAgent}
                  onChange={e => setAssignAgent(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-text"
                >
                  {COMMAND_CENTER_AGENTS.map(agent => (
                    <option key={agent.id} value={agent.id}>{agent.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-text-soft">Instructions</label>
                <textarea
                  value={assignNote}
                  onChange={e => setAssignNote(e.target.value)}
                  rows={4}
                  placeholder="What should they do? e.g. Run a competitor watch focused on pricing this week."
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-text"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-text-soft">Due date (optional)</label>
                <input
                  type="date"
                  value={assignDueAt}
                  onChange={e => setAssignDueAt(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-text"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="flex-1 rounded-xl bg-gray-50 py-3 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAssignWork}
                  disabled={!assigneeProfileId || !assignNote.trim() || assigning}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-primary py-3 text-sm font-semibold text-white transition-colors hover:bg-[#2563EB] disabled:opacity-50"
                >
                  {assigning ? <Loader2 size={14} className="animate-spin" /> : <ClipboardList size={14} />}
                  {assigning ? 'Assigning…' : 'Assign'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <h3 className="text-[17px] font-semibold text-text">
                {inviteStep === 'confirm' ? 'Confirm extra seat' : 'Invite team member'}
              </h3>
              <button onClick={closeInviteModal}>
                <X size={18} className="text-gray-400 hover:text-gray-600" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {inviteStep === 'confirm' ? (
                <>
                  <div className="rounded-xl border border-brand-primary/20 bg-brand-primary/5 px-4 py-4">
                    <p className="text-sm font-semibold text-text">Extra team seat — $15/mo</p>
                    <p className="mt-2 text-sm text-text-sec leading-relaxed">
                      Your {PLAN_LABELS[plan]} plan includes {includedSeats} seat{includedSeats === 1 ? '' : 's'}.
                      Inviting <span className="font-medium text-text">{inviteEmail.trim()}</span> adds a billable seat to your subscription immediately.
                    </p>
                  </div>
                  <p className="text-xs text-gray-500">
                    You can remove pending invites or team members later to adjust seat count on your next billing cycle.
                  </p>
                </>
              ) : (
                <>
              <div>
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-2">
                  Email address
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  placeholder="colleague@company.com"
                  className="w-full text-sm border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20 placeholder:text-gray-300"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-2">
                  Role
                </label>
                <div className="flex gap-2">
                  {['member', 'admin'].map(r => (
                    <button
                      key={r}
                      onClick={() => setInviteRole(r)}
                      className={`flex-1 text-sm font-medium py-2.5 rounded-xl border capitalize transition-all ${
                        inviteRole === r
                          ? 'border-brand-primary bg-brand-primary/5 text-text-sec'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-1.5">
                  Admins can manage orders and support. Members have view-only access to their permitted sections.
                </p>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-3">
                  Dashboard access
                </label>
                <div className="space-y-2">
                  {(Object.keys(PERMISSION_LABELS) as (keyof Permission)[]).map(key => (
                    <div key={key} className="flex items-center justify-between py-1.5">
                      <span className="text-sm text-gray-700">{PERMISSION_LABELS[key]}</span>
                      <button
                        onClick={() => togglePermission(key)}
                        disabled={key === 'support'}
                        className={`relative w-9 h-5 rounded-full transition-colors ${
                          invitePermissions[key] ? 'bg-brand-primary' : 'bg-gray-200'
                        } ${key === 'support' ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                          invitePermissions[key] ? 'translate-x-4' : 'translate-x-0'
                        }`} />
                      </button>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-2">Support is always visible to all team members.</p>
              </div>

              <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
                <p className="text-xs text-amber-700">
                  {totalSeats + 1 < includedSeats
                    ? `This seat is included in your ${PLAN_LABELS[plan]} plan.`
                    : canBillExtraSeat
                      ? `This invite requires an extra seat ($15/mo). You'll confirm billing on the next step.`
                      : `This invite requires an extra seat ($15/mo). Set up billing before inviting.`
                  }
                </p>
              </div>
                </>
              )}

              {error && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                  <AlertCircle size={13} className="text-red-500" />
                  <p className="text-xs text-red-700">{error}</p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={inviteStep === 'confirm' ? () => setInviteStep('details') : closeInviteModal}
                  className="flex-1 text-sm font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 py-3 rounded-xl transition-colors"
                >
                  {inviteStep === 'confirm' ? 'Back' : 'Cancel'}
                </button>
                <button
                  onClick={handleInvitePrimaryAction}
                  disabled={!inviteEmail.trim() || inviting}
                  className="flex-1 flex items-center justify-center gap-2 text-sm font-semibold text-white bg-brand-primary hover:bg-[#2563EB] py-3 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {inviting ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
                  {inviting
                    ? 'Sending...'
                    : inviteStep === 'confirm'
                      ? 'Confirm & send invite'
                      : inviteWillNeedExtraSeat && canBillExtraSeat
                        ? 'Continue to billing'
                        : 'Send invite'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Permissions Modal */}
      {showPermissionsModal && selectedMember && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <div>
                <h3 className="text-[17px] font-semibold text-text">Edit permissions</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  {selectedMember.profiles?.full_name ?? selectedMember.invited_email}
                </p>
              </div>
              <button onClick={() => setShowPermissionsModal(false)}>
                <X size={18} className="text-gray-400 hover:text-gray-600" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-2">Role</label>
                <div className="flex gap-2">
                  {['member', 'admin'].map(r => (
                    <button
                      key={r}
                      onClick={() => setSelectedMember(prev => prev ? { ...prev, role: r } : null)}
                      className={`flex-1 text-sm font-medium py-2.5 rounded-xl border capitalize transition-all ${
                        selectedMember.role === r
                          ? 'border-brand-primary bg-brand-primary/5 text-text-sec'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-3">
                  Dashboard access
                </label>
                <div className="space-y-2">
                  {(Object.keys(PERMISSION_LABELS) as (keyof Permission)[]).map(key => (
                    <div key={key} className="flex items-center justify-between py-1.5">
                      <span className="text-sm text-gray-700">{PERMISSION_LABELS[key]}</span>
                      <button
                        onClick={() => toggleMemberPermission(key)}
                        disabled={key === 'support'}
                        className={`relative w-9 h-5 rounded-full transition-colors ${
                          selectedMember.permissions[key] ? 'bg-brand-primary' : 'bg-gray-200'
                        } ${key === 'support' ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                          selectedMember.permissions[key] ? 'translate-x-4' : 'translate-x-0'
                        }`} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowPermissionsModal(false)}
                  className="flex-1 text-sm font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 py-3 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSavePermissions}
                  disabled={savingPermissions}
                  className="flex-1 flex items-center justify-center gap-2 text-sm font-semibold text-white bg-brand-primary hover:bg-[#2563EB] py-3 rounded-xl transition-colors disabled:opacity-50"
                >
                  {savingPermissions ? <Loader2 size={14} className="animate-spin" /> : <Shield size={14} />}
                  {savingPermissions ? 'Saving...' : 'Save permissions'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
