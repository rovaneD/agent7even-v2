import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { CalendarDays, Hash, Mail, Megaphone, MousePointer, Plus, Clock } from 'lucide-react'
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
  segment?: string | null
  timeline_days?: number | null
  created_at: string
  week_plan?: WeekItem[] | null
  plan?: { weekPlan?: WeekItem[]; weeks?: Array<{ week?: number; theme?: string; tasks?: Array<{ day?: string; channel?: string; action?: string }> }> } | null
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
  const props = { size: 14, className: 'text-text-sec' }
  if (ch.includes('instagram') || ch.includes('social')) return <Hash {...props} />
  if (ch.includes('email')) return <Mail {...props} />
  if (ch.includes('ad') || ch.includes('paid')) return <MousePointer {...props} />
  return <Megaphone {...props} />
}

function buildEntries(campaigns: Campaign[]): CalendarEntry[] {
  return campaigns.flatMap(campaign => {
    const legacyWeeks: WeekItem[] = Array.isArray(campaign.plan?.weeks)
      ? campaign.plan.weeks.map(week => ({
          week: week.week,
          theme: week.theme,
          days: (week.tasks ?? []).map(task => ({
            day: task.day,
            channel: task.channel,
            type: 'Task',
            content: task.action,
          })),
        }))
      : []
    const weeks = Array.isArray(campaign.week_plan)
      ? campaign.week_plan
      : Array.isArray(campaign.plan?.weekPlan)
        ? campaign.plan.weekPlan
        : legacyWeeks
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
    .select('*')
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
    <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-8">
      <CanvasContextDispatcher context={context} />

      <section className="mb-6 overflow-hidden rounded-2xl border border-gray-100 bg-white">
        <div className="flex flex-col gap-6 p-7 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-brand-primary">Content Calendar</p>
            <h1 className="text-[30px] font-semibold tracking-tight text-text">Your content schedule</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-text-sec">
              Planned campaign content organized by week, channel, and next action.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <CalendarMayaButton />
            <Link
              href="/dashboard/campaigns/new"
              className="inline-flex items-center gap-2 rounded-xl bg-brand-primary px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#2563EB]"
            >
              <Plus size={14} />
              New campaign
            </Link>
          </div>
        </div>
      </section>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-gray-100 bg-white p-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-text-soft">Planned items</p>
          <p className="text-3xl font-semibold text-text">{entries.length}</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-text-soft">Active campaigns</p>
          <p className="text-3xl font-semibold text-text">{activeCampaigns.length}</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-text-soft">Content time</p>
          <div className="flex items-end gap-2">
            <p className="text-3xl font-semibold text-text">{totalMinutes ? `${totalMinutes}m` : channelCount}</p>
            <Clock size={16} className="mb-1 text-text-soft" />
          </div>
          <p className="mt-1 text-xs text-text-soft">{totalMinutes ? 'Estimated production time' : 'Channels represented'}</p>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-100 bg-white p-16 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-primary/10">
            <CalendarDays size={22} className="text-brand-primary" />
          </div>
          <p className="mb-1 text-base font-semibold text-text">No planned content yet</p>
          <p className="mb-6 max-w-sm text-sm leading-6 text-text-sec">
            Build a campaign or run the Weekly Content agent to create schedule-ready posts, emails, and content tasks.
          </p>
          <Link
            href="/dashboard/campaigns/new"
            className="inline-flex items-center gap-2 rounded-xl bg-brand-primary px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#2563EB]"
          >
            <Plus size={14} />
            Build campaign
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {weeks.map(week => (
            <section key={week.week} className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
              <div className="flex flex-col gap-2 border-b border-border px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-brand-primary">Week {week.week}</p>
                  <h2 className="text-lg font-semibold text-text">{week.theme}</h2>
                </div>
                <p className="text-sm text-text-soft">{week.entries.length} planned item{week.entries.length === 1 ? '' : 's'}</p>
              </div>

              <div className="grid grid-cols-1 border-b border-border bg-surface-2 md:grid-cols-7">
                {DAYS.map(day => (
                  <div key={day} className="border-border px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-text-soft md:border-r md:last:border-r-0">
                    {day}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-7">
                {DAYS.map((day, index) => {
                  const dayEntries = week.entries.filter(entry => entry.dayIndex === index)
                  return (
                    <div key={day} className="min-h-[180px] border-border p-3 md:border-r md:last:border-r-0">
                      <div className="space-y-3">
                        {dayEntries.length === 0 ? (
                          <div className="hidden h-20 rounded-xl border border-dashed border-border md:block" />
                        ) : (
                          dayEntries.map(entry => (
                            <Link
                              key={entry.id}
                              href={`/dashboard/campaigns/${entry.campaignId}`}
                              className="block rounded-xl border border-gray-100 bg-white p-3 transition-all hover:border-brand-primary/40 hover:bg-surface-2"
                            >
                              <div className="mb-2 flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  {channelIcon(entry.channel)}
                                  <span className="truncate text-[11px] font-semibold text-text-sec">{entry.channel}</span>
                                </div>
                                {entry.mins && <span className="whitespace-nowrap text-[10px] text-text-soft">{entry.mins}m</span>}
                              </div>
                              <p className="mb-1 text-xs font-semibold text-text">{entry.type}</p>
                              <p className="line-clamp-4 text-xs leading-relaxed text-text-sec">{entry.content}</p>
                              <div className="mt-3 border-t border-border pt-3">
                                <p className="truncate text-[10px] text-text-soft">{entry.campaignTitle}</p>
                                <p className="text-[10px] capitalize text-text-soft">{statusLabel(entry.campaignStatus)}</p>
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
