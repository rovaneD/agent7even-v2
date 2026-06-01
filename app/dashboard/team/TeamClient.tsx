'use client'

import { useState, useEffect } from 'react'
import {
  Users, Plus, Mail, Trash2, Loader2, CheckCircle,
  AlertCircle, X, Shield, Settings, Eye, EyeOff,
  Clock, UserCheck
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
}: Props) {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>(initial)
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
  const canAddMore = true // Always can add, just costs more

  useEffect(() => {
    const memberLines = initial.length
      ? initial.map(m => `- ${m.profiles?.full_name ?? m.invited_email} (role: ${m.role}, status: ${m.status})`).join('\n')
      : '- No team members yet (only the account owner)'
    const context = `TEAM PAGE
Company: ${companyName}
Plan: ${plan}
Seats included in plan: ${includedSeats}
Seats used: ${totalMembers + 1} (${activeMembers} active member(s) + ${pendingMembers} pending + 1 owner)
Extra paid seats: ${extraSeats}
Team members:
${memberLines}
The user can invite new team members and manage their roles and permissions.`
    window.dispatchEvent(new CustomEvent('maya:canvas-context', { detail: { context } }))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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
      setShowInviteModal(false)
      setInviteEmail('')
      setInvitePermissions(DEFAULT_PERMISSIONS)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send invite')
    } finally {
      setInviting(false)
    }
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

  const totalSeats = activeMembers + pendingMembers

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Team</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {companyName} — manage your team members and their access
          </p>
        </div>
        <button
          onClick={() => setShowInviteModal(true)}
          className="flex items-center gap-2 bg-[#2D3748] text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-[#b8471f] transition-colors"
        >
          <Plus size={15} />
          Invite member
        </button>
      </div>

      {/* Alerts */}
      {success && (
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3">
          <CheckCircle size={15} className="text-emerald-600 flex-shrink-0" />
          <p className="text-sm text-emerald-700 flex-1">{success}</p>
          <button onClick={() => setSuccess(null)}><X size={14} className="text-emerald-400" /></button>
        </div>
      )}
      {error && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
          <AlertCircle size={15} className="text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700 flex-1">{error}</p>
          <button onClick={() => setError(null)}><X size={14} className="text-red-400" /></button>
        </div>
      )}

      {/* Seat usage card */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="text-sm font-semibold text-gray-700">Seat usage</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {PLAN_LABELS[plan]} includes {includedSeats} seat{includedSeats !== 1 ? 's' : ''}.
              Additional seats are $15/mo each.
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-semibold text-gray-900">{totalSeats + 1}</p>
            <p className="text-xs text-gray-400">total seats used</p>
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
              <span className="font-semibold text-[#64748B]">${extraSeats * 15}/mo added to your subscription</span>
            </div>
          )}
        </div>
      </div>

      {/* Team members list */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-50">
          <h2 className="text-sm font-semibold text-gray-700">Team members</h2>
        </div>

        {teamMembers.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <Users size={24} className="text-gray-200 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-600 mb-1">No team members yet</p>
            <p className="text-xs text-gray-400 mb-5">
              Invite team members to give them access to your dashboard.
            </p>
            <button
              onClick={() => setShowInviteModal(true)}
              className="inline-flex items-center gap-2 text-sm font-medium text-[#64748B] bg-[#2D3748]/10 hover:bg-[#2D3748]/15 px-4 py-2.5 rounded-xl transition-colors"
            >
              <Plus size={14} />
              Invite your first team member
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {teamMembers.map(member => (
              <div key={member.id} className="flex items-center gap-4 px-6 py-4">
                {/* Avatar */}
                <div className="w-9 h-9 rounded-xl bg-[#2D3748]/10 flex items-center justify-center flex-shrink-0">
                  {member.profiles?.avatar_url ? (
                    <img src={member.profiles.avatar_url} className="w-9 h-9 rounded-xl object-cover" alt="" />
                  ) : (
                    <span className="text-sm font-semibold text-[#64748B]">
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
                    ? 'bg-[#2D3748]/10 text-[#64748B]'
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

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <h3 className="text-base font-semibold text-gray-900">Invite team member</h3>
              <button onClick={() => setShowInviteModal(false)}>
                <X size={18} className="text-gray-400 hover:text-gray-600" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-2">
                  Email address
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  placeholder="colleague@company.com"
                  className="w-full text-sm border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6]/20 placeholder:text-gray-300"
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
                          ? 'border-[#3B82F6] bg-[#2D3748]/5 text-[#64748B]'
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
                          invitePermissions[key] ? 'bg-[#2D3748]' : 'bg-gray-200'
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
                  {totalSeats < includedSeats
                    ? `This seat is included in your ${PLAN_LABELS[plan]} plan.`
                    : `This will add $15/mo to your subscription for an extra seat.`
                  }
                </p>
              </div>

              {error && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                  <AlertCircle size={13} className="text-red-500" />
                  <p className="text-xs text-red-700">{error}</p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowInviteModal(false)}
                  className="flex-1 text-sm font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 py-3 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleInvite}
                  disabled={!inviteEmail.trim() || inviting}
                  className="flex-1 flex items-center justify-center gap-2 text-sm font-semibold text-white bg-[#2D3748] hover:bg-[#b8471f] py-3 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {inviting ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
                  {inviting ? 'Sending...' : 'Send invite'}
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
                <h3 className="text-base font-semibold text-gray-900">Edit permissions</h3>
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
                          ? 'border-[#3B82F6] bg-[#2D3748]/5 text-[#64748B]'
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
                          selectedMember.permissions[key] ? 'bg-[#2D3748]' : 'bg-gray-200'
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
                  className="flex-1 flex items-center justify-center gap-2 text-sm font-semibold text-white bg-[#2D3748] hover:bg-[#b8471f] py-3 rounded-xl transition-colors disabled:opacity-50"
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
