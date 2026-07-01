'use client'

import { useState, useEffect, useMemo } from 'react'
import { useMayaContext } from '@/hooks/useMayaContext'
import { buildServicesMayaContext } from '@/lib/maya/summaries/workspaceContext'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Globe, Hash, Camera, Mail, Search,
  Brush, Video, Megaphone, Plus, X, ChevronRight,
  Clock, CheckCircle, AlertCircle, Loader2, ArrowRight, Code2, ChevronLeft, Send, Flame,
  Sparkles, Target, Layers, FileText, Download, Trash2, MessageSquare,
} from 'lucide-react'
import { formatOrderNumber } from '@/lib/orders/formatOrderNumber'
import ViralHooksOutputView from '@/components/agents/ViralHooksOutputView'
import { displayServiceBrief, extractViralHooksGeneratedOutput, formatViralHooksBrief, readViralHooksPrefill, clearViralHooksPrefill, VIRAL_HOOKS_FRAMEWORK, type ViralHooksFormValues } from '@/lib/services/viralHooks'
import { buildTextPdf } from '@/lib/pdf/textPdf'
import PlanUsageCallout from '@/components/dashboard/PlanUsageCallout'

const SERVICES = [
  {
    id: 'viral_hooks',
    icon: Flame,
    name: 'Viral Hooks',
    desc: 'Free hook ideation for Reels, TikToks, Shorts, carousels, and social posts using proven hook frameworks.',
    price: 'Free',
    type: 'free',
    deliveryDays: 1,
    requiresScope: false,
  },
  {
    id: 'design_dev',
    icon: Code2,
    name: 'Design & Development',
    desc: 'UI/UX design, mobile app development, and custom web builds. Tell us about your project and we\'ll send a custom proposal.',
    price: 'Custom quote',
    type: 'project',
    deliveryDays: null,
    requiresScope: true,
  },
  {
    id: 'website',
    icon: Globe,
    name: 'Website Building',
    desc: 'Up to 5 pages, mobile-optimized, SEO-ready. Built on Webflow, Framer, or Shopify.',
    price: 'from $3,500',
    type: 'project',
    deliveryDays: 14,
    requiresScope: false,
  },
  {
    id: 'social_media',
    icon: Hash,
    name: 'Social Media Management',
    desc: '12–16 posts/month. Content calendar, captions, scheduling, and monthly reporting.',
    price: 'from $1,500/mo',
    type: 'retainer',
    deliveryDays: 7,
    requiresScope: false,
  },
  {
    id: 'photography',
    icon: Camera,
    name: 'Product Photography',
    desc: 'Studio or on-location. Up to 20 edited hero images, delivered in 5 business days.',
    price: 'from $1,200/session',
    type: 'project',
    deliveryDays: 7,
    requiresScope: false,
  },
  {
    id: 'email_marketing',
    icon: Mail,
    name: 'Email Marketing Setup',
    desc: 'Platform setup, welcome sequence, 3 automation flows, and branded templates.',
    price: 'from $1,500',
    type: 'project',
    deliveryDays: 10,
    requiresScope: false,
  },
  {
    id: 'seo',
    icon: Search,
    name: 'SEO Basics',
    desc: 'Keyword research, on-page optimization, metadata, and Google Search Console setup.',
    price: 'from $1,200',
    type: 'project',
    deliveryDays: 10,
    requiresScope: false,
  },
  {
    id: 'brand_identity',
    icon: Brush,
    name: 'Brand Identity & Logo',
    desc: 'Logo, color palette, typography system, and a brand guide you can hand to any vendor.',
    price: 'from $3,000',
    type: 'project',
    deliveryDays: 14,
    requiresScope: false,
  },
  {
    id: 'video_reels',
    icon: Video,
    name: 'Video & Reels Editing',
    desc: '8 short-form videos/month. Send raw footage — get back polished, platform-ready Reels.',
    price: 'from $1,200/mo',
    type: 'retainer',
    deliveryDays: 5,
    requiresScope: false,
  },
  {
    id: 'ad_management',
    icon: Megaphone,
    name: 'Ad Management',
    desc: 'Meta and/or Google — strategy, creative, targeting, optimization, and monthly reporting.',
    price: 'from $2,000/mo',
    type: 'retainer',
    deliveryDays: 7,
    requiresScope: false,
  },
]

const STATUS_CONFIG = {
  submitted: { label: 'Submitted', color: 'bg-brand-primary/10 text-brand-primary', icon: Clock },
  in_review: { label: 'In Review', color: 'bg-status-warning/10 text-status-warning', icon: Loader2 },
  in_progress: { label: 'In Progress', color: 'bg-brand-accent/10 text-brand-accent', icon: Loader2 },
  delivered: { label: 'Delivered', color: 'bg-status-success/10 text-status-success', icon: CheckCircle },
  completed: { label: 'Completed', color: 'bg-status-success/10 text-status-success', icon: CheckCircle },
  revision_requested: { label: 'Revision Requested', color: 'bg-status-warning/10 text-status-warning', icon: AlertCircle },
  approved: { label: 'Approved', color: 'bg-status-success/10 text-status-success', icon: CheckCircle },
  cancelled: { label: 'Cancelled', color: 'bg-surface-2 text-text-soft', icon: X },
}

