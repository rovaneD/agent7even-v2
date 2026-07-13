import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { resolveClerkProfile } from '@/lib/profiles/resolveClerkProfile'
import { createNotification } from '@/lib/createNotification'
import { getNotifyEmail } from '@/lib/getNotifyEmail'
import { sendTransactionalEmail } from '@/lib/email/sendTransactionalEmail'

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

  const profile = await resolveClerkProfile<{
    id: string
    email: string | null
    full_name: string | null
    company_name: string | null
    stripe_customer_id: string | null
    stripe_subscription_id: string | null
    plan: string | null
    created_at: string
  }>(supabase, userId, 'id, email, full_name, company_name')

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
  const notifyEmail = await getNotifyEmail()

  const inquiryBody = [
    `Client: ${profile.full_name} — ${profile.company_name ?? ''}`,
    `Email: ${profile.email}`,
    `Service: ${serviceLabel}`,
    `Project: ${projectName}`,
    `Timeline: ${timeline ?? 'Not specified'}`,
    `Budget: ${budgetRange ?? 'Not specified'}`,
    '',
    'Description:',
    description,
    ...(additionalNotes ? ['', 'Additional notes:', additionalNotes] : []),
  ].join('\n')

  // Email admin
  try {
    await sendTransactionalEmail({
      to: notifyEmail,
      subject: `New project inquiry — ${projectName} (${serviceLabel})`,
      title: 'New project inquiry',
      body: inquiryBody,
      link: `/admin/inquiries/${inquiry.id}`,
      ctaLabel: 'View inquiry →',
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
