'use client'

import { useState, useEffect } from 'react'
import {
  Bell, Zap, ShoppingBag, Users, Megaphone,
  CreditCard, Save, Loader2, CheckCircle, AlertCircle,
  Plus, Pencil, Trash2, Eye, EyeOff, ChevronDown, X
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Prompt {
  id: string
  category: string
  title: string
  description: string
  prompt: string
  variables: { key: string; label: string }[]
  time_saved_mins: number
  sort_order: number
  is_active: boolean
}

interface Service {
  id: string
  name: string
  description: string
  icon: string
  sort_order: number
  is_active: boolean
}

interface User {
  id: string
  full_name: string | null
  company_name: string | null
  email: string | null
  role: string | null
  plan: string | null
  status: string | null
  created_at: string
}

interface Banner {
  enabled: boolean
  message: string
  type: 'info' | 'warning' | 'success'
}

interface Props {
  notifyEmail: string
  starterAiLimit: number
  platformBanner: Banner
  prompts: Prompt[]
  services: Service[]
  users: User[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function SaveButton({ saving, saved, disabled, onClick }: {
  saving: boolean
  saved: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || saving}
      className={`flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl transition-all ${
        saved ? 'bg-emerald-50 text-emerald-700' :
        disabled ? 'bg-gray-50 text-gray-300 cursor-not-allowed' :
        'bg-[#c8522a] text-white hover:bg-[#b8471f]'
      }`}
    >
      {saving ? <Loader2 size={14} className="animate-spin" /> :
       saved ? <CheckCircle size={14} /> :
       <Save size={14} />}
      {saving ? 'Saving...' : saved ? 'Saved' : 'Save'}
    </button>
  )
}

function SectionHeader({ icon: Icon, title, description }: {
  icon: React.ElementType
  title: string
  description: string
}) {
  return (
    <div className="flex items-start gap-4 mb-6">
      <div className="w-10 h-10 rounded-xl bg-[#c8522a]/10 flex items-center justify-center flex-shrink-0">
        <Icon size={18} className="text-[#c8522a]" />
      </div>
      <div>
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        <p className="text-sm text-gray-400 mt-0.5">{description}</p>
      </div>
    </div>
  )
}

async function saveSetting(key: string, value: unknown) {
  const res = await fetch('/api/admin/settings/update', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, value }),
  })
  if (!res.ok) throw new Error('Failed to save')
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function AdminSettingsClient({
  notifyEmail: initialEmail,
  starterAiLimit: initialLimit,
  platformBanner: initialBanner,
  prompts: initialPrompts,
  services: initialServices,
  users: initialUsers,
}: Props) {
  const [activeTab, setActiveTab] = useState('notifications')

  useEffect(() => {
    const lines = [
      'ADMIN — SETTINGS',
      `Notification email: ${initialEmail}`,
      `Starter AI run limit: ${initialLimit} runs/month`,
      `Platform banner: ${initialBanner.enabled ? `ACTIVE — "${initialBanner.message}" (${initialBanner.type})` : 'disabled'}`,
      `Prompt library: ${initialPrompts.length} prompts (${initialPrompts.filter(p => p.is_active).length} active)`,
      `Service catalogue: ${initialServices.length} services (${initialServices.filter(s => s.is_active).length} active)`,
      `Total users: ${initialUsers.length} (${initialUsers.filter(u => u.role === 'client').length} clients, ${initialUsers.filter(u => u.role === 'admin' || u.role === 'owner').length} admins)`,
    ]
    window.dispatchEvent(new CustomEvent('maya:canvas-context', { detail: { context: lines.join('\n') } }))
  }, [])

  const tabs = [
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'banner', label: 'Platform Banner', icon: Megaphone },
    { id: 'users', label: 'User Management', icon: Users },
    { id: 'billing', label: 'Billing Overrides', icon: CreditCard },
    { id: 'prompts', label: 'Prompt Library', icon: Zap },
    { id: 'services', label: 'Service Catalogue', icon: ShoppingBag },
  ]

  return (
    <div className="px-8 py-8 max-w-6xl">
      <div className="mb-8">
        <p className="text-[10px] font-semibold tracking-widest uppercase text-[#c8522a] mb-2">Admin</p>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-400 text-sm mt-1">Platform configuration and management</p>
      </div>

      <div className="flex gap-6">
        {/* Sidebar tabs */}
        <div className="w-48 flex-shrink-0 space-y-1">
          {tabs.map(tab => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left ${
                  activeTab === tab.id
                    ? 'bg-[#c8522a]/10 text-[#c8522a]'
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
                }`}
              >
                <Icon size={15} />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {activeTab === 'notifications' && (
            <NotificationsSection initialEmail={initialEmail} initialLimit={initialLimit} />
          )}
          {activeTab === 'banner' && (
            <BannerSection initialBanner={initialBanner} />
          )}
          {activeTab === 'users' && (
            <UsersSection initialUsers={initialUsers} />
          )}
          {activeTab === 'billing' && (
            <BillingSection users={initialUsers} />
          )}
          {activeTab === 'prompts' && (
            <PromptsSection initialPrompts={initialPrompts} />
          )}
          {activeTab === 'services' && (
            <ServicesSection initialServices={initialServices} />
          )}
        </div>
      </div>
    </div>
  )
}

// ── Notifications Section ─────────────────────────────────────────────────────

function NotificationsSection({ initialEmail, initialLimit }: {
  initialEmail: string
  initialLimit: number
}) {
  const [email, setEmail] = useState(initialEmail)
  const [limit, setLimit] = useState(initialLimit)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      await saveSetting('notify_email', email)
      await saveSetting('starter_ai_limit', limit)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {
      setError('Failed to save settings.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6">
      <SectionHeader
        icon={Bell}
        title="Notifications"
        description="Control where platform notifications are sent and AI usage limits."
      />
      <div className="space-y-5">
        <div>
          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-2">
            Admin notification email
          </label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-[#c8522a] focus:ring-1 focus:ring-[#c8522a]/20"
          />
          <p className="text-xs text-gray-400 mt-1.5">
            Receives new order, support ticket, and qualified lead emails.
          </p>
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-2">
            Starter plan AI Toolkit run limit
          </label>
          <div className="flex items-center gap-3">
            <input
              type="number"
              value={limit}
              onChange={e => setLimit(Number(e.target.value))}
              min={1}
              max={100}
              className="w-32 text-sm border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-[#c8522a] focus:ring-1 focus:ring-[#c8522a]/20"
            />
            <span className="text-sm text-gray-400">runs per month</span>
          </div>
          <p className="text-xs text-gray-400 mt-1.5">
            Growth and ProAgent plans always have unlimited runs.
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
            <AlertCircle size={13} className="text-red-500" />
            <p className="text-xs text-red-700">{error}</p>
          </div>
        )}

        <div className="flex justify-end pt-2 border-t border-gray-50">
          <SaveButton saving={saving} saved={saved} onClick={handleSave} />
        </div>
      </div>
    </div>
  )
}

// ── Banner Section ────────────────────────────────────────────────────────────

function BannerSection({ initialBanner }: { initialBanner: Banner }) {
  const [banner, setBanner] = useState<Banner>(initialBanner)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      await saveSetting('platform_banner', banner)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {
      setError('Failed to save banner.')
    } finally {
      setSaving(false)
    }
  }

  const previewColors = {
    info: 'bg-blue-50 border-blue-100 text-blue-800',
    warning: 'bg-amber-50 border-amber-100 text-amber-800',
    success: 'bg-emerald-50 border-emerald-100 text-emerald-800',
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6">
      <SectionHeader
        icon={Megaphone}
        title="Platform Banner"
        description="Show a global announcement to all clients in their dashboard."
      />
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-800">Enable banner</p>
            <p className="text-xs text-gray-400">Shows at the top of every client dashboard</p>
          </div>
          <button
            onClick={() => setBanner(b => ({ ...b, enabled: !b.enabled }))}
            className={`relative w-11 h-6 rounded-full transition-colors ${
              banner.enabled ? 'bg-[#c8522a]' : 'bg-gray-200'
            }`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
              banner.enabled ? 'translate-x-5' : 'translate-x-0'
            }`} />
          </button>
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-2">
            Banner type
          </label>
          <div className="flex gap-2">
            {(['info', 'warning', 'success'] as const).map(type => (
              <button
                key={type}
                onClick={() => setBanner(b => ({ ...b, type }))}
                className={`text-xs font-medium px-4 py-2 rounded-lg border capitalize transition-all ${
                  banner.type === type
                    ? 'border-[#c8522a] bg-[#c8522a]/5 text-[#c8522a]'
                    : 'border-gray-200 text-gray-400 hover:border-gray-300'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-2">
            Message
          </label>
          <textarea
            value={banner.message}
            onChange={e => setBanner(b => ({ ...b, message: e.target.value }))}
            placeholder="e.g. We're performing maintenance on Sunday from 2–4am UTC."
            rows={3}
            className="w-full text-sm border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-[#c8522a] focus:ring-1 focus:ring-[#c8522a]/20 resize-none placeholder:text-gray-300"
          />
        </div>

        {banner.message && (
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Preview</p>
            <div className={`rounded-xl border px-4 py-3 text-sm font-medium ${previewColors[banner.type]}`}>
              {banner.message}
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
            <AlertCircle size={13} className="text-red-500" />
            <p className="text-xs text-red-700">{error}</p>
          </div>
        )}

        <div className="flex justify-end pt-2 border-t border-gray-50">
          <SaveButton saving={saving} saved={saved} onClick={handleSave} />
        </div>
      </div>
    </div>
  )
}

// ── Users Section ─────────────────────────────────────────────────────────────

function UsersSection({ initialUsers }: { initialUsers: User[] }) {
  const [users, setUsers] = useState<User[]>(initialUsers)
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const filtered = users.filter(u =>
    [u.full_name, u.company_name, u.email].some(v =>
      v?.toLowerCase().includes(search.toLowerCase())
    )
  )

  async function updateUser(userId: string, updates: Partial<User>) {
    setSaving(userId)
    setError(null)
    try {
      const res = await fetch('/api/admin/settings/update-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, ...updates }),
      })
      if (!res.ok) throw new Error('Failed to update user')
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, ...updates } : u))
    } catch {
      setError('Failed to update user.')
    } finally {
      setSaving(null)
    }
  }

  function roleBadgeColor(role: string | null) {
    if (role === 'owner') return 'bg-[#0d0d0d] text-white'
    if (role === 'admin') return 'bg-[#c8522a]/10 text-[#c8522a]'
    return 'bg-gray-100 text-gray-600'
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6">
      <SectionHeader
        icon={Users}
        title="User Management"
        description="View all users, change roles, and manage account status."
      />

      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search by name, company, or email..."
        className="w-full text-sm border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-[#c8522a] focus:ring-1 focus:ring-[#c8522a]/20 mb-4 placeholder:text-gray-300"
      />

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-3 py-2 mb-4">
          <AlertCircle size={13} className="text-red-500" />
          <p className="text-xs text-red-700">{error}</p>
        </div>
      )}

      <div className="divide-y divide-gray-50">
        {filtered.map(user => (
          <div key={user.id} className="py-4 flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900">
                {user.company_name ?? user.full_name ?? '—'}
              </p>
              <p className="text-xs text-gray-400">{user.email}</p>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Role */}
              <select
                value={user.role ?? 'client'}
                onChange={e => updateUser(user.id, { role: e.target.value })}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#c8522a] bg-white text-gray-700"
              >
                <option value="client">Client</option>
                <option value="admin">Admin</option>
                <option value="owner">Owner</option>
              </select>

              {/* Status */}
              <select
                value={user.status ?? 'active'}
                onChange={e => updateUser(user.id, { status: e.target.value })}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#c8522a] bg-white text-gray-700"
              >
                <option value="onboarding">Onboarding</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="churned">Churned</option>
              </select>

              {saving === user.id && (
                <Loader2 size={14} className="text-gray-400 animate-spin" />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Billing Overrides Section ─────────────────────────────────────────────────

function BillingSection({ users }: { users: User[] }) {
  const [selectedUser, setSelectedUser] = useState('')
  const [plan, setPlan] = useState('growth')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const clients = users.filter(u => u.role === 'client' || !u.role)

  async function handleOverride() {
    if (!selectedUser) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/settings/update-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedUser, plan, status: 'active' }),
      })
      if (!res.ok) throw new Error('Failed to update plan')
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {
      setError('Failed to apply billing override.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6">
      <SectionHeader
        icon={CreditCard}
        title="Billing Overrides"
        description="Manually set a client's plan — for comps, partnerships, or special deals."
      />

      <div className="space-y-4">
        <div>
          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-2">
            Select client
          </label>
          <select
            value={selectedUser}
            onChange={e => setSelectedUser(e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-[#c8522a] bg-white text-gray-700"
          >
            <option value="">— Select a client —</option>
            {clients.map(u => (
              <option key={u.id} value={u.id}>
                {u.company_name ?? u.full_name ?? u.email} {u.plan ? `(${u.plan})` : '(no plan)'}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-2">
            Override plan
          </label>
          <div className="flex gap-2">
            {['starter', 'growth', 'proagent'].map(p => (
              <button
                key={p}
                onClick={() => setPlan(p)}
                className={`text-xs font-semibold px-4 py-2 rounded-lg border capitalize transition-all ${
                  plan === p
                    ? 'bg-[#c8522a] border-[#c8522a] text-white'
                    : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
          <p className="text-xs text-amber-700">
            This overrides the plan in the database only — it does not create or cancel a Stripe subscription.
            Use for internal accounts, comps, and beta testers only.
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
            <AlertCircle size={13} className="text-red-500" />
            <p className="text-xs text-red-700">{error}</p>
          </div>
        )}

        <div className="flex justify-end pt-2 border-t border-gray-50">
          <SaveButton
            saving={saving}
            saved={saved}
            disabled={!selectedUser}
            onClick={handleOverride}
          />
        </div>
      </div>
    </div>
  )
}

// ── Prompts Section ───────────────────────────────────────────────────────────

function PromptsSection({ initialPrompts }: { initialPrompts: Prompt[] }) {
  const [prompts, setPrompts] = useState<Prompt[]>(initialPrompts)
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function togglePrompt(id: string, is_active: boolean) {
    setSaving(id)
    try {
      const res = await fetch('/api/admin/settings/update-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_active }),
      })
      if (!res.ok) throw new Error('Failed')
      setPrompts(prev => prev.map(p => p.id === id ? { ...p, is_active } : p))
    } catch {
      setError('Failed to update prompt.')
    } finally {
      setSaving(null)
    }
  }

  const categories = [...new Set(prompts.map(p => p.category))]

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6">
      <SectionHeader
        icon={Zap}
        title="Prompt Library"
        description="Manage the AI Toolkit prompts available to clients."
      />

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-3 py-2 mb-4">
          <AlertCircle size={13} className="text-red-500" />
          <p className="text-xs text-red-700">{error}</p>
        </div>
      )}

      <div className="space-y-4">
        {categories.map(cat => (
          <div key={cat}>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 capitalize">{cat}</p>
            <div className="space-y-2">
              {prompts.filter(p => p.category === cat).map(prompt => (
                <div
                  key={prompt.id}
                  className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${
                    prompt.is_active ? 'border-gray-100 bg-white' : 'border-gray-100 bg-gray-50 opacity-60'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800">{prompt.title}</p>
                    <p className="text-xs text-gray-400 truncate">{prompt.description}</p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                    <span className="text-xs text-gray-400">{prompt.time_saved_mins}min saved</span>
                    {saving === prompt.id ? (
                      <Loader2 size={14} className="animate-spin text-gray-400" />
                    ) : (
                      <button
                        onClick={() => togglePrompt(prompt.id, !prompt.is_active)}
                        className={`relative w-9 h-5 rounded-full transition-colors ${
                          prompt.is_active ? 'bg-[#c8522a]' : 'bg-gray-200'
                        }`}
                      >
                        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                          prompt.is_active ? 'translate-x-4' : 'translate-x-0'
                        }`} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {prompts.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-8">No prompts in the library yet.</p>
        )}
      </div>
    </div>
  )
}

// ── Services Section ──────────────────────────────────────────────────────────

function ServicesSection({ initialServices }: { initialServices: Service[] }) {
  const [services, setServices] = useState<Service[]>(initialServices)
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function toggleService(id: string, is_active: boolean) {
    setSaving(id)
    try {
      const res = await fetch('/api/admin/settings/update-service', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_active }),
      })
      if (!res.ok) throw new Error('Failed')
      setServices(prev => prev.map(s => s.id === id ? { ...s, is_active } : s))
    } catch {
      setError('Failed to update service.')
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6">
      <SectionHeader
        icon={ShoppingBag}
        title="Service Catalogue"
        description="Control which services are visible to clients in the Services tab."
      />

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-3 py-2 mb-4">
          <AlertCircle size={13} className="text-red-500" />
          <p className="text-xs text-red-700">{error}</p>
        </div>
      )}

      <div className="space-y-2">
        {services.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">
            No services found. Make sure the services table has data.
          </p>
        ) : (
          services.map(service => (
            <div
              key={service.id}
              className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${
                service.is_active ? 'border-gray-100 bg-white' : 'border-gray-100 bg-gray-50 opacity-60'
              }`}
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <span className="text-xl">{service.icon}</span>
                <div>
                  <p className="text-sm font-medium text-gray-800">{service.name}</p>
                  <p className="text-xs text-gray-400 truncate">{service.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                {saving === service.id ? (
                  <Loader2 size={14} className="animate-spin text-gray-400" />
                ) : (
                  <button
                    onClick={() => toggleService(service.id, !service.is_active)}
                    className={`relative w-9 h-5 rounded-full transition-colors ${
                      service.is_active ? 'bg-[#c8522a]' : 'bg-gray-200'
                    }`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                      service.is_active ? 'translate-x-4' : 'translate-x-0'
                    }`} />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
