import { NextResponse } from 'next/server'
import { getVoixAdminContext } from '@/lib/voix/access'
import { normalizeInstagram } from '@/lib/voix/pilotRequests'
import { PROSPECT_CHANNELS, PROSPECT_STATUSES } from '@/lib/voix/prospects'

type Body = {
  action?: 'create' | 'update' | 'contacted_today' | 'delete'
  id?: string
  spa_name?: string
  website?: string
  instagram?: string
  city?: string
  contact_name?: string
  channel?: string
  status?: string
  next_follow_up?: string | null
  notes?: string
}

const text = (v: unknown, max = 300) => {
  const s = typeof v === 'string' ? v.trim() : ''
  return s ? s.slice(0, max) : null
}

function website(v: unknown): string | null {
  const s = text(v, 300)
  if (!s) return null
  try {
    const url = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`)
    return `${url.protocol}//${url.host}${url.pathname === '/' ? '' : url.pathname}`
  } catch {
    return s
  }
}

/** Only the fields present in the body, validated. */
function fields(body: Body): { fields: Record<string, unknown> } | { error: string } {
  const out: Record<string, unknown> = {}
  if ('spa_name' in body) {
    const name = text(body.spa_name, 120)
    if (!name) return { error: 'Spa name is required' }
    out.spa_name = name
  }
  if ('website' in body) out.website = website(body.website)
  if ('instagram' in body) out.instagram = normalizeInstagram(body.instagram)
  if ('city' in body) out.city = text(body.city, 80)
  if ('contact_name' in body) out.contact_name = text(body.contact_name, 120)
  if ('notes' in body) out.notes = text(body.notes, 4000)
  if ('channel' in body) {
    if (!PROSPECT_CHANNELS.includes(body.channel as never)) return { error: 'Unknown channel' }
    out.channel = body.channel
  }
  if ('status' in body) {
    if (!PROSPECT_STATUSES.includes(body.status as never)) return { error: 'Unknown status' }
    out.status = body.status
  }
  if ('next_follow_up' in body) {
    const d = text(body.next_follow_up, 10)
    if (d && !/^\d{4}-\d{2}-\d{2}$/.test(d)) return { error: 'Follow-up must be a date' }
    out.next_follow_up = d
  }
  return { fields: out }
}

export async function POST(req: Request) {
  const admin = await getVoixAdminContext()
  if ('status' in admin) return NextResponse.json({ error: 'Not allowed' }, { status: admin.status })
  const { supabase } = admin
  const body = ((await req.json().catch(() => null)) ?? {}) as Body
  const now = new Date().toISOString()

  try {
    switch (body.action) {
      case 'create': {
        const parsed = fields({ spa_name: '', ...body })
        if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })
        const { data, error } = await supabase.from('voix_prospects').insert(parsed.fields).select('id').single()
        if (error) throw error
        return NextResponse.json({ ok: true, id: data.id })
      }
      case 'update': {
        if (!body.id) return NextResponse.json({ error: 'Missing prospect' }, { status: 400 })
        const parsed = fields(body)
        if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })
        const { error } = await supabase
          .from('voix_prospects')
          .update({ ...parsed.fields, updated_at: now })
          .eq('id', body.id)
        if (error) throw error
        return NextResponse.json({ ok: true })
      }
      case 'contacted_today': {
        if (!body.id) return NextResponse.json({ error: 'Missing prospect' }, { status: 400 })
        const { data: row } = await supabase.from('voix_prospects').select('status').eq('id', body.id).maybeSingle()
        if (!row) return NextResponse.json({ error: 'Prospect not found' }, { status: 404 })
        const followUp = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10)
        const { error } = await supabase
          .from('voix_prospects')
          .update({
            last_contacted_at: now,
            next_follow_up: followUp,
            status: row.status === 'to_contact' ? 'contacted' : row.status,
            updated_at: now,
          })
          .eq('id', body.id)
        if (error) throw error
        return NextResponse.json({ ok: true })
      }
      case 'delete': {
        if (!body.id) return NextResponse.json({ error: 'Missing prospect' }, { status: 400 })
        const { error } = await supabase.from('voix_prospects').delete().eq('id', body.id)
        if (error) throw error
        return NextResponse.json({ ok: true })
      }
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
  } catch (err) {
    console.error('[voix/admin/prospects]', err)
    return NextResponse.json({ error: 'Could not save. Try again.' }, { status: 500 })
  }
}
