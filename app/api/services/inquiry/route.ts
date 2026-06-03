import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createNotification } from '@/lib/createNotification'
import { getNotifyEmail } from '@/lib/getNotifyEmail'
import { getResendClient } from '@/lib/resend'

const SERVICE_TYPE_LABELS: Record<string, string> = {
  uiux: 'UI/UX Design',
  mobile_app: 'Mobile App Development',
  custom_dev: 'Custom Design & Development',
}

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const {
    serviceType,
    projectName,
    description,
    platforms,
    hasExistingBrand,
    hasExistingDesigns,
    timeline,
    budgetRange,
    additionalNotes,
  } = await req.json()

  if (!serviceType || !projectName || !description) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const supabase = createServiceClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, full_name, company_name')
    .eq('clerk_user_id', userId)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  // Save inquiry
  const { data: inquiry, error } = await supabase
    .from('project_inquiries')
    .insert({
      user_id: profile.id,
      service_type: serviceType,
      project_name: projectName,
      description,
      platform: platforms ?? [],
      has_existing_brand: hasExistingBrand,
      has_existing_designs: hasExistingDesigns,
      timeline: timeline ?? null,
      budget_range: budgetRange ?? null,
      additional_notes: additionalNotes ?? null,
      status: 'new',
    })
    .select()
    .single()

  if (error) {
    console.error('Inquiry insert error:', error)
    return NextResponse.json({ error: 'Failed to submit inquiry' }, { status: 500 })
  }

  const serviceLabel = SERVICE_TYPE_LABELS[serviceType] ?? serviceType
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.agent7even.com'
  const notifyEmail = await getNotifyEmail()

  // Email admin
  try {
    const resend = getResendClient()
    if (!resend) throw new Error('Missing RESEND_API_KEY')

    await resend.emails.send({
      from: 'Agent7even <hello@agent7even.com>',
      to: notifyEmail,
      subject: `New project inquiry — ${projectName} (${serviceLabel})`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #c8522a;">New Project Inquiry</h2>
          <p><strong>Client:</strong> ${profile.full_name} — ${profile.company_name ?? ''}</p>
          <p><strong>Email:</strong> ${profile.email}</p>
          <p><strong>Service:</strong> ${serviceLabel}</p>
          <p><strong>Project:</strong> ${projectName}</p>
          <p><strong>Timeline:</strong> ${timeline ?? 'Not specified'}</p>
          <p><strong>Budget:</strong> ${budgetRange ?? 'Not specified'}</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 16px 0;" />
          <p><strong>Description:</strong></p>
          <p style="color: #444;">${description}</p>
          ${additionalNotes ? `<p><strong>Additional notes:</strong></p><p style="color: #444;">${additionalNotes}</p>` : ''}
          <hr style="border: none; border-top: 1px solid #eee; margin: 16px 0;" />
          <a href="${appUrl}/admin/inquiries/${inquiry.id}" style="background: #c8522a; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
            View inquiry →
          </a>
        </div>
      `,
    })
  } catch (err) {
    console.error('Inquiry email failed:', err)
  }

  // Fetch admin profile for notification
  const { data: adminProfile } = await supabase
    .from('profiles')
    .select('id')
    .in('role', ['admin', 'owner'])
    .limit(1)
    .single()

  if (adminProfile) {
    await createNotification({
      userId: adminProfile.id,
      title: `New project inquiry — ${serviceLabel}`,
      body: `${profile.company_name ?? profile.full_name} submitted a project inquiry for ${projectName}.`,
      type: 'order_status',
      link: `/admin/inquiries/${inquiry.id}`,
      sendEmail: false,
    })
  }

  return NextResponse.json({ inquiry })
}
