'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { useMayaContext } from '@/hooks/useMayaContext'
import { buildOpenCanvasCampaignMayaContext } from '@/lib/maya/summaries/phase3Context'
import { useRouter } from 'next/navigation'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport, UIMessage } from 'ai'
import ReactMarkdown from 'react-markdown'
import { CheckCircle2, Circle } from 'lucide-react'
import OrchestrationProgress from '@/components/agents/OrchestrationProgress'

const TRIGGER_PHRASE = "I have what I need to build this"

const MODEL_OPTIONS = [
  {
    id:      'sonnet',
    model:   'anthropic/claude-sonnet-4',
    label:   'Claude Sonnet',
    credits: 8,
  },
  {
    id:      'opus',
    model:   'anthropic/claude-opus-4',
    label:   'Claude Opus',
    credits: 25,
  },
]

const GENERATION_STEPS = [
  'Analyzing your situation...',
  'Matching to your brand voice...',
  'Building week-by-week plan...',
  'Creating today\'s action list...',
  'Campaign ready',
]

const PLAIN_MD = {
  p: ({ children }: { children?: React.ReactNode }) => (
    <p style={{ margin: '0 0 10px 0', fontSize: 13.5, lineHeight: 1.7, color: '#2D3748' }}>{children}</p>
  ),
  strong: ({ children }: { children?: React.ReactNode }) => (
    <span style={{ fontWeight: 500 }}>{children}</span>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul style={{ paddingLeft: 16, margin: '0 0 10px 0' }}>{children}</ul>
  ),
  li: ({ children }: { children?: React.ReactNode }) => (
    <li style={{ marginBottom: 5, fontSize: 13.5, lineHeight: 1.65 }}>{children}</li>
  ),
}

