import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getResendClient } from '@/lib/resend'
import { requireAdminApi, adminApiError } from '@/lib/requireAdmin'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAdminApi()
  if ('error' in authResult) return adminApiError(authResult)
  const { admin } = authResult

  const { id } = await params
  const { subject, body } = await req.json()

  if (!subject || !body) {
    return NextResponse.json({ error: 'Subject and body required' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { data: client } = await supabase
    .from('profiles')
    .select('id, email, full_name')
    .eq('id', id)
    .single()

  if (!client?.email) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  try {
    const resend = getResendClient()
    if (!resend) throw new Error('Missing RESEND_API_KEY')

    await resend.emails.send({
      from: 'Agent7even <hello@agent7even.com>',
      to: client.email,
      subject,
      html: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; line-height: 1.6;">
        <p style="white-space: pre-wrap; color: #444;">${body.replace(/\n/g, '<br/>')}</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
        <p style="font-size: 12px; color: #999;">Agent7even · app.agent7even.com</p>
      </div>`,
    })
  } catch (err) {
    console.error('Email send failed:', err)
    return NextResponse.json({ error: 'Email send failed' }, { status: 500 })
  }

  await supabase.from('admin_email_log').insert({
    user_id:  client.id,
    admin_id: admin.id,
    subject,
    body,
  })

  return NextResponse.json({ ok: true })
}
