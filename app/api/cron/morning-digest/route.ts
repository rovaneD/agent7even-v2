import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getResendClient } from '@/lib/resend'

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const today = new Date().toISOString().split('T')[0]

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, email, company_name')
    .in('plan', ['starter', 'growth', 'proagent'])
    .eq('status', 'active')
    .eq('email_digest', true)

  if (!profiles?.length) return NextResponse.json({ sent: 0 })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.agent7even.com'
  let sent = 0

  for (const profile of profiles) {
    if (!profile.email) continue

    // Fetch or generate today's digest
    let { data: digestData } = await supabase
      .from('daily_digests')
      .select('*')
      .eq('user_id', profile.id)
      .eq('date', today)
      .single()

    if (!digestData) {
      try {
        const res = await fetch(`${appUrl}/api/digest/generate`, {
          method:  'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization:  `Bearer ${process.env.CRON_SECRET}`,
          },
          body:    JSON.stringify({ profileId: profile.id }),
        })
        const { digestId } = await res.json()
        if (digestId) {
          const { data } = await supabase
            .from('daily_digests')
            .select('*')
            .eq('id', digestId)
            .single()
          digestData = data
        }
      } catch (err) {
        console.error(`Failed to generate digest for ${profile.email}:`, err)
        continue
      }
    }

    if (!digestData) continue
    if (digestData.email_sent) continue

    const hasContent =
      (digestData.agent_runs?.length  ?? 0) > 0 ||
      (digestData.approvals?.length   ?? 0) > 0 ||
      (digestData.today_actions?.length ?? 0) > 0

    if (!hasContent) continue

    const firstName = profile.full_name?.split(' ')[0] ?? 'there'

    try {
      const resend = getResendClient()
      if (!resend) throw new Error('Missing RESEND_API_KEY')

      await resend.emails.send({
        from:    'Maya <maya@agent7even.com>',
        to:      profile.email,
        subject: buildSubject(digestData),
        html:    buildEmailHtml(digestData, firstName, appUrl),
      })

      await supabase
        .from('daily_digests')
        .update({ email_sent: true, email_sent_at: new Date().toISOString() })
        .eq('id', digestData.id)

      sent++
    } catch (err) {
      console.error(`Failed to send digest to ${profile.email}:`, err)
    }
  }

  return NextResponse.json({ sent })
}

function buildSubject(digest: Record<string, unknown>): string {
  const approvalCount = (digest.approvals as unknown[])?.length ?? 0
  const runCount      = (digest.agent_runs as unknown[])?.length ?? 0
  if (approvalCount > 0) return `${approvalCount} item${approvalCount > 1 ? 's' : ''} waiting for your approval`
  if (runCount > 0)      return `Here's what Maya did overnight`
  return `Your marketing plan for today`
}

function buildEmailHtml(digest: Record<string, unknown>, firstName: string, appUrl: string): string {
  const agentRuns = (digest.agent_runs  as Array<Record<string, string>>) ?? []
  const approvals = (digest.approvals   as Array<Record<string, string>>) ?? []
  const actions   = (digest.today_actions as Array<Record<string, string>>) ?? []

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f5f4f0;margin:0;padding:24px}
    .container{max-width:560px;margin:0 auto;background:#fff;border-radius:16px;padding:32px}
    .logo{font-weight:700;font-size:16px;letter-spacing:-.5px;color:#111;margin-bottom:24px}
    .logo span{color:#c8522a}
    h2{font-size:20px;font-weight:600;color:#111;margin:0 0 8px}
    p{font-size:14px;color:#6b7280;margin:0 0 24px;line-height:1.5}
    .label{font-size:11px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:.08em;margin-bottom:12px}
    .item{padding:12px 0;border-bottom:1px solid #f3f4f6}
    .item:last-child{border-bottom:none}
    .item-sub{font-size:12px;color:#9ca3af;margin-bottom:4px}
    .item-text{font-size:14px;color:#111}
    .approval-box{background:#f9fafb;border-radius:12px;padding:16px;margin-bottom:12px}
    .approval-preview{font-size:13px;color:#374151;margin:8px 0 12px}
    .btn{display:inline-block;padding:10px 20px;border-radius:8px;font-size:13px;font-weight:500;text-decoration:none}
    .btn-black{background:#111;color:#fff}
    .cta{text-align:center;margin-top:32px;padding-top:24px;border-top:1px solid #f3f4f6}
    .footer{text-align:center;margin-top:24px;font-size:12px;color:#9ca3af}
    a.footer-link{color:#9ca3af}
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">AGENT<span>7</span>EVEN</div>
    <h2>Good morning, ${firstName}.</h2>
    <p>Here's what Maya did overnight and what's on your plate today.</p>

    ${agentRuns.length > 0 ? `
    <div class="label">What I did</div>
    ${agentRuns.map(run => `
      <div class="item">
        <div class="item-sub">${run.agentName}</div>
        <div class="item-text">${run.summary}</div>
      </div>`).join('')}
    <br>` : ''}

    ${approvals.length > 0 ? `
    <div class="label">What needs you (${approvals.length} item${approvals.length > 1 ? 's' : ''})</div>
    ${approvals.map(item => `
      <div class="approval-box">
        <div class="item-sub">${item.agentName}</div>
        <div class="approval-preview">${item.preview}${(item.preview ?? '').length >= 150 ? '…' : ''}</div>
        <a href="${appUrl}/dashboard/agents?task=${item.taskId}" class="btn btn-black">Review →</a>
      </div>`).join('')}
    <br>` : ''}

    ${actions.length > 0 ? `
    <div class="label">Today's plan</div>
    ${actions.map(action => `
      <div class="item">
        <div class="item-sub">${action.campaignTitle} · ${action.channel}</div>
        <div class="item-text">${action.task}</div>
      </div>`).join('')}
    <br>` : ''}

    <div class="cta">
      <a href="${appUrl}/dashboard" class="btn btn-black">Open Maya →</a>
    </div>

    <div class="footer">
      Agent7even · You're receiving this because you have an active Maya account.<br>
      <a href="${appUrl}/dashboard/settings" class="footer-link">Manage email preferences</a>
    </div>
  </div>
</body>
</html>`
}
