'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Globe, Hash, Camera, Mail, Search,
  Brush, Video, Megaphone, Plus, X, ChevronRight,
  Clock, CheckCircle, AlertCircle, Loader2, ArrowRight, Code2, ChevronLeft, Send, Flame
} from 'lucide-react'
import { formatOrderNumber } from '@/lib/orders/formatOrderNumber'
import { displayServiceBrief, VIRAL_HOOKS_FRAMEWORK } from '@/lib/services/viralHooks'

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
  submitted: { label: 'Submitted', color: 'bg-blue-50 text-blue-600', icon: Clock },
  in_review: { label: 'In Review', color: 'bg-yellow-50 text-yellow-600', icon: Loader2 },
  in_progress: { label: 'In Progress', color: 'bg-purple-50 text-purple-600', icon: Loader2 },
  delivered: { label: 'Delivered', color: 'bg-green-50 text-green-600', icon: CheckCircle },
  completed: { label: 'Completed', color: 'bg-green-50 text-green-600', icon: CheckCircle },
  revision_requested: { label: 'Revision Requested', color: 'bg-orange-50 text-orange-600', icon: AlertCircle },
  approved: { label: 'Approved', color: 'bg-green-50 text-green-600', icon: CheckCircle },
  cancelled: { label: 'Cancelled', color: 'bg-gray-50 text-gray-400', icon: X },
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
  support_messages?: Message[]
}

interface Profile {
  id: string
  plan?: string
}

interface RequestModalProps {
  service: typeof SERVICES[0]
  error?: string
  onClose: () => void
  onSubmit: (brief: string) => Promise<void>
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

