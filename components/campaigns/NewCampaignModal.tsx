'use client'

import { useRouter } from 'next/navigation'
import { Target, Sparkles } from 'lucide-react'

interface Props {
  open: boolean
  onClose: () => void
}

export default function NewCampaignModal({ open, onClose }: Props) {
  const router = useRouter()

  if (!open) return null

  function goTo(mode: 'guided' | 'open') {
    onClose()
    router.push(`/dashboard/campaigns/new?mode=${mode}`)
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: 'rgba(0,0,0,0.35)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff', borderRadius: 20, padding: 28,
          width: '100%', maxWidth: 460,
          boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <h2 style={{ fontSize: 16, fontWeight: 600, color: '#2D3748', marginBottom: 6 }}>
          New campaign
        </h2>
        <p style={{ fontSize: 13, color: '#999', marginBottom: 20 }}>
          How do you want to approach this campaign?
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <ModeCard
            icon={<Target size={15} />}
            title="Guided"
            description="I know my audience. Walk me through building a targeted campaign."
            onClick={() => goTo('guided')}
          />
          <ModeCard
            icon={<Sparkles size={15} />}
            title="Open canvas"
            description="I have a specific situation or idea. Let Maya help me figure it out."
            onClick={() => goTo('open')}
          />
        </div>

        <p style={{ fontSize: 11, color: '#ccc', textAlign: 'center', marginTop: 16 }}>
          Both create a full campaign plan saved to My campaigns
        </p>
      </div>
    </div>
  )
}

function ModeCard({
  icon,
  title,
  description,
  onClick,
}: {
  icon: React.ReactNode
  title: string
  description: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        textAlign: 'left', padding: '18px 16px', borderRadius: 14,
        border: '1.5px solid #e8e8e8', background: '#fafafa',
        cursor: 'pointer', fontFamily: 'inherit', transition: 'border-color 0.12s, background 0.12s',
      }}
      onMouseEnter={e => {
        const t = e.currentTarget as HTMLButtonElement
        t.style.borderColor = '#2D3748'
        t.style.background = '#f5f5f5'
      }}
      onMouseLeave={e => {
        const t = e.currentTarget as HTMLButtonElement
        t.style.borderColor = '#e8e8e8'
        t.style.background = '#fafafa'
      }}
    >
      <div
        style={{
          width: 34, height: 34, borderRadius: 10, background: '#f0f0f0',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 10, color: '#555',
        }}
      >
        {icon}
      </div>
      <p style={{ fontSize: 13.5, fontWeight: 600, color: '#2D3748', marginBottom: 4 }}>{title}</p>
      <p style={{ fontSize: 11.5, color: '#999', lineHeight: 1.5 }}>{description}</p>
    </button>
  )
}
