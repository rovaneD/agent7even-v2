'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Globe, Hash, Camera, Mail, Search,
  Brush, Video, Megaphone, Plus, X, ChevronRight,
  Clock, CheckCircle, AlertCircle, Loader2, ArrowRight, Code2
} from 'lucide-react'

const SERVICES = [
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
  revision_requested: { label: 'Revision Requested', color: 'bg-orange-50 text-orange-600', icon: AlertCircle },
  approved: { label: 'Approved', color: 'bg-green-50 text-green-600', icon: CheckCircle },
  cancelled: { label: 'Cancelled', color: 'bg-gray-50 text-gray-400', icon: X },
}

interface Order {
  id: string
  service_type: string
  title: string
  status: string
  created_at: string
  due_date?: string
}

interface Profile {
  id: string
  plan?: string
}

interface RequestModalProps {
  service: typeof SERVICES[0]
  onClose: () => void
  onSubmit: (brief: string) => Promise<void>
}

function RequestModal({ service, onClose, onSubmit }: RequestModalProps) {
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
      <div className="relative bg-white rounded-2xl w-full max-w-lg shadow-2xl">

        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#c8522a]/8 flex items-center justify-center">
              <Icon size={18} className="text-[#c8522a]" />
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
            Tell us about your project
          </label>
          <textarea
            value={brief}
            onChange={e => setBrief(e.target.value)}
            placeholder={`Describe what you need for ${service.name.toLowerCase()}. Include any relevant details about your business, goals, timeline preferences, and any existing assets we should know about.`}
            rows={5}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 placeholder:text-gray-300 outline-none focus:border-[#c8522a]/40 resize-none transition-colors"
          />
          <p className="text-xs text-gray-400 mt-2">
            Our team will review and respond within 1 business day.
          </p>
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
            className="flex items-center gap-2 bg-[#c8522a] text-white text-sm font-medium px-6 py-2.5 rounded-xl hover:bg-[#b04623] disabled:opacity-40 transition-colors"
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
}: {
  profile: Profile | null
  orders: Order[]
}) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'browse' | 'orders'>('browse')

  useEffect(() => {
    const activeOrders = orders.filter(o => !['approved', 'cancelled'].includes(o.status))
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
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const [requestingService, setRequestingService] = useState<typeof SERVICES[0] | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')

  const handleRequest = async (brief: string) => {
    if (!requestingService || !profile) return
    setSubmitting(true)

    try {
      const res = await fetch('/api/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_type: requestingService.id,
          title: requestingService.name,
          brief,
        }),
      })

      if (res.ok) {
        setRequestingService(null)
        setSuccessMsg(`Your ${requestingService.name} request has been submitted. We'll be in touch within 1 business day.`)
        setActiveTab('orders')
        setTimeout(() => setSuccessMsg(''), 5000)
        window.location.reload()
      }
    } finally {
      setSubmitting(false)
    }
  }

  const activeOrders = orders.filter(o => !['approved', 'cancelled'].includes(o.status))
  const completedOrders = orders.filter(o => ['approved', 'cancelled'].includes(o.status))

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-8 max-w-5xl">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <p className="text-[10px] font-semibold tracking-widest uppercase text-[#c8522a] mb-2">Services</p>
          <h1 className="text-2xl font-bold text-gray-900">Marketing services</h1>
          <p className="text-gray-500 text-sm mt-1">Request a service or track your active orders.</p>
        </div>
        {orders.length > 0 && (
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
                {tab === 'orders' ? `Orders${orders.length > 0 ? ` (${activeOrders.length})` : ''}` : 'Browse'}
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

      {/* Browse tab */}
      {activeTab === 'browse' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {SERVICES.map(service => {
            const Icon = service.icon
            const hasActiveOrder = orders.some(
              o => o.service_type === service.id && !['approved', 'cancelled'].includes(o.status)
            )
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
                      <p className="text-xs text-[#c8522a] font-medium">{service.price}</p>
                    </div>
                  </div>
                  <span className={`flex-shrink-0 text-[10px] font-semibold uppercase tracking-widest px-2 py-1 rounded-full ${
                    service.type === 'retainer'
                      ? 'bg-purple-50 text-purple-500'
                      : 'bg-blue-50 text-blue-500'
                  }`}>
                    {service.type === 'retainer' ? 'Monthly' : 'One-time'}
                  </span>
                </div>
                <p className="text-xs text-gray-400 leading-relaxed mb-4">{service.desc}</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">
                    {service.deliveryDays ? `~${service.deliveryDays} day delivery` : 'Custom timeline'}
                  </span>
                  {hasActiveOrder ? (
                    <button
                      onClick={() => setActiveTab('orders')}
                      className="flex items-center gap-1.5 text-xs font-medium text-purple-600 hover:text-purple-800 transition-colors"
                    >
                      View order <ArrowRight size={11} />
                    </button>
                  ) : service.requiresScope ? (
                    <button
                      onClick={() => router.push('/dashboard/services/inquiry')}
                      className="flex items-center gap-1.5 text-xs font-medium text-[#c8522a] hover:text-[#b04623] transition-colors"
                    >
                      <ArrowRight size={12} /> Get a quote
                    </button>
                  ) : (
                    <button
                      onClick={() => setRequestingService(service)}
                      className="flex items-center gap-1.5 text-xs font-medium text-[#c8522a] hover:text-[#b04623] transition-colors"
                    >
                      <Plus size={12} /> Request
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Orders tab */}
      {activeTab === 'orders' && (
        <div className="space-y-4">
          {orders.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
              <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4">
                <ShoppingBag size={20} className="text-gray-300" />
              </div>
              <p className="text-sm font-medium text-gray-500 mb-1">No orders yet</p>
              <p className="text-xs text-gray-400 mb-4">Request a service to get started.</p>
              <button
                onClick={() => setActiveTab('browse')}
                className="text-sm font-medium text-[#c8522a] hover:text-[#b04623] transition-colors"
              >
                Browse services →
              </button>
            </div>
          ) : (
            <>
              {activeOrders.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Active</p>
                  {activeOrders.map(order => <OrderCard key={order.id} order={order} />)}
                </div>
              )}
              {completedOrders.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3 mt-6">Completed</p>
                  {completedOrders.map(order => <OrderCard key={order.id} order={order} />)}
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

function OrderCard({ order }: { order: Order }) {
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
            Submitted {new Date(order.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
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
