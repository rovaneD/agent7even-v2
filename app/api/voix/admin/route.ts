import { NextResponse } from 'next/server'
import { getVoixAdminContext, ACCOUNT_SELECT } from '@/lib/voix/access'
import { addSampleCalls, removeSampleCalls } from '@/lib/voix/samples'
import { sendTransactionalEmail } from '@/lib/email/sendTransactionalEmail'
import { sendDigest } from '@/lib/voix/digest'
import type { VoixAccount } from '@/lib/voix/types'

type Body = {
  action?:
    | 'create_account'
    | 'update_account'
    | 'add_member'
    | 'remove_member'
    | 'add_samples'
    | 'remove_samples'
    | 'send_test_digest'
    | 'update_request'
    | 'create_spa_from_request'
  accountId?: string
  name?: string
  timezone?: string
  agentIds?: string
  phoneNumber?: string
  transferNumber?: string
  alertEmails?: string
  status?: string
  email?: string
  fullName?: string
  role?: string
  memberId?: string
  sendInvite?: boolean
  digestEnabled?: boolean
  digestHour?: number | string
  requestId?: string
}

const EMAIL_RE = /^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/

function list(value: string | undefined, lower = false): string[] {
  return [
    ...new Set(
      (value ?? '')
        .split(/[\s,;]+/)
        .map((v) => (lower ? v.trim().toLowerCase() : v.trim()))
        .filter(Boolean),
    ),
  ]
}

function isTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

function accountFields(body: Body): { fields: Record<string, unknown> } | { error: string } {
  const name = body.name?.trim()
  if (!name) return { error: 'Spa name is required' }
  const timezone = body.timezone?.trim() || 'America/Los_Angeles'
  if (!isTimezone(timezone)) return { error: `Unknown timezone: ${timezone}` }
  const alertEmails = list(body.alertEmails, true)
  const bad = alertEmails.find((e) => !EMAIL_RE.test(e))
  if (bad) return { error: `Not an email address: ${bad}` }
  const agentIds = list(body.agentIds)
  const status = ['pilot', 'active', 'paused'].includes(body.status ?? '') ? body.status : 'pilot'
  const hour = Number(body.digestHour ?? 8)
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return { error: 'Digest hour must be 0–23' }
  return {
    fields: {
      name,
      timezone,
      retell_agent_ids: agentIds,
      phone_number: body.phoneNumber?.trim() || null,
      transfer_number: body.transferNumber?.trim() || null,
      alert_emails: alertEmails,
      status,
      digest_enabled: body.digestEnabled !== false,
      digest_hour: hour,
    },
  }
}