const STATUS_HINT: Record<string, string> = {
  submitted: 'We received your request — our team will review your brief.',
  in_review: 'A specialist is reviewing your scope and timeline.',
  in_progress: 'Work is underway — check messages for updates.',
  delivered: 'Deliverables are ready for your review.',
  completed: 'This order is closed — nothing else needed from you.',
  revision_requested: 'You asked for changes — we will update and resend.',
  approved: 'You approved the deliverable — order complete.',
  cancelled: 'This request was cancelled.',
}

const CLOSED_STATUSES = ['approved', 'cancelled', 'completed']

interface Message {
  id: string
  sender_role: string
  body: string
  created_at: string
}

interface Order {
  id: string
  service_type: string
  title: string
  brief?: string | null
  status: string
  created_at: string
  due_date?: string
  support_ticket_id?: string | null
  support_ticket_body?: string | null
  support_messages?: Message[]
}

interface Profile {
  id: string
  plan?: string
}

function generatedOutputFromTicketBody(body: string | null | undefined) {
  if (!body) return ''
  const marker = '\n\nGenerated output:\n'
  const index = body.indexOf(marker)
  return index >= 0 ? body.slice(index + marker.length).trim() : ''
}

function downloadGeneratedPdf(title: string, subtitle: string, body: string) {
  const pdf = buildTextPdf(title, subtitle, body)
  const blob = new Blob([pdf], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'generated-output'}.pdf`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

interface RequestModalProps {
  service: typeof SERVICES[0]
  error?: string
  initialValues?: ViralHooksFormValues | null
  onClose: () => void
  onSubmit: (brief: string) => Promise<void>
}

function ViralHooksGeneratorModal({ service, error, initialValues, onClose, onSubmit }: RequestModalProps) {
  const [topic, setTopic] = useState(initialValues?.topic ?? '')
  const [audience, setAudience] = useState(initialValues?.audience ?? '')
  const [goal, setGoal] = useState(initialValues?.goal ?? 'Drive interest')
  const [format, setFormat] = useState(initialValues?.format ?? 'Instagram Reel')
  const [tone, setTone] = useState(initialValues?.tone ?? 'Direct and useful')
  const [notes, setNotes] = useState(initialValues?.notes ?? '')
  const [loading, setLoading] = useState(false)
  const Icon = service.icon

  useEffect(() => {
    if (!initialValues) return
    setTopic(initialValues.topic)
    setAudience(initialValues.audience)
    setGoal(initialValues.goal)
    setFormat(initialValues.format)
    setTone(initialValues.tone)
    setNotes(initialValues.notes)
  }, [initialValues])

  const handleSubmit = async () => {
    if (!topic.trim()) return
    setLoading(true)
    await onSubmit(formatViralHooksBrief({
      topic,
      audience,
      goal,
      format,
      tone,
      notes,
    }))
    setLoading(false)
  }

  const chips = [
    'Cost-Narration',
    'False Statement',
    'Comparison',
    'Callout',
    'Bold Statement',
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-3xl overflow-hidden rounded-[24px] border border-border bg-surface shadow-2xl">
        <div className="flex items-start justify-between border-b border-border p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-status-success/10">
              <Icon size={20} className="text-status-success" />
            </div>
            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-status-success">Free self-serve tool</p>
              <h2 className="text-xl font-semibold text-text">Generate Viral Hooks</h2>
              <p className="mt-1 text-sm text-text-sec">
                {initialValues
                  ? 'Fields are pre-filled from your Idea Analysis — review, then Generate.'
                  : 'Maya will create hooks now. No admin handoff needed.'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-text-soft transition-colors hover:text-text">
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_240px]">
          <div className="p-6 space-y-5">
            <div>
              <label className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">
                <Sparkles size={13} />
                What are these hooks for?
              </label>
              <textarea
                value={topic}
                onChange={e => setTopic(e.target.value)}
                placeholder="Example: Instagram video promoting Maya to small business owners tired of agencies and complex marketing tools."
                rows={4}
                className="w-full resize-none rounded-xl border border-border px-4 py-3 text-sm text-text outline-none transition-colors placeholder:text-text-soft focus:border-brand-primary/50"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">
                  <Target size={13} />
                  Audience
                </label>
                <input
                  value={audience}
                  onChange={e => setAudience(e.target.value)}
                  placeholder="Small business owners, creators, coaches..."
                  className="w-full rounded-xl border border-border px-4 py-3 text-sm outline-none focus:border-brand-primary/50"
                />
              </div>
              <div>
                <label className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">
                  <Layers size={13} />
                  Format
                </label>
                <select
                  value={format}
                  onChange={e => setFormat(e.target.value)}
                  className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm outline-none focus:border-brand-primary/50"
                >
                  <option>Instagram Reel</option>
                  <option>TikTok</option>
                  <option>YouTube Short</option>
                  <option>Carousel</option>
                  <option>Caption</option>
                  <option>Email</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2 block">Goal</label>
                <select
                  value={goal}
                  onChange={e => setGoal(e.target.value)}
                  className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm outline-none focus:border-brand-primary/50"
                >
                  <option>Drive interest</option>
                  <option>Book demos</option>
                  <option>Start trials</option>
                  <option>Grow followers</option>
                  <option>Educate the audience</option>
                  <option>Launch an offer</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2 block">Tone</label>
                <select
                  value={tone}
                  onChange={e => setTone(e.target.value)}
                  className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm outline-none focus:border-brand-primary/50"
                >
                  <option>Direct and useful</option>
                  <option>Bold and punchy</option>
                  <option>Warm and educational</option>
                  <option>Contrarian</option>
                  <option>Premium and polished</option>
                </select>
              </div>
            </div>

            <div>
              <label className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">
                <FileText size={13} />
                Extra context
              </label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Optional: pain points, claims to avoid, product details, examples, competitors, or exact words to include."
                rows={3}
                className="w-full resize-none rounded-xl border border-border px-4 py-3 text-sm text-text outline-none placeholder:text-text-soft focus:border-brand-primary/50"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                <AlertCircle size={14} className="text-red-500 flex-shrink-0" />
                <p className="text-xs text-red-700">{error}</p>
              </div>
            )}
          </div>

          <div className="border-t border-border bg-surface-2 p-6 lg:border-l lg:border-t-0">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Frameworks included</p>
            <div className="space-y-2">
              {chips.map(chip => (
                <div key={chip} className="rounded-xl border border-border bg-surface px-3 py-2 text-xs font-medium text-text-sec">
                  {chip}
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 leading-relaxed mt-4">
              The output is saved in Services so you can revisit it or generate another set later.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between px-6 py-5 border-t border-gray-100">
          <button
            onClick={onClose}
            className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!topic.trim() || loading}
            className="flex items-center gap-2 rounded-xl bg-brand-primary px-6 py-2.5 text-[15px] font-semibold text-white transition-colors hover:bg-[#2563EB] disabled:opacity-40"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {loading ? 'Generating...' : 'Generate hooks'}
          </button>
        </div>
      </div>
    </div>
  )
}

function RequestModal({ service, error, onClose, onSubmit }: RequestModalProps) {
  const [brief, setBrief] = useState('')
  const [loading, setLoading] = useState(false)
  const Icon = service.icon

  const handleSubmit = async () => {
    if (!brief.trim()) return
    setLoading(true)
    await onSubmit(brief)
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-[24px] border border-border bg-surface shadow-2xl">

        {/* Header */}
        <div className="flex items-start justify-between border-b border-border p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-primary/10">
              <Icon size={18} className="text-brand-primary" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-text">{service.name}</h2>
              <p className="text-xs text-text-soft">{service.price}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">
            Tell us about your project
          </label>
          <textarea
            value={brief}
            onChange={e => setBrief(e.target.value)}
            placeholder={`Describe what you need for ${service.name.toLowerCase()}. Include any relevant details about your business, goals, timeline preferences, and any existing assets we should know about.`}
            rows={5}
            className="w-full resize-none rounded-xl border border-border px-4 py-3 text-sm text-text outline-none transition-colors placeholder:text-text-soft focus:border-brand-primary/50"
          />
          <p className="text-xs text-gray-400 mt-2">
            Our team will review and respond within 1 business day.
          </p>
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-4 py-3 mt-4">
              <AlertCircle size={14} className="text-red-500 flex-shrink-0" />
              <p className="text-xs text-red-700">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 pb-6 gap-3">
          <button
            onClick={onClose}
            className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!brief.trim() || loading}
            className="flex items-center gap-2 rounded-xl bg-brand-primary px-6 py-2.5 text-[15px] font-semibold text-white transition-colors hover:bg-[#2563EB] disabled:opacity-40"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : null}
            Submit request
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ServicesClient({
  profile,
  orders,
  initialOrderId,
  openViralHooksPrefill = false,
  creditBalance = null,
}: {
  profile: Profile | null
  orders: Order[]
  initialOrderId?: string | null
  openViralHooksPrefill?: boolean
  creditBalance?: number | null
}) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'browse' | 'orders'>(initialOrderId ? 'orders' : 'browse')
  const [localOrders, setLocalOrders] = useState<Order[]>(orders)
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(initialOrderId ?? null)
  const [viralHooksPrefill, setViralHooksPrefill] = useState<ViralHooksFormValues | null>(null)

  const mayaContext = useMemo(
    () =>
      buildServicesMayaContext({
        plan: profile?.plan,
        orders: localOrders,
        services: SERVICES.map(s => ({ name: s.name, price: s.price, type: s.type })),
      }),
    [localOrders, profile?.plan],
  )
  useMayaContext(mayaContext)
  const [requestingService, setRequestingService] = useState<typeof SERVICES[0] | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!openViralHooksPrefill) return
    const prefill = readViralHooksPrefill()
    if (!prefill) return
    clearViralHooksPrefill()
    const viralService = SERVICES.find(service => service.id === 'viral_hooks')
    if (!viralService) return
    setViralHooksPrefill(prefill)
    setRequestingService(viralService)
    setActiveTab('browse')
    router.replace('/dashboard/services')
  }, [openViralHooksPrefill, router])

  const [successMsg, setSuccessMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [replyBody, setReplyBody] = useState('')
  const [replying, setReplying] = useState(false)
  const [completingOrder, setCompletingOrder] = useState(false)
  const [regeneratingOrder, setRegeneratingOrder] = useState(false)
  const [deletingOrderId, setDeletingOrderId] = useState<string | null>(null)

  const handleRequest = async (brief: string) => {
    if (!requestingService || !profile) return
    setSubmitting(true)
    setErrorMsg('')
    const serviceBrief = requestingService.id === 'viral_hooks'
      ? `${brief.trim()}

${VIRAL_HOOKS_FRAMEWORK}`
      : brief

    try {
      const res = await fetch('/api/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_type: requestingService.id,
          title: requestingService.name,
          brief: serviceBrief,
        }),
      })
      const data = await res.json().catch(() => ({}))

      if (res.ok) {
        const nextOrder = data.order
          ? {
            ...data.order,
            support_ticket_id: data.supportTicketId ?? null,
            support_ticket_body: data.supportTicketBody ?? null,
            support_messages: data.supportMessages ?? [],
          }
          : null
        setRequestingService(null)
        setViralHooksPrefill(null)
        if (nextOrder) setLocalOrders(prev => [nextOrder, ...prev])
        if (nextOrder) setSelectedOrderId(nextOrder.id)
        setSuccessMsg(requestingService.id === 'viral_hooks'
          ? data.deliverableWarning ?? 'Your Viral Hooks are ready. The PDF was saved to Deliverables.'
          : `Your ${requestingService.name} request has been submitted. A follow-up conversation is open here in Services.`
        )
        setActiveTab('orders')
        setTimeout(() => setSuccessMsg(''), 5000)
      } else {
        setErrorMsg(data.error ?? 'Could not submit that service request. Try again.')
      }
    } catch {
      setErrorMsg('Could not submit that service request. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const activeOrders = localOrders.filter(o => !CLOSED_STATUSES.includes(o.status))
  const completedOrders = localOrders.filter(o => CLOSED_STATUSES.includes(o.status))
  const selectedOrder = selectedOrderId ? localOrders.find(order => order.id === selectedOrderId) ?? null : null

  async function handleServiceReply() {
    if (!selectedOrder?.support_ticket_id || !replyBody.trim()) return
    setReplying(true)
    setErrorMsg('')
    try {
      const res = await fetch('/api/support/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId: selectedOrder.support_ticket_id, body: replyBody, role: 'client' }),
      })
      if (!res.ok) throw new Error('Failed to send reply')
      const { message } = await res.json()
      setLocalOrders(prev => prev.map(order =>
        order.id === selectedOrder.id
          ? { ...order, support_messages: [...(order.support_messages ?? []), message] }
          : order
      ))
      setReplyBody('')
    } catch {
      setErrorMsg('Could not send that reply. Try again.')
    } finally {
      setReplying(false)
    }
  }

  async function completeSelfServeOrder() {
    if (!selectedOrder || selectedOrder.service_type !== 'viral_hooks') return
    setCompletingOrder(true)
    setErrorMsg('')
    try {
      const res = await fetch('/api/orders/complete-self-serve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: selectedOrder.id }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Failed to complete order')
      setLocalOrders(prev => prev.map(order =>
        order.id === selectedOrder.id ? { ...order, status: 'approved' } : order
      ))
      setSuccessMsg(data.warning ?? 'Viral Hooks marked complete.')
      setTimeout(() => setSuccessMsg(''), 5000)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not mark this order complete. Try again.')
    } finally {
      setCompletingOrder(false)
    }
  }

  async function regenerateViralHooksOrder() {
    if (!selectedOrder || selectedOrder.service_type !== 'viral_hooks' || !selectedOrder.brief) return
    setRegeneratingOrder(true)
    setErrorMsg('')
    try {
      const res = await fetch('/api/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_type: selectedOrder.service_type,
          title: selectedOrder.title,
          brief: selectedOrder.brief,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Could not regenerate hooks')
      const nextOrder = data.order
        ? {
          ...data.order,
          support_ticket_id: data.supportTicketId ?? null,
          support_ticket_body: data.supportTicketBody ?? null,
          support_messages: data.supportMessages ?? [],
        }
        : null
      if (!nextOrder) throw new Error('Could not regenerate hooks')
      setLocalOrders(prev => [nextOrder, ...prev])
      setSelectedOrderId(nextOrder.id)
      setSuccessMsg('Viral Hooks regenerated. The new output is open now.')
      setTimeout(() => setSuccessMsg(''), 5000)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not regenerate hooks. Try again.')
    } finally {
      setRegeneratingOrder(false)
    }
  }

  async function deleteViralHooksOrder(order: Order) {
    if (order.service_type !== 'viral_hooks') return
    if (!confirm(`Delete ${formatOrderNumber(order)} from Services? The saved PDF in Deliverables will not be deleted.`)) return

    setDeletingOrderId(order.id)
    setErrorMsg('')
    try {
      const res = await fetch('/api/orders/delete-self-serve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: order.id }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Could not delete this Viral Hooks order.')

      setLocalOrders(prev => prev.filter(item => item.id !== order.id))
      if (selectedOrderId === order.id) setSelectedOrderId(null)
      setSuccessMsg('Viral Hooks order removed from Services.')
      setTimeout(() => setSuccessMsg(''), 5000)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not delete this Viral Hooks order. Try again.')
    } finally {
      setDeletingOrderId(null)
    }
  }

  if (selectedOrder) {
    const status = STATUS_CONFIG[selectedOrder.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.submitted
    const service = SERVICES.find(s => s.id === selectedOrder.service_type)
    const ServiceIcon = service?.icon ?? Globe
    const isViralHooksOrder = selectedOrder.service_type === 'viral_hooks'
    const orderGeneratedOutput = extractViralHooksGeneratedOutput(selectedOrder.brief)
    const ticketGeneratedOutput = generatedOutputFromTicketBody(selectedOrder.support_ticket_body)
    const generatedMessages = (selectedOrder.support_messages ?? []).filter(message => message.sender_role !== 'client')
    const generatedAssets = generatedMessages.length > 0
      ? generatedMessages
      : orderGeneratedOutput || ticketGeneratedOutput
        ? [{
          id: `${selectedOrder.id}-generated`,
          sender_role: 'admin',
          body: orderGeneratedOutput || ticketGeneratedOutput,
          created_at: selectedOrder.created_at,
        }]
        : []
    const displayStatus = isViralHooksOrder && generatedAssets.length === 0
      ? { label: 'Needs regenerate', color: 'bg-status-warning/10 text-status-warning', icon: AlertCircle }
      : status
    const DisplayStatusIcon = displayStatus.icon

    return (
      <div className="mx-auto max-w-[1240px] px-4 py-8 sm:px-8">
        <button
          onClick={() => setSelectedOrderId(null)}
          className="mb-8 flex items-center gap-2 text-sm text-text-soft transition-colors hover:text-text"
        >
          <ChevronLeft size={16} />
          Back to orders
        </button>

        {successMsg && (
          <div className="mb-6 flex items-center gap-3 rounded-xl border border-status-success/20 bg-status-success/10 p-4">
            <CheckCircle size={16} className="flex-shrink-0 text-status-success" />
            <p className="text-sm text-status-success">{successMsg}</p>
          </div>
        )}

        {errorMsg && (
          <div className="mb-6 flex items-center gap-3 rounded-xl border border-status-danger/20 bg-status-danger/10 p-4">
            <AlertCircle size={16} className="flex-shrink-0 text-status-danger" />
            <p className="text-sm text-status-danger">{errorMsg}</p>
          </div>
        )}

        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
          <div className="flex items-start justify-between gap-4 border-b border-border p-6">
            <div className="flex items-start gap-4 min-w-0">
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-brand-primary/10">
                <ServiceIcon size={17} className="text-brand-primary" />
              </div>
              <div className="min-w-0">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-text-soft">
                  {isViralHooksOrder ? 'Generated asset' : 'Service conversation'}
                </p>
                <h1 className="text-2xl font-semibold text-text">{selectedOrder.title}</h1>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-text-soft">
                  <span>{formatOrderNumber(selectedOrder)}</span>
                  <span>•</span>
                  <span>Submitted {new Date(selectedOrder.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {selectedOrder.support_ticket_id && !isViralHooksOrder && (
                <Link
                  href={`/dashboard/support?ticket=${encodeURIComponent(selectedOrder.support_ticket_id)}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3 py-1.5 text-xs font-semibold text-text-sec hover:border-brand-primary/40 hover:text-brand-primary transition-colors"
                >
                  <MessageSquare size={11} />
                  Open in Support
                </Link>
              )}
              {isViralHooksOrder && generatedAssets.length > 0 && !CLOSED_STATUSES.includes(selectedOrder.status) && (
                <button
                  type="button"
                  onClick={completeSelfServeOrder}
                  disabled={completingOrder}
                  className="inline-flex items-center gap-1.5 rounded-full bg-brand-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#2563EB] disabled:opacity-50"
                >
                  {completingOrder ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle size={11} />}
                  Mark complete
                </button>
              )}
              {isViralHooksOrder && (
                <button
                  type="button"
                  onClick={() => deleteViralHooksOrder(selectedOrder)}
                  disabled={deletingOrderId === selectedOrder.id}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-full disabled:opacity-50"
                >
                  {deletingOrderId === selectedOrder.id ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                  Delete
                </button>
              )}
              <span className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-full ${displayStatus.color}`}>
                <DisplayStatusIcon size={11} />
                {displayStatus.label}
              </span>
            </div>
          </div>

          {selectedOrder.brief && (
            <div className="border-b border-border bg-surface-2 p-6">
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-text-soft">Original request</p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-text-sec">{displayServiceBrief(selectedOrder.brief)}</p>
            </div>
          )}

          <div className="p-6 space-y-4">
            {isViralHooksOrder ? (
              generatedAssets.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border p-8 text-center">
                  <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-status-warning/10">
                    <AlertCircle size={18} className="text-status-warning" />
                  </div>
                  <p className="text-sm font-semibold text-text">Generated hooks were not saved for this request.</p>
                  <p className="mx-auto mt-2 max-w-lg text-sm text-text-sec">
                    This order was marked delivered before the output was attached. Regenerate it from the original request to create a new saved result.
                  </p>
                  <button
                    type="button"
                    onClick={regenerateViralHooksOrder}
                    disabled={regeneratingOrder}
                    className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#2563EB] disabled:opacity-50"
                  >
                    {regeneratingOrder ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                    {regeneratingOrder ? 'Regenerating...' : 'Regenerate hooks'}
                  </button>
                </div>
              ) : (
                generatedAssets.map(message => (
                  <div key={message.id} className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
                    <div className="flex items-center justify-between gap-3 border-b border-border bg-surface-2 px-5 py-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-widest text-status-success">Maya generated hooks</p>
                        <p className="mt-1 text-xs text-text-soft">Use these as openings for short-form content, captions, or carousel slides.</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => downloadGeneratedPdf(
                            selectedOrder.title,
                            `${formatOrderNumber(selectedOrder)} · Generated ${new Date(selectedOrder.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
                            displayServiceBrief(message.body)
                          )}
                          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-text-sec transition-colors hover:border-gray-200 hover:text-text"
                        >
                          <Download size={12} />
                          PDF
                        </button>
                        <Sparkles size={16} className="text-status-success" />
                      </div>
                    </div>
                    <div className="p-5">
                      <ViralHooksOutputView content={message.body} />
                    </div>
                  </div>
                ))
              )
            ) : (selectedOrder.support_messages ?? []).length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-200 p-8 text-center">
                <p className="text-sm text-gray-400">No conversation messages yet.</p>
              </div>
            ) : (
              selectedOrder.support_messages?.map(message => (
                <div
                  key={message.id}
                  className={`flex ${message.sender_role === 'client' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[80%] rounded-2xl px-5 py-4 ${
                    message.sender_role === 'client'
                      ? 'bg-brand-secondary text-white rounded-br-none'
                      : 'border border-border bg-surface-2 text-text rounded-bl-none'
                  }`}>
                    <p className={`text-xs font-semibold mb-2 ${message.sender_role === 'client' ? 'text-white/75' : 'text-brand-primary'}`}>
                      {message.sender_role === 'client' ? 'You' : 'Agent7even Services'}
                    </p>
                    <p className={`whitespace-pre-wrap text-sm leading-relaxed ${message.sender_role === 'client' ? 'text-white' : 'text-text-sec'}`}>
                      {displayServiceBrief(message.body)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="border-t border-gray-100 bg-white p-4">
            {selectedOrder.support_ticket_id && !isViralHooksOrder ? (
              <div>
                <textarea
                  value={replyBody}
                  onChange={e => setReplyBody(e.target.value)}
                  placeholder="Write a follow-up message about this service request..."
                  rows={4}
                  className="w-full resize-none rounded-xl border border-border px-4 py-3 text-sm text-text placeholder:text-text-soft focus:outline-none focus:border-brand-primary/50"
                />
                <div className="flex justify-end mt-3">
                  <button
                    onClick={handleServiceReply}
                    disabled={!replyBody.trim() || replying}
                    className="flex items-center gap-2 rounded-xl bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#2563EB] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {replying ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    {replying ? 'Sending...' : 'Send message'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-3">
                <p className="text-sm text-amber-700">
                  {isViralHooksOrder
                    ? 'This is a self-serve service. The PDF is saved to Deliverables when hooks are generated. Mark complete when you are done reviewing.'
                    : 'This older order does not have a service conversation attached yet.'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[1240px] px-4 py-8 sm:px-8">

      <section className="mb-6 overflow-hidden rounded-2xl border border-gray-100 bg-white">
        <div className="flex flex-col gap-6 p-7 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-brand-primary">Services</p>
            <h1 className="text-[30px] font-semibold tracking-tight text-text">Marketing services</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-text-sec">
              Request human-delivered work from our team — design, photography, ad management, and more.
              Self-serve tools like Viral Hooks run here too. Service requests use your plan slots, not media credits.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:flex">
            <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-text-soft">Active</p>
              <p className="mt-1 text-2xl font-semibold text-text">{activeOrders.length}</p>
            </div>
            <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-text-soft">Saved</p>
              <p className="mt-1 text-2xl font-semibold text-text">{localOrders.length}</p>
            </div>
          </div>
        </div>
        {localOrders.length > 0 && (
          <div className="border-t border-border bg-surface-2 px-7 py-4">
          <div className="flex w-fit items-center gap-1 rounded-xl border border-gray-100 bg-white p-1">
            {(['browse', 'orders'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`rounded-lg px-4 py-2 text-sm font-semibold capitalize transition-all ${
                  activeTab === tab
                    ? 'bg-brand-primary text-white shadow-sm'
                    : 'text-text-sec hover:text-text'
                }`}
              >
                {tab === 'orders' ? `Orders${localOrders.length > 0 ? ` (${activeOrders.length})` : ''}` : 'Browse'}
              </button>
            ))}
          </div>
          </div>
        )}
      </section>

      <div className="mb-6">
        <PlanUsageCallout
          plan={profile?.plan ?? null}
          creditBalance={creditBalance}
          activeServiceRequests={activeOrders.length}
          compact
        />
      </div>

      {/* Success message */}
      {successMsg && (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-status-success/20 bg-status-success/10 p-4">
          <CheckCircle size={16} className="flex-shrink-0 text-status-success" />
          <p className="text-sm text-status-success">{successMsg}</p>
        </div>
      )}

      {errorMsg && (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-status-danger/20 bg-status-danger/10 p-4">
          <AlertCircle size={16} className="flex-shrink-0 text-status-danger" />
          <p className="text-sm text-status-danger">{errorMsg}</p>
        </div>
      )}

      {activeTab === 'orders' && activeOrders.length > 0 && (
        <p className="mb-4 text-xs leading-relaxed text-text-sec">
          Human-delivered work from our team — not metered by media credits. Status updates appear here and in your order conversation.
        </p>
      )}

      {/* Browse tab */}
      {activeTab === 'browse' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {SERVICES.map(service => {
            const Icon = service.icon
            const serviceOrders = localOrders.filter(o => o.service_type === service.id)
            const activeServiceOrders = serviceOrders.filter(o => !CLOSED_STATUSES.includes(o.status))
            const isViralHooks = service.id === 'viral_hooks'
            return (
              <div
                key={service.id}
                className="rounded-2xl border border-gray-100 bg-white p-5 transition-all hover:border-brand-primary/40 hover:bg-surface-2"
              >
                <div className="flex items-start justify-between mb-4 gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-brand-primary/10">
                      <Icon size={16} className="text-brand-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold leading-snug text-text">{service.name}</p>
                      <p className="text-xs font-medium text-text-sec">{service.price}</p>
                    </div>
                  </div>
                  <span className={`flex-shrink-0 text-[10px] font-semibold uppercase tracking-widest px-2 py-1 rounded-full ${
                    service.type === 'free'
                      ? 'bg-status-success/10 text-status-success'
                      : service.type === 'retainer'
                        ? 'bg-brand-accent/10 text-brand-accent'
                        : 'bg-brand-primary/10 text-brand-primary'
                  }`}>
                    {service.type === 'free' ? 'Free' : service.type === 'retainer' ? 'Monthly' : 'One-time'}
                  </span>
                </div>
                <p className="mb-4 text-xs leading-relaxed text-text-sec">{service.desc}</p>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-text-soft">
                    {activeServiceOrders.length > 0
                      ? `${activeServiceOrders.length} active`
                      : service.deliveryDays ? `~${service.deliveryDays} day delivery` : 'Custom timeline'}
                  </span>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {serviceOrders.length > 0 && (
                      <button
                        onClick={() => setActiveTab('orders')}
                        className="flex items-center gap-1.5 text-xs font-semibold text-brand-primary transition-colors hover:text-[#2563EB]"
                      >
                        {isViralHooks ? 'View generated hooks' : `View order${serviceOrders.length === 1 ? '' : 's'}`} <ArrowRight size={11} />
                      </button>
                    )}
                    {service.requiresScope ? (
                      <button
                        onClick={() => router.push('/dashboard/services/inquiry')}
                        className="flex items-center gap-1.5 text-xs font-semibold text-text-sec transition-colors hover:text-brand-primary"
                      >
                        <ArrowRight size={12} /> Get a quote
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setErrorMsg('')
                          setRequestingService(service)
                        }}
                        className="flex items-center gap-1.5 text-xs font-semibold text-text-sec transition-colors hover:text-brand-primary"
                      >
                        <Plus size={12} /> {isViralHooks ? 'Generate' : 'Request'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Orders tab */}
      {activeTab === 'orders' && (
        <div className="space-y-4">
          {localOrders.length === 0 ? (
            <div className="rounded-2xl border border-gray-100 bg-white p-12 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-primary/10">
                <ShoppingBag size={20} className="text-brand-primary" />
              </div>
              <p className="mb-1 text-sm font-semibold text-text">No orders yet</p>
              <p className="mb-4 text-xs text-text-soft">Request a service to get started.</p>
              <button
                onClick={() => setActiveTab('browse')}
                className="text-sm font-semibold text-brand-primary transition-colors hover:text-[#2563EB]"
              >
                Browse services →
              </button>
            </div>
          ) : (
            <>
              {activeOrders.length > 0 && (
                <div>
                  <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-text-soft">Active</p>
                  {activeOrders.map(order => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      deleting={deletingOrderId === order.id}
                      onOpenConversation={() => setSelectedOrderId(order.id)}
                      onDelete={() => deleteViralHooksOrder(order)}
                    />
                  ))}
                </div>
              )}
              {completedOrders.length > 0 && (
                <div>
                  <p className="mb-3 mt-6 text-xs font-semibold uppercase tracking-widest text-text-soft">Completed</p>
                  {completedOrders.map(order => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      deleting={deletingOrderId === order.id}
                      onOpenConversation={() => setSelectedOrderId(order.id)}
                      onDelete={() => deleteViralHooksOrder(order)}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Request modal */}
      {requestingService && (
        requestingService.id === 'viral_hooks' ? (
          <ViralHooksGeneratorModal
            service={requestingService}
            error={errorMsg}
            initialValues={viralHooksPrefill}
            onClose={() => {
              setRequestingService(null)
              setViralHooksPrefill(null)
            }}
            onSubmit={handleRequest}
          />
        ) : (
          <RequestModal
            service={requestingService}
            error={errorMsg}
            onClose={() => setRequestingService(null)}
            onSubmit={handleRequest}
          />
        )
      )}
    </div>
  )
}

function ShoppingBag({ size, className }: { size: number; className: string }) {
  return (
    <svg width={size} height={size} className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
      <line x1="3" y1="6" x2="21" y2="6"/>
      <path d="M16 10a4 4 0 01-8 0"/>
    </svg>
  )
}

function OrderCard({
  order,
  deleting,
  onOpenConversation,
  onDelete,
}: {
  order: Order
  deleting: boolean
  onOpenConversation: () => void
  onDelete: () => void
}) {
  const status = STATUS_CONFIG[order.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.submitted
  const service = SERVICES.find(s => s.id === order.service_type)
  const ServiceIcon = service?.icon ?? Globe
  const isViralHooks = order.service_type === 'viral_hooks'
  const hasGeneratedOutput = !isViralHooks
    || (order.support_messages ?? []).some(message => message.sender_role !== 'client' && message.body?.trim())
    || Boolean(extractViralHooksGeneratedOutput(order.brief))
    || Boolean(generatedOutputFromTicketBody(order.support_ticket_body))
  const displayStatus = isViralHooks && !hasGeneratedOutput
    ? { label: 'Needs regenerate', color: 'bg-status-warning/10 text-status-warning', icon: AlertCircle }
    : status
  const StatusIcon = displayStatus.icon
  const statusKey = isViralHooks && !hasGeneratedOutput ? 'needs_regenerate' : order.status
  const statusHint = statusKey === 'needs_regenerate'
    ? 'Run Viral Hooks again to generate a fresh set of hooks.'
    : STATUS_HINT[order.status]

  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-gray-100 bg-white p-4 transition-all hover:border-brand-primary/30 hover:bg-surface-2 sm:p-5">
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-brand-primary/10">
          <ServiceIcon size={16} className="text-brand-primary" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-text">{order.title}</p>
          <p className="mt-0.5 text-xs text-text-soft">
            {formatOrderNumber(order)} · Submitted {new Date(order.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
          {order.brief && (
            <p className="mt-1 line-clamp-2 text-xs text-text-sec">{displayServiceBrief(order.brief)}</p>
          )}
          {statusHint && (
            <p className="mt-1 text-[11px] leading-snug text-text-muted">{statusHint}</p>
          )}
          <button
            type="button"
            onClick={onOpenConversation}
            className="mt-2 inline-flex text-xs font-semibold text-brand-primary hover:text-[#2563EB]"
          >
            {isViralHooks ? 'Open generated hooks' : 'Open follow-up conversation'}
          </button>
          {order.support_ticket_id && !isViralHooks && (
            <Link
              href={`/dashboard/support?ticket=${encodeURIComponent(order.support_ticket_id)}`}
              className="mt-1 block text-[11px] font-medium text-text-soft hover:text-brand-primary"
            >
              View support ticket →
            </Link>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-full ${displayStatus.color}`}>
          <StatusIcon size={11} />
          <span className="hidden sm:inline">{displayStatus.label}</span>
        </span>
        {isViralHooks && (
          <button
            type="button"
            onClick={onDelete}
            disabled={deleting}
            title="Delete Viral Hooks order"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-text-soft transition-colors hover:bg-status-danger/10 hover:text-status-danger disabled:opacity-50"
          >
            {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
          </button>
        )}
        <ChevronRight size={14} className="text-text-soft" />
      </div>
    </div>
  )
}
