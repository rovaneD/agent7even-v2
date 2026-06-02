import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { CalendarDays, Hash, Mail, Megaphone, MousePointer, Plus } from 'lucide-react'
import { createServiceClient } from '@/lib/supabase/server'
import CanvasContextDispatcher from '@/components/maya/CanvasContextDispatcher'
import CalendarMayaButton from './CalendarMayaButton'

type DayItem = {
  day?: string
  channel?: string
  type?: string
  content?: string
  mins?: number
}

type WeekItem = {
  week?: number
  theme?: string
  days?: DayItem[]
}

type Campaign = {
  id: string
  title: string
  status: string
  segment: string | null
  timeline_days: number | null
  created_at: string
  week_plan: WeekItem[] | null
}

type CalendarEntry = {
  id: string
  campaignId: string
  campaignTitle: string
  campaignStatus: string
  week: number
  weekTheme: string
  day: string
  dayIndex: number
  channel: string
  type: string
  content: string
  mins: number | null
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function normalizeDay(day: string | undefined, fallbackIndex: number) {
  if (!day) return DAYS[fallbackIndex % DAYS.length]
  const found = DAYS.find(d => day.toLowerCase().startsWith(d.toLowerCase()))
  return found ?? day
}

function dayIndex(day: string) {
  const index = DAYS.findIndex(d => day.toLowerCase().startsWith(d.toLowerCase()))
  return index === -1 ? 0 : index
}

function channelIcon(channel: string) {
  const ch = channel.toLowerCase()
  const props = { size: 14, className: 'text-[#64748B]' }
  if (ch.includes('instagram') || ch.includes('social')) return <Hash {...props} />
  if (ch.includes('email')) return <Mail {...props} />
  if (ch.includes('ad') || ch.includes('paid')) return <MousePointer {...props} />
  return <Megaphone {...props} />
}

function buildEntries(campaigns: Campaign[]): CalendarEntry[] {
  return campaigns.flatMap(campaign => {
    const weeks = Array.isArray(campaign.week_plan) ? campaign.week_plan : []
    return weeks.flatMap((week, weekIndex) => {
      const days = Array.isArray(week.days) ? week.days : []
      return days.map((day, index) => {
        const normalizedDay = normalizeDay(day.day, index)
        return {
          id: `${campaign.id}-${week.week ?? weekIndex + 1}-${index}`,
          campaignId: campaign.id,
          campaignTitle: campaign.title,
          campaignStatus: campaign.status,
          week: week.week ?? weekIndex + 1,
          weekTheme: week.theme ?? `Week ${week.week ?? weekIndex + 1}`,
          day: normalizedDay,
          dayIndex: dayIndex(normalizedDay),
          channel: day.channel ?? 'Organic',
          type: day.type ?? 'Content',
          content: day.content ?? 'Planned content item',
          mins: typeof day.mins === 'number' ? day.mins : null,
        }
      })
    })
  }).sort((a, b) => a.week - b.week || a.dayIndex - b.dayIndex)
}

function groupByWeek(entries: CalendarEntry[]) {
  const map = new Map<number, CalendarEntry[]>()
  for (const entry of entries) {
    map.set(entry.week, [...(map.get(entry.week) ?? []), entry])
  }
  return [...map.entries()].map(([week, weekEntries]) => ({
    week,
    entries: weekEntries,
    theme: weekEntries[0]?.weekTheme ?? `Week ${week}`,
  }))
}

function statusLabel(status: string) {
  return status.replace(/_/g, ' ')
}

export default async function CalendarPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const supabase = createServiceClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, company_name, full_name')
    .eq('clerk_user_id', userId)
    .single()

  if (!profile) redirect('/sign-in')

  const { data: campaigns, error } = await supabase
    .from('campaigns')
    .select('id, title, status, segment, timeline_days, created_at, week_plan')
    .eq('user_id', profile.id)
    .order('created_at', { ascending: false })

  if (error) console.error('[calendar] campaigns fetch error:', error.message)

  const campaignRows = (campaigns ?? []) as Campaign[]
  const activeCampaigns = campaignRows.filter(c => !['archived', 'completed'].includes(c.status))
  const entries = buildEntries(activeCampaigns.length ? activeCampaigns : campaignRows)
  const weeks = groupByWeek(entries)
  const totalMinutes = entries.reduce((sum, entry) => sum + (entry.mins ?? 0), 0)
  const channelCount = new Set(entries.map(entry => entry.channel)).size
  const campaignLines = activeCampaigns.length
    ? activeCampaigns.map(c => `- ${c.title} (${c.status})`).join('\n')
    : '- No active campaigns'
  const nextActions = entries.slice(0, 5).map(entry => `- Week ${entry.week} ${entry.day}: ${entry.channel} ${entry.type} — ${entry.content}`).join('\n') || '- No planned content items'

  const context = `CONTENT CALENDAR PAGE
Company: ${profile.company_name ?? profile.full_name ?? 'Unknown'}
Active campaigns: ${activeCampaigns.length}
Planned content items: ${entries.length}
Campaigns:
${campaignLines}
Upcoming/planned items:
${nextActions}
The user is reviewing planned campaign content and may need help turning items into captions, emails, posts, or schedule-ready assets.`

  return (
    <div className="px-8 pt-8 pb-6 max-w-[1440px]">
      <CanvasContextDispatcher context={context} />

      <div className="mb-8 flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold tracking-widest uppercase text-[#94A3B8] mb-2">Content Calendar</p>
          <h1 className="text-2xl font-bold text-gray-900">Your content schedule</h1>
          <p className="text-gray-500 text-sm mt-1">
            Planned campaign content organized by week, channel, and action.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CalendarMayaButton />
          <Link
            href="/dashboard/campaigns/new"
            className="inline-flex items-center gap-2 rounded-xl bg-[#2D3748] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1E293B] transition-colors"
          >
            <Plus size={14} />
            New campaign
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Planned items</p>
          <p className="text-3xl font-bold text-gray-900">{entries.length}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Active campaigns</p>
          <p className="text-3xl font-bold text-gray-900">{activeCampaigns.length}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Content time</p>
          <p className="text-3xl font-bold text-gray-900">{totalMinutes ? `${totalMinutes}m` : channelCount}</p>
          <p className="text-xs text-gray-400 mt-1">{totalMinutes ? 'Estimated production time' : 'Channels represented'}</p>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-16 flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center mb-4">
            <CalendarDays size={20} className="text-gray-300" />
          </div>
          <p className="text-sm font-semibold text-gray-700 mb-1">No planned content yet</p>
          <p className="text-sm text-gray-400 max-w-sm leading-relaxed mb-6">
            Build a campaign or run the Weekly Content agent to create schedule-ready posts, emails, and content tasks.
          </p>
          <Link
            href="/dashboard/campaigns/new"
            className="inline-flex items-center gap-2 rounded-xl bg-[#2D3748] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#1E293B] transition-colors"
          >
            <Plus size={14} />
            Build campaign
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {weeks.map(week => (
            <section key={week.week} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <p className="text-[10px] font-semibold tracking-widest uppercase text-[#3B82F6]">Week {week.week}</p>
                  <h2 className="text-lg font-semibold text-gray-900">{week.theme}</h2>
                </div>
                <p className="text-sm text-gray-400">{week.entries.length} planned item{week.entries.length === 1 ? '' : 's'}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-7 border-b border-gray-100 bg-gray-50/50">
                {DAYS.map(day => (
                  <div key={day} className="px-4 py-3 text-[10px] font-semibold tracking-widest uppercase text-gray-400 md:border-r md:last:border-r-0 border-gray-100">
                    {day}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-7">
                {DAYS.map((day, index) => {
                  const dayEntries = week.entries.filter(entry => entry.dayIndex === index)
                  return (
                    <div key={day} className="min-h-[180px] p-3 md:border-r md:last:border-r-0 border-gray-100">
                      <div className="space-y-3">
                        {dayEntries.length === 0 ? (
                          <div className="hidden md:block h-20 rounded-xl border border-dashed border-gray-100" />
                        ) : (
                          dayEntries.map(entry => (
                            <Link
                              key={entry.id}
                              href={`/dashboard/campaigns/${entry.campaignId}`}
                              className="block rounded-xl border border-gray-100 bg-white p-3 hover:border-[#3B82F6]/30 hover:shadow-sm transition-all"
                            >
                              <div className="flex items-center justify-between gap-2 mb-2">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  {channelIcon(entry.channel)}
                                  <span className="text-[11px] font-semibold text-[#64748B] truncate">{entry.channel}</span>
                                </div>
                                {entry.mins && <span className="text-[10px] text-gray-300 whitespace-nowrap">{entry.mins}m</span>}
                              </div>
                              <p className="text-xs font-semibold text-gray-900 mb-1">{entry.type}</p>
                              <p className="text-xs text-gray-500 leading-relaxed line-clamp-4">{entry.content}</p>
                              <div className="mt-3 pt-3 border-t border-gray-50">
                                <p className="text-[10px] text-gray-400 truncate">{entry.campaignTitle}</p>
                                <p className="text-[10px] text-gray-300 capitalize">{statusLabel(entry.campaignStatus)}</p>
                              </div>
                            </Link>
                          ))
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
