'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Hash,
  Mail,
  MousePointer,
  Leaf,
  ChevronDown,
  ChevronRight,
  ArrowLeft,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────

interface DoThisItem {
  task: string
  channel: string
  cta?: string
}

interface DayItem {
  day: string
  channel: string
  type: string
  content: string
  mins: number
}

interface WeekItem {
  week: number
  theme: string
  days: DayItem[]
}

interface Campaign {
  id: string
  title: string
  mode: string
  segment: string | null
  goal: string | null
  timeline_days: number | null
  strategy_summary: string | null
  do_this_today: DoThisItem[] | null
  week_plan: WeekItem[] | null
  status: string
  created_at: string
}

interface Props {
  campaign: Campaign
}

// ── Sub-components ────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; color: string }> = {
    active:    { bg: '#f0fdf4', color: '#16a34a' },
    paused:    { bg: '#fffbeb', color: '#ca8a04' },
    completed: { bg: '#eff6ff', color: '#2563eb' },
    archived:  { bg: '#f9fafb', color: '#9ca3af' },
  }
  const c = colors[status] ?? colors.active
  return (
    <span style={{ background: c.bg, color: c.color, fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 20 }}>
      {status}
    </span>
  )
}

function ChannelIcon({ channel }: { channel: string }) {
  const ch = channel.toLowerCase()
  const iconProps = { size: 14, strokeWidth: 1.75 }
  if (ch.includes('instagram') || ch.includes('social')) return <Hash {...iconProps} color="#888" />
  if (ch.includes('email')) return <Mail {...iconProps} color="#888" />
  if (ch.includes('ads') || ch.includes('paid')) return <MousePointer {...iconProps} color="#888" />
  return <Leaf {...iconProps} color="#888" />
}

function WeekAccordion({ week }: { week: WeekItem }) {
  const [open, setOpen] = useState(week.week === 1)

  return (
    <div style={{ border: '1px solid #f0f0f0', borderRadius: 12, overflow: 'hidden', marginBottom: 8 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 16px', background: open ? '#fafafa' : '#fff',
          border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
          transition: 'background 0.1s',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#3B82F6' }}>WEEK {week.week}</span>
          <span style={{ fontSize: 13, fontWeight: 500, color: '#2D3748' }}>{week.theme}</span>
        </div>
        {open ? <ChevronDown size={14} color="#bbb" /> : <ChevronRight size={14} color="#bbb" />}
      </button>

      {open && (
        <div style={{ borderTop: '1px solid #f0f0f0' }}>
          {week.days?.map((day, i) => (
            <div
              key={i}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 12,
                padding: '12px 16px',
                borderBottom: i < week.days.length - 1 ? '1px solid #f8f8f8' : 'none',
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 600, color: '#bbb', minWidth: 28, paddingTop: 2 }}>
                {day.day}
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <ChannelIcon channel={day.channel} />
                  <span style={{ fontSize: 11, color: '#bbb' }}>{day.channel} · {day.type}</span>
                </div>
                <p style={{ fontSize: 13, color: '#2D3748', lineHeight: 1.5 }}>{day.content}</p>
              </div>
              <span style={{ fontSize: 11, color: '#ddd', whiteSpace: 'nowrap', paddingTop: 2 }}>
                {day.mins}m
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────

export default function CampaignDetail({ campaign }: Props) {
  function openMayaWithTask(task: string) {
    window.dispatchEvent(new CustomEvent('maya:open-task', { detail: { task } }))
  }

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px 24px' }}>

      {/* Back */}
      <Link
        href="/dashboard/campaigns"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#bbb', textDecoration: 'none', fontSize: 12.5, marginBottom: 24 }}
      >
        <ArrowLeft size={13} />
        All campaigns
      </Link>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#3B82F6' }}>
            {campaign.mode === 'guided'
              ? (campaign.segment?.replace(/_/g, ' ') ?? 'Guided')
              : 'Custom campaign'}
          </span>
          <StatusBadge status={campaign.status} />
          {campaign.timeline_days && (
            <span style={{ fontSize: 11, color: '#bbb' }}>{campaign.timeline_days}-day campaign</span>
          )}
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#2D3748', lineHeight: 1.25, marginBottom: 10 }}>
          {campaign.title}
        </h1>
        {campaign.strategy_summary && (
          <p style={{ fontSize: 14, color: '#555', lineHeight: 1.65, maxWidth: 600 }}>
            {campaign.strategy_summary}
          </p>
        )}
      </div>

      {/* Do this today */}
      {campaign.do_this_today && campaign.do_this_today.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#bbb', marginBottom: 14 }}>
            Do this today
          </p>
          <div style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: 16, overflow: 'hidden' }}>
            {campaign.do_this_today.map((item, i) => (
              <div
                key={i}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '14px 18px',
                  borderBottom: i < campaign.do_this_today!.length - 1 ? '1px solid #f8f8f8' : 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <ChannelIcon channel={item.channel} />
                  <span style={{ fontSize: 13.5, color: '#2D3748' }}>{item.task}</span>
                </div>
                <button
                  onClick={() => openMayaWithTask(item.task)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                    fontSize: 12, fontWeight: 500, color: '#3B82F6', whiteSpace: 'nowrap',
                    padding: '4px 0', marginLeft: 16,
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.textDecoration = 'underline' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.textDecoration = 'none' }}
                >
                  Do this with Maya →
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Week by week */}
      {campaign.week_plan && campaign.week_plan.length > 0 && (
        <div>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#bbb', marginBottom: 14 }}>
            Week by week
          </p>
          {campaign.week_plan.map(week => (
            <WeekAccordion key={week.week} week={week} />
          ))}
        </div>
      )}
    </div>
  )
}
