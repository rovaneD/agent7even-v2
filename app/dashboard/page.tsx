import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import Link from 'next/link'
import {
  Zap,
  ShoppingBag,
  BarChart2,
  ArrowRight,
  Clock,
  FileText,
  CheckCircle,
} from 'lucide-react'
import PlanBanner from './PlanBanner'

export default async function DashboardPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const supabase = createServiceClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('clerk_user_id', userId)
    .single()

  if (['owner', 'admin'].includes(profile?.role)) {
    redirect('/admin')
  }

  if (!profile?.onboarding_complete) {
    redirect('/onboarding')
  }

  if (!profile?.foundation_complete) {
    redirect('/foundation')
  }

  const displayName = profile?.company_name || profile?.full_name || 'there'
  const hasPlan = !!profile?.plan

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-8 max-w-5xl">
      <div className="mb-8">
        <p className="text-[10px] font-semibold tracking-widest uppercase text-[#c8522a] mb-2">Dashboard</p>
        <h1 className="text-2xl font-bold text-gray-900">Welcome back, {displayName}.</h1>
        <p className="text-gray-500 text-sm mt-1">Here&apos;s what&apos;s happening with your business.</p>
      </div>

      {!hasPlan && (
        <div className="bg-[#0d0d0d] rounded-2xl p-5 mb-6 flex flex-col sm:flex-row sm:items-center gap-4">
          <div>
            <p className="text-white font-semibold text-sm mb-1">You don&apos;t have an active plan yet</p>
            <p className="text-gray-500 text-xs">Choose a plan to unlock your full workspace.</p>
          </div>
          <Link href="/pricing" className="sm:ml-auto flex-shrink-0 bg-[#c8522a] text-white text-sm font-medium px-5 py-2.5 rounded-xl hover:bg-[#b04623] transition-colors flex items-center gap-2 w-fit">
            Choose a plan <ArrowRight size={14} />
          </Link>
        </div>
      )}

      {hasPlan && <PlanBanner plan={profile.plan} />}

      {/* Maya entry point */}
      <Link
        href="/maya"
        className="block mb-6 rounded-2xl border border-gray-100 bg-white p-5 hover:border-gray-300 transition-colors group"
      >
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-[#0a0a0a] flex items-center justify-center flex-shrink-0">
            <span className="text-white text-lg font-semibold">M</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 mb-0.5">Talk to Maya</p>
            <p className="text-xs text-gray-400 leading-relaxed">Your AI marketing strategist — get a plan, create content, and act on it, all in one place.</p>
          </div>
          <div className="flex-shrink-0 flex items-center gap-1 text-xs font-medium text-gray-400 group-hover:text-[#0a0a0a] transition-colors">
            Open <ArrowRight size={12} />
          </div>
        </div>
      </Link>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Hours reclaimed', value: '—', sub: 'This month', icon: Clock, color: 'text-[#c8522a]', bg: 'bg-[#c8522a]/8' },
          { label: 'Content produced', value: '—', sub: 'Total pieces', icon: FileText, color: 'text-blue-500', bg: 'bg-blue-50' },
          { label: 'Active services', value: '—', sub: 'Running now', icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-50' },
        ].map((card) => (
          <div key={card.label} className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className={`w-8 h-8 rounded-lg ${card.bg} flex items-center justify-center mb-4`}>
              <card.icon size={15} className={card.color} />
            </div>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-widest mb-2">{card.label}</p>
            <p className={`text-3xl font-bold ${card.color} mb-1`}>{card.value}</p>
            <p className="text-xs text-gray-400">{card.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { href: '/dashboard/services', icon: ShoppingBag, label: 'Services', desc: 'Request and track your marketing services', cta: 'View services' },
          { href: '/dashboard/ai-toolkit', icon: Zap, label: 'AI Toolkit', desc: 'Generate content, captions, emails, and more', cta: 'Open toolkit' },
          { href: '/dashboard/analytics', icon: BarChart2, label: 'Analytics', desc: 'Connect your accounts and track performance', cta: 'View analytics' },
        ].map((card) => (
          <Link key={card.href} href={card.href} className="bg-white rounded-2xl border border-gray-100 p-5 hover:border-gray-200 hover:shadow-sm transition-all group">
            <div className="w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center mb-4 group-hover:bg-[#c8522a]/8 transition-colors">
              <card.icon size={16} className="text-gray-400 group-hover:text-[#c8522a] transition-colors" />
            </div>
            <p className="text-sm font-semibold text-gray-900 mb-1">{card.label}</p>
            <p className="text-xs text-gray-400 leading-relaxed mb-4">{card.desc}</p>
            <span className="text-xs font-medium text-[#c8522a] flex items-center gap-1">{card.cta} <ArrowRight size={11} /></span>
          </Link>
        ))}
      </div>
    </div>
  )
}
