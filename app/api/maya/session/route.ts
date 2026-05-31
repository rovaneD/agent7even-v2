import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { openRouterComplete } from '@/lib/agents/openrouter'

// GET /api/maya/session?id=<sessionId>
export async function GET(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const sessionId = searchParams.get('id')
  if (!sessionId) return NextResponse.json({ session: null })

  const supabase = createServiceClient()

  const { data: profileRows } = await supabase
    .from('profiles')
    .select('id')
    .eq('clerk_user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
  const profile = profileRows?.[0]
  if (!profile) return NextResponse.json({ session: null })

  const { data: session } = await supabase
    .from('maya_sessions')
    .select('id, messages, mode, title, canvas_context')
    .eq('id', sessionId)
    .eq('user_id', profile.id)
    .single()

  return NextResponse.json({ session: session ?? null })
}

// POST /api/maya/session
// Body: { userId, sessionId?, messages, mode?, canvasContext? }
// - sessionId provided → update that session
// - no sessionId → create new session with generated title
export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { userId: profileId, sessionId, messages, mode, canvasContext } = await req.json()
  if (!profileId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 })

  const supabase = createServiceClient()

  // ── Update existing session ────────────────────────────────────────────────
  if (sessionId) {
    const { error } = await supabase
      .from('maya_sessions')
      .update({
        messages:   messages ?? [],
        mode:       mode ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId)
      .eq('user_id', profileId)

    if (error) {
      console.error('[session] update error:', error.message)
      return NextResponse.json({ error: 'Failed to update session' }, { status: 500 })
    }

    return NextResponse.json({ success: true, sessionId })
  }

  // ── Create new session ─────────────────────────────────────────────────────
  const firstUserText = extractFirstUserText(messages ?? [])
  let title = 'New conversation'

  if (firstUserText && !firstUserText.startsWith('__')) {
    try {
      const result = await openRouterComplete({
        model: 'anthropic/claude-haiku-4-5',
        messages: [{
          role: 'user',
          content: `Generate a short title (4 words max, no quotes, no punctuation) for a chat that started with: "${firstUserText.slice(0, 200)}"
Return only the title, nothing else.`,
        }],
        max_tokens: 12,
        temperature: 0.3,
      })
      const raw = result.content.trim().replace(/^["']|["']$/g, '')
      if (raw.length > 0 && raw.length < 60) title = raw
    } catch {
      // keep default
    }
  }

  const { data, error } = await supabase
    .from('maya_sessions')
    .insert({
      user_id:        profileId,
      messages:       messages ?? [],
      mode:           mode ?? null,
      title,
      canvas_context: canvasContext ?? null,
      updated_at:     new Date().toISOString(),
    })
    .select('id')
    .single()

  if (error) {
    console.error('[session] insert error:', error.message)
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })
  }

  return NextResponse.json({ success: true, sessionId: data.id, title })
}

function extractFirstUserText(messages: Array<Record<string, unknown>>): string {
  const first = messages.find(m => m.role === 'user')
  if (!first) return ''
  const parts = first.parts as Array<{ type: string; text?: string }> | undefined
  if (Array.isArray(parts)) {
    return parts
      .filter((p): p is { type: 'text'; text: string } => p.type === 'text' && !!p.text)
      .map(p => p.text)
      .join('')
  }
  if (typeof first.content === 'string') return first.content
  return ''
}