export default function OpenCanvasFlow() {
  const router = useRouter()

  const [input, setInput]                   = useState('')
  const [selectedModel, setSelectedModel]   = useState('sonnet')
  const [readyToGenerate, setReadyToGenerate] = useState(false)
  const [isCreating, setIsCreating]         = useState(false)
  const [genStep, setGenStep]               = useState(0)
  const [error, setError]                   = useState('')
  const [orchestrationId, setOrchestrationId] = useState<string | null>(null)
  const [campaignId, setCampaignId]           = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)

  function getMsgText(msg: UIMessage): string {
    return msg.parts
      .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
      .map(p => p.text)
      .join('')
  }

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api:  '/api/maya/chat',
      body: { isOpenCanvas: true },
    }),
    onFinish: ({ message }: { message: UIMessage }) => {
      const text = getMsgText(message)
      if (text.includes(TRIGGER_PHRASE)) {
        setReadyToGenerate(true)
      }
    },
  })

  const isLoading = status === 'submitted' || status === 'streaming'

  const visibleMessages = messages.filter(msg => {
    const t = getMsgText(msg)
    return !t.startsWith('__')
  })

  const mayaContext = useMemo(
    () =>
      buildOpenCanvasCampaignMayaContext({
        messageCount: messages.length,
        readyToGenerate,
        isCreating,
        selectedModel,
      }),
    [messages.length, readyToGenerate, isCreating, selectedModel],
  )
  useMayaContext(mayaContext)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  function submit(text?: string) {
    const content = (text ?? input).trim()
    if (!content || isLoading) return
    sendMessage({ text: content })
    setInput('')
    setReadyToGenerate(false)
  }

  async function generateCampaign() {
    setIsCreating(true)
    setError('')

    let i = 0
    const interval = setInterval(() => {
      i++
      setGenStep(i)
      if (i >= GENERATION_STEPS.length - 1) clearInterval(interval)
    }, 900)

    try {
      const brief = visibleMessages
        .map(m => `${m.role}: ${getMsgText(m)}`)
        .join('\n')

      const option = MODEL_OPTIONS.find(o => o.id === selectedModel)!

      const res = await fetch('/api/campaigns/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode:    'open_canvas',
          brief,
          model:   option.model,
          credits: option.credits,
        }),
      })

      clearInterval(interval)

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Generation failed')
      }

      const data = await res.json()

      if (data.orchestrationId) {
        setOrchestrationId(data.orchestrationId)
        if (data.campaignId) setCampaignId(data.campaignId)
        // OrchestrationProgress handles navigation via onComplete
      } else {
        setGenStep(GENERATION_STEPS.length - 1)
        setTimeout(() => {
          router.push(`/dashboard/campaigns/${data.campaignId}`)
        }, 600)
      }
    } catch (err) {
      clearInterval(interval)
      setIsCreating(false)
      setGenStep(0)
      setError(err instanceof Error ? err.message : 'Something went wrong')
    }
  }

  if (isCreating) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 24, padding: '0 24px' }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: '#2D3748', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: '#fff', fontSize: 16, fontWeight: 600 }}>M</span>
        </div>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: '#2D3748', margin: '0 0 6px' }}>Building your campaign</h2>
          <p style={{ fontSize: 13, color: '#999', margin: 0 }}>
            Maya is running multiple agents in parallel to build the strongest possible campaign.
          </p>
        </div>

        {orchestrationId ? (
          <div style={{ width: '100%', maxWidth: 420 }}>
            <OrchestrationProgress
              orchestrationId={orchestrationId}
              onComplete={() => {
                if (campaignId) router.push(`/dashboard/campaigns/${campaignId}`)
              }}
            />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: 280 }}>
            {GENERATION_STEPS.map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {i < genStep ? (
                  <CheckCircle2 size={15} color="#10B981" />
                ) : i === genStep ? (
                  <Circle size={15} color="#3B82F6" />
                ) : (
                  <Circle size={15} color="#e0e0e0" />
                )}
                <span style={{ fontSize: 13, color: i < genStep ? '#10B981' : i === genStep ? '#2D3748' : '#ccc', fontWeight: i === genStep ? 500 : 400 }}>
                  {s}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ flexShrink: 0, padding: '16px 20px', borderBottom: '0.5px solid #f0f0f0', background: '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#2D3748', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#fff', fontSize: 12, fontWeight: 600 }}>M</span>
          </div>
          <div>
            <p style={{ fontSize: 13.5, fontWeight: 500, color: '#2D3748', lineHeight: 1 }}>Open Canvas</p>
            <p style={{ fontSize: 11, color: '#bbb', marginTop: 2 }}>Describe your situation and Maya will build a custom campaign</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 20px' }}>
        {visibleMessages.length === 0 && !isLoading && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 24 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#2D3748', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
              <span style={{ color: '#fff', fontSize: 11, fontWeight: 500 }}>M</span>
            </div>
            <p style={{ fontSize: 13.5, lineHeight: 1.7, color: '#2D3748', paddingTop: 3 }}>
              Tell me what&apos;s going on — what are you trying to solve or achieve with this campaign? Don&apos;t worry about fitting it into a template, just describe the situation.
            </p>
          </div>
        )}

        {visibleMessages.map((msg) => {
          const text = getMsgText(msg)
          return (
            <div key={msg.id} style={{ marginBottom: msg.role === 'user' ? 20 : 24 }}>
              {msg.role === 'user' ? (
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <div style={{ background: '#2D3748', color: '#fff', borderRadius: '16px 16px 4px 16px', padding: '9px 13px', maxWidth: '80%', fontSize: 13.5, lineHeight: 1.55 }}>
                    {text}
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#2D3748', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                    <span style={{ color: '#fff', fontSize: 11, fontWeight: 500 }}>M</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0, paddingTop: 3 }}>
                    <ReactMarkdown components={PLAIN_MD as never}>{text}</ReactMarkdown>
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {isLoading && visibleMessages.at(-1)?.role === 'user' && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 20 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#2D3748', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ color: '#fff', fontSize: 11, fontWeight: 500 }}>M</span>
            </div>
            <p style={{ fontSize: 12.5, color: '#bbb', fontStyle: 'italic', paddingTop: 6 }}>Maya is thinking...</p>
          </div>
        )}

        {readyToGenerate && (
          <div style={{ marginTop: 8, marginBottom: 16, paddingLeft: 38 }}>
            <button
              onClick={generateCampaign}
              style={{
                background: '#2D3748', color: '#fff',
                border: 'none', borderRadius: 10,
                padding: '10px 18px', fontSize: 13, fontWeight: 500,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Yes, generate the full plan →
            </button>
          </div>
        )}

        {error && (
          <p style={{ fontSize: 12.5, color: '#3B82F6', paddingLeft: 38, marginBottom: 12 }}>{error}</p>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area + model selector */}
      <div style={{ flexShrink: 0, borderTop: '0.5px solid #f0f0f0', background: '#fff' }}>
        {/* Model selector */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px 8px', borderBottom: '0.5px solid #f5f5f5' }}>
          <span style={{ fontSize: 11.5, color: '#bbb' }}>Generation model</span>
          <div style={{ display: 'flex', gap: 6 }}>
            {MODEL_OPTIONS.map(opt => (
              <button
                key={opt.id}
                onClick={() => setSelectedModel(opt.id)}
                style={{
                  fontSize: 11.5, padding: '5px 10px', borderRadius: 8, fontWeight: 500,
                  border: '1px solid',
                  borderColor: selectedModel === opt.id ? '#3B82F6' : '#E2E8F0',
                  borderWidth: selectedModel === opt.id ? 2 : 1,
                  background: selectedModel === opt.id ? 'rgba(59,130,246,0.04)' : '#F8FAFC',
                  color: '#2D3748',
                  cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.1s',
                }}
              >
                {opt.label} · {opt.credits}cr
              </button>
            ))}
          </div>
        </div>

        {/* Text input */}
        <div style={{ padding: '12px 14px' }}>
          <div style={{ position: 'relative' }}>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe your situation..."
              rows={1}
              disabled={isLoading}
              style={{
                width: '100%', border: '0.5px solid #e0e0e0', borderRadius: 20,
                padding: '9px 42px 9px 14px', fontSize: 13.5, background: '#fafafa',
                color: '#2D3748', resize: 'none', outline: 'none', fontFamily: 'inherit',
                lineHeight: 1.5, boxSizing: 'border-box', display: 'block',
                opacity: isLoading ? 0.6 : 1,
              }}
            />
            <button
              onClick={() => submit()}
              disabled={isLoading || !input.trim()}
              style={{
                position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)',
                width: 28, height: 28, borderRadius: '50%',
                background: isLoading || !input.trim() ? '#ccc' : '#2D3748',
                border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: isLoading || !input.trim() ? 'not-allowed' : 'pointer',
              }}
            >
              <i className="ti ti-arrow-up" style={{ fontSize: 13, color: '#fff' }} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
