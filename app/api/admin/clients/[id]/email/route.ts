import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendTransactionalEmail } from '@/lib/email/sendTransactionalEmail'
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
    await sendTransactionalEmail({
      to: client.email,
      subject,
      title: subject,
      body,
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