  const isViralHooks = service.id === 'viral_hooks'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl w-full max-w-lg shadow-2xl">

        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#2D3748]/8 flex items-center justify-center">
              <Icon size={18} className="text-[#64748B]" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900">{service.name}</h2>
              <p className="text-xs text-gray-400">{service.price}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">
            {isViralHooks ? 'Tell us what the hooks are for' : 'Tell us about your project'}
          </label>
          <textarea
            value={brief}
            onChange={e => setBrief(e.target.value)}
            placeholder={isViralHooks
              ? 'Example: I need hooks for Instagram Reels promoting Maya to small business owners who are tired of agencies, complex tools, and inconsistent marketing. Goal: book trials or demos.'
              : `Describe what you need for ${service.name.toLowerCase()}. Include any relevant details about your business, goals, timeline preferences, and any existing assets we should know about.`}
            rows={5}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 placeholder:text-gray-300 outline-none focus:border-[#3B82F6]/40 resize-none transition-colors"
          />
          <p className="text-xs text-gray-400 mt-2">
            {isViralHooks
              ? 'Maya will use the saved brand context plus viral hook frameworks to shape the output.'
              : 'Our team will review and respond within 1 business day.'}
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
            className="flex items-center gap-2 bg-[#2D3748] text-white text-[15px] font-medium px-6 py-2.5 rounded-xl hover:bg-[#1E293B] disabled:opacity-40 transition-colors"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : null}
            {isViralHooks ? 'Request hooks' : 'Submit request'}
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
}: {
  profile: Profile | null
  orders: Order[]
  initialOrderId?: string | null
}) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'browse' | 'orders'>('browse')
  const [localOrders, setLocalOrders] = useState<Order[]>(orders)
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(initialOrderId ?? null)

  useEffect(() => {
    const activeOrders = localOrders.filter(o => !CLOSED_STATUSES.includes(o.status))
    const activeOrderLines = activeOrders.length
      ? activeOrders.map(o => `- ${o.title} (status: ${o.status})`).join('\n')
      : '- No active orders'
    const serviceLines = SERVICES.map(s => `- ${s.name}: ${s.price} (${s.type})`).join('\n')
    const context = `SERVICES PAGE
Plan: ${profile?.plan ?? 'none'}
Active orders (${activeOrders.length}):
${activeOrderLines}
Available services:
${serviceLines}
The user can request new marketing services or track existing orders.`
    window.dispatchEvent(new CustomEvent('maya:canvas-context', { detail: { context } }))
  }, [localOrders, profile?.plan])
  const [requestingService, setRequestingService] = useState<typeof SERVICES[0] | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [replyBody, setReplyBody] = useState('')
  const [replying, setReplying] = useState(false)
  const [completingOrder, setCompletingOrder] = useState(false)

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
          ? { ...data.order, support_ticket_id: data.supportTicketId ?? null, support_messages: data.supportMessages ?? [] }
          : null
        setRequestingService(null)
        if (nextOrder) setLocalOrders(prev => [nextOrder, ...prev])
        if (nextOrder) setSelectedOrderId(nextOrder.id)
        setSuccessMsg(`Your ${requestingService.name} request has been submitted. A follow-up conversation is open here in Services.`)
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
      if (!res.ok) throw new Error('Failed to complete order')
      setLocalOrders(prev => prev.map(order =>
        order.id === selectedOrder.id ? { ...order, status: 'approved' } : order
      ))
    } catch {
      setErrorMsg('Could not mark this order complete. Try again.')
    } finally {
      setCompletingOrder(false)
    }
  }

  if (selectedOrder) {
    const status = STATUS_CONFIG[selectedOrder.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.submitted
    const StatusIcon = status.icon
    const service = SERVICES.find(s => s.id === selectedOrder.service_type)
    const ServiceIcon = service?.icon ?? Globe

    return (
      <div className="px-8 pt-8 pb-6 max-w-[1200px]">
        <button
          onClick={() => setSelectedOrderId(null)}
          className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-700 mb-8 transition-colors"
        >
          <ChevronLeft size={16} />
          Back to orders
        </button>

        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex items-start justify-between gap-4">
            <div className="flex items-start gap-4 min-w-0">
              <div className="w-11 h-11 rounded-xl bg-gray-50 flex items-center justify-center flex-shrink-0">
                <ServiceIcon size={17} className="text-gray-500" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold tracking-widest uppercase text-[#94A3B8] mb-1">Service conversation</p>
                <h1 className="text-2xl font-bold text-gray-900">{selectedOrder.title}</h1>
                <p className="text-sm text-gray-400 mt-1 flex flex-wrap items-center gap-2">
                  <span>{formatOrderNumber(selectedOrder)}</span>
                  <span>•</span>
                  <span>Submitted {new Date(selectedOrder.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {selectedOrder.service_type === 'viral_hooks' && !CLOSED_STATUSES.includes(selectedOrder.status) && (
                <button
                  type="button"
                  onClick={completeSelfServeOrder}
                  disabled={completingOrder}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-[#2D3748] hover:bg-[#1E293B] px-3 py-1.5 rounded-full disabled:opacity-50"
                >
                  {completingOrder ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle size={11} />}
                  Mark complete
                </button>
              )}
              <span className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-full ${status.color}`}>
                <StatusIcon size={11} />
                {status.label}
              </span>
            </div>
          </div>

          {selectedOrder.brief && (
            <div className="p-6 border-b border-gray-100 bg-gray-50/50">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Original request</p>
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{displayServiceBrief(selectedOrder.brief)}</p>
            </div>
          )}

          <div className="p-6 space-y-4">
            {(selectedOrder.support_messages ?? []).length === 0 ? (
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
                      ? 'bg-[#2D3748] text-white rounded-br-none'
                      : 'bg-gray-50 border border-gray-100 text-gray-800 rounded-bl-none'
                  }`}>
                    <p className={`text-xs font-semibold mb-2 ${message.sender_role === 'client' ? 'text-white/75' : 'text-[#3B82F6]'}`}>
                      {message.sender_role === 'client' ? 'You' : 'Agent7even Services'}
                    </p>
                    <p className={`text-sm leading-relaxed whitespace-pre-wrap ${message.sender_role === 'client' ? 'text-white' : 'text-gray-700'}`}>
                      {displayServiceBrief(message.body)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="p-4 border-t border-gray-100 bg-white">
            {selectedOrder.support_ticket_id && selectedOrder.service_type !== 'viral_hooks' ? (
              <div>
                <textarea
                  value={replyBody}
                  onChange={e => setReplyBody(e.target.value)}
                  placeholder="Write a follow-up message about this service request..."
                  rows={4}
                  className="w-full text-sm text-gray-800 placeholder:text-gray-300 resize-none focus:outline-none border border-gray-100 rounded-xl px-4 py-3"
                />
                <div className="flex justify-end mt-3">
                  <button
                    onClick={handleServiceReply}
                    disabled={!replyBody.trim() || replying}
                    className="flex items-center gap-2 text-sm font-semibold text-white bg-[#2D3748] hover:bg-[#1E293B] px-5 py-2.5 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {replying ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    {replying ? 'Sending...' : 'Send message'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-3">
                <p className="text-sm text-amber-700">
                  {selectedOrder.service_type === 'viral_hooks'
                    ? 'This is a self-serve service. Review the generated hooks above and mark complete when you are done.'
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
    <div className="px-8 pt-8 pb-6 max-w-[1200px]">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <p className="text-[11px] font-semibold tracking-widest uppercase text-[#94A3B8] mb-2">Services</p>
          <h1 className="text-2xl font-bold text-gray-900">Marketing services</h1>
          <p className="text-gray-500 text-sm mt-1">Request a service or track your active orders.</p>
        </div>
        {localOrders.length > 0 && (
          <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 w-fit">
            {(['browse', 'orders'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize ${
                  activeTab === tab
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab === 'orders' ? `Orders${localOrders.length > 0 ? ` (${activeOrders.length})` : ''}` : 'Browse'}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Success message */}
      {successMsg && (
        <div className="bg-green-50 border border-green-100 rounded-xl p-4 mb-6 flex items-center gap-3">
          <CheckCircle size={16} className="text-green-500 flex-shrink-0" />
          <p className="text-sm text-green-700">{successMsg}</p>
        </div>
      )}

      {errorMsg && (
        <div className="bg-red-50 border border-red-100 rounded-xl p-4 mb-6 flex items-center gap-3">
          <AlertCircle size={16} className="text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700">{errorMsg}</p>
        </div>
      )}

      {/* Browse tab */}
      {activeTab === 'browse' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {SERVICES.map(service => {
            const Icon = service.icon
            const serviceOrders = localOrders.filter(o => o.service_type === service.id)
            const activeServiceOrders = serviceOrders.filter(o => !CLOSED_STATUSES.includes(o.status))
            return (
              <div
                key={service.id}
                className="bg-white rounded-2xl border border-gray-100 p-5 hover:border-gray-200 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between mb-4 gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center flex-shrink-0">
                      <Icon size={16} className="text-gray-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 leading-snug">{service.name}</p>
                      <p className="text-xs text-[#64748B] font-medium">{service.price}</p>
                    </div>
                  </div>
                  <span className={`flex-shrink-0 text-[10px] font-semibold uppercase tracking-widest px-2 py-1 rounded-full ${
                    service.type === 'free'
                      ? 'bg-green-50 text-green-600'
                      : service.type === 'retainer'
                        ? 'bg-purple-50 text-purple-500'
                        : 'bg-blue-50 text-blue-500'
                  }`}>
                    {service.type === 'free' ? 'Free' : service.type === 'retainer' ? 'Monthly' : 'One-time'}
                  </span>
                </div>
                <p className="text-xs text-gray-400 leading-relaxed mb-4">{service.desc}</p>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-gray-400">
                    {activeServiceOrders.length > 0
                      ? `${activeServiceOrders.length} active`
                      : service.deliveryDays ? `~${service.deliveryDays} day delivery` : 'Custom timeline'}
                  </span>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {serviceOrders.length > 0 && (
                      <button
                        onClick={() => setActiveTab('orders')}
                        className="flex items-center gap-1.5 text-xs font-medium text-purple-600 hover:text-purple-800 transition-colors"
                      >
                        View order{serviceOrders.length === 1 ? '' : 's'} <ArrowRight size={11} />
                      </button>
                    )}
                    {service.requiresScope ? (
                      <button
                        onClick={() => router.push('/dashboard/services/inquiry')}
                        className="flex items-center gap-1.5 text-xs font-medium text-[#64748B] hover:text-[#b04623] transition-colors"
                      >
                        <ArrowRight size={12} /> Get a quote
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setErrorMsg('')
                          setRequestingService(service)
                        }}
                        className="flex items-center gap-1.5 text-xs font-medium text-[#64748B] hover:text-[#b04623] transition-colors"
                      >
                        <Plus size={12} /> Request
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
            <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
              <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4">
                <ShoppingBag size={20} className="text-gray-300" />
              </div>
              <p className="text-sm font-medium text-gray-500 mb-1">No orders yet</p>
              <p className="text-xs text-gray-400 mb-4">Request a service to get started.</p>
              <button
                onClick={() => setActiveTab('browse')}
                className="text-sm font-medium text-[#64748B] hover:text-[#b04623] transition-colors"
              >
                Browse services →
              </button>
            </div>
          ) : (
            <>
              {activeOrders.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Active</p>
                  {activeOrders.map(order => <OrderCard key={order.id} order={order} onOpenConversation={() => setSelectedOrderId(order.id)} />)}
                </div>
              )}
              {completedOrders.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3 mt-6">Completed</p>
                  {completedOrders.map(order => <OrderCard key={order.id} order={order} onOpenConversation={() => setSelectedOrderId(order.id)} />)}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Request modal */}
      {requestingService && (
        <RequestModal
          service={requestingService}
          error={errorMsg}
          onClose={() => setRequestingService(null)}
          onSubmit={handleRequest}
        />
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

function OrderCard({ order, onOpenConversation }: { order: Order; onOpenConversation: () => void }) {
  const status = STATUS_CONFIG[order.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.submitted
  const StatusIcon = status.icon
  const service = SERVICES.find(s => s.id === order.service_type)
  const ServiceIcon = service?.icon ?? Globe

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-5 flex items-center justify-between gap-3 hover:border-gray-200 transition-all">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center flex-shrink-0">
          <ServiceIcon size={16} className="text-gray-400" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{order.title}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {formatOrderNumber(order)} · Submitted {new Date(order.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
          {order.brief && (
            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{displayServiceBrief(order.brief)}</p>
          )}
          <button
            type="button"
            onClick={onOpenConversation}
            className="inline-flex text-xs font-medium text-[#3B82F6] hover:text-[#1D4ED8] mt-2"
          >
            Open follow-up conversation
          </button>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-full ${status.color}`}>
          <StatusIcon size={11} />
          <span className="hidden sm:inline">{status.label}</span>
        </span>
        <ChevronRight size={14} className="text-gray-300" />
      </div>
    </div>
  )
}
