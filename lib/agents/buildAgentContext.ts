import { createServiceClient } from '@/lib/supabase/server'

export async function buildAgentContext(userId: string): Promise<string> {
  const supabase = createServiceClient()

  const [
    { data: docs },
    { data: profile },
    { data: answers },
    { data: foundationDocs },
  ] = await Promise.all([
    supabase
      .from('brand_documents')
      .select('type, content')
      .eq('user_id', userId)
      .in('type', ['voice', 'positioning', 'persona', 'story']),

    supabase
      .from('profiles')
      .select('company_name, business_type, website_url, instagram_handle, competitors')
      .eq('id', userId)
      .single(),

    supabase
      .from('brand_answers')
      .select('answers')
      .eq('user_id', userId)
      .single(),

    supabase
      .from('foundation_documents')
      .select('type, title, markdown')
      .eq('user_id', userId)
      .in('type', ['brief', 'icp', 'positioning', 'voice', 'plan']),
  ])

  if (!docs?.length && !profile) return ''

  const p = profile as Record<string, unknown> | null

  const sections: string[] = [
    `## Client: ${p?.company_name ?? 'Unknown'}`,
    p?.business_type    ? `**Business type:** ${p.business_type}`    : '',
    p?.website_url      ? `**Website:** ${p.website_url}`            : '',
    p?.instagram_handle ? `**Instagram:** @${p.instagram_handle}`    : '',
  ]

  const competitors = p?.competitors as string[] | null
  if (competitors?.length) {
    sections.push(`\n## Competitors\n${competitors.map(c => `- ${c}`).join('\n')}`)
  }

  for (const doc of docs ?? []) {
    if (doc.content) {
      const label = doc.type.charAt(0).toUpperCase() + doc.type.slice(1)
      sections.push(`\n## Brand ${label}\n${doc.content}`)
    }
  }

  if (answers?.answers && typeof answers.answers === 'object') {
    const raw = answers.answers as Record<string, unknown>
    const extras = Object.entries(raw)
      .filter(([, v]) => v && String(v).trim().length > 0)
      .map(([k, v]) => `- **${k}:** ${v}`)
    if (extras.length) {
      sections.push(`\n## Brand Answers\n${extras.join('\n')}`)
    }
  }

  // Foundation documents — generated from Foundation setup flow
  for (const doc of foundationDocs ?? []) {
    if (doc.markdown?.trim()) {
      sections.push(`\n## Foundation: ${doc.title}\n${doc.markdown}`)
    }
  }

  return sections.filter(Boolean).join('\n')
}