export async function POST(req: Request) {
  const admin = await getVoixAdminContext()
  if ('status' in admin) return NextResponse.json({ error: 'Not allowed' }, { status: admin.status })
  const { supabase } = admin
  const body = ((await req.json().catch(() => null)) ?? {}) as Body

  const loadAccount = async () => {
    if (!body.accountId) return null
    const { data } = await supabase.from('voix_accounts').select(ACCOUNT_SELECT).eq('id', body.accountId).maybeSingle()
    return (data as VoixAccount | null) ?? null
  }

  /** An agent id may belong to one spa only, or calls would land in the wrong dashboard. */
  const agentConflict = async (agentIds: string[], exceptId?: string) => {
    if (!agentIds.length) return null
    const { data } = await supabase.from('voix_accounts').select('id, name, retell_agent_ids').overlaps('retell_agent_ids', agentIds)
    const clash = (data ?? []).find((a) => a.id !== exceptId)
    return clash ? `That Retell agent is already linked to ${clash.name}` : null
  }

  try {
    switch (body.action) {
      case 'create_account': {
        const parsed = accountFields(body)
        if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })
        const clash = await agentConflict(parsed.fields.retell_agent_ids as string[])
        if (clash) return NextResponse.json({ error: clash }, { status: 409 })
        const { data, error } = await supabase.from('voix_accounts').insert(parsed.fields).select('id').single()
        if (error) throw error
        return NextResponse.json({ id: data.id })
      }
      case 'update_account': {
        const account = await loadAccount()
        if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 })
        const parsed = accountFields(body)
        if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })
        const clash = await agentConflict(parsed.fields.retell_agent_ids as string[], account.id)
        if (clash) return NextResponse.json({ error: clash }, { status: 409 })
        const { error } = await supabase
          .from('voix_accounts')
          .update({ ...parsed.fields, updated_at: new Date().toISOString() })
          .eq('id', account.id)
        if (error) throw error
        return NextResponse.json({ ok: true })
      }
      case 'add_member': {
        const account = await loadAccount()
        if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 })
        const email = body.email?.trim().toLowerCase() ?? ''
        if (!EMAIL_RE.test(email)) return NextResponse.json({ error: 'Enter a valid email' }, { status: 400 })
        const role = body.role === 'owner' ? 'owner' : 'staff'
        const { error } = await supabase
          .from('voix_members')
          .insert({ account_id: account.id, email, full_name: body.fullName?.trim() || null, role })
        if (error) {
          if (error.code === '23505') return NextResponse.json({ error: 'That email is already on this spa' }, { status: 409 })
          throw error
        }
        let invited = false
        if (body.sendInvite) {
          try {
            await sendTransactionalEmail({
              to: email,
              subject: `Your Voix dashboard for ${account.name}`,
              title: `You've been added to Voix for ${account.name}`,
              body: `Voix is the AI front desk answering ${account.name}'s calls. Your dashboard shows every call, the summary and recording, and the follow-ups that need a person. Create your login with this email address (${email}) to get started.`,
              link: '/voix/sign-up',
              ctaLabel: 'Create your login →',
            })
            invited = true
          } catch (err) {
            console.error('[voix/admin] invite email failed:', err)
          }
        }
        return NextResponse.json({ ok: true, invited })
      }
      case 'remove_member': {
        const account = await loadAccount()
        if (!account || !body.memberId) return NextResponse.json({ error: 'Missing account or member' }, { status: 400 })
        const { error } = await supabase.from('voix_members').delete().eq('id', body.memberId).eq('account_id', account.id)
        if (error) throw error
        return NextResponse.json({ ok: true })
      }
      case 'add_samples': {
        const account = await loadAccount()
        if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 })
        const added = await addSampleCalls(supabase, account)
        return NextResponse.json({ ok: true, added })
      }
      case 'remove_samples': {
        const account = await loadAccount()
        if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 })
        const removed = await removeSampleCalls(supabase, account.id)
        return NextResponse.json({ ok: true, removed })
      }
      case 'send_test_digest': {
        const account = await loadAccount()
        if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 })
        if (!admin.viewer.email) return NextResponse.json({ error: 'Your login has no email address' }, { status: 400 })
        const res = await sendDigest(supabase, account, { test: true, to: [admin.viewer.email] })
        if (!res.sent) return NextResponse.json({ error: res.reason ?? 'Not sent' }, { status: 400 })
        return NextResponse.json({ ok: true, to: admin.viewer.email })
      }
      case 'update_request': {
        const status = ['new', 'contacted', 'waitlist', 'set_up', 'declined'].includes(body.status ?? '') ? body.status : null
        if (!body.requestId || !status) return NextResponse.json({ error: 'Missing request or status' }, { status: 400 })
        const { error } = await supabase
          .from('voix_pilot_requests')
          .update({ status, updated_at: new Date().toISOString() })
          .eq('id', body.requestId)
        if (error) throw error
        return NextResponse.json({ ok: true })
      }
      case 'create_spa_from_request': {
        if (!body.requestId) return NextResponse.json({ error: 'Missing request' }, { status: 400 })
        const { data: req } = await supabase
          .from('voix_pilot_requests')
          .select('id, spa_name, contact_name, email, account_id')
          .eq('id', body.requestId)
          .maybeSingle()
        if (!req) return NextResponse.json({ error: 'Request not found' }, { status: 404 })
        if (req.account_id) return NextResponse.json({ error: 'A spa already exists for this request' }, { status: 409 })
        const name = (req.spa_name as string | null)?.trim() || `${req.contact_name ?? 'New'} spa`
        const { data: account, error } = await supabase
          .from('voix_accounts')
          .insert({ name, status: 'pilot' })
          .select('id')
          .single()
        if (error) throw error
        const email = (req.email as string | null)?.trim().toLowerCase()
        if (email && EMAIL_RE.test(email)) {
          const { error: mErr } = await supabase
            .from('voix_members')
            .insert({ account_id: account.id, email, full_name: req.contact_name ?? null, role: 'owner' })
          if (mErr) console.error('[voix/admin] owner insert failed:', mErr.message)
        }
        await supabase
          .from('voix_pilot_requests')
          .update({ status: 'set_up', account_id: account.id, updated_at: new Date().toISOString() })
          .eq('id', req.id)
        return NextResponse.json({ ok: true, id: account.id })
      }
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
  } catch (err) {
    console.error('[voix/admin] failed:', err)
    const message = err && typeof err === 'object' && 'message' in err ? String((err as { message: unknown }).message) : 'Failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
