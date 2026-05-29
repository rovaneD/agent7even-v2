import { createServiceClient } from '@/lib/supabase/server'

export async function buildAgentContext(userId: string): Promise<string> {
  const supabase = createServiceClient()

  const [{ data: docs }, { data: profile }, { data: answers }] = await Promise.all([
    supabase
      .from('brand_documents')
      .select('type, content')
      .eq('user_id', userId)
      .in('type', ['voice', 'positioning', 'persona', 'story']),

    supabase
      .from('profiles')
      .select('company_name, business_type, website_url, instagram_handle')
      .eq('id', userId)
      .single(),

    supabase
      .from('brand_answers')
      .select('answers')
      .eq('user_id', userId)
      .single(),
  ])

  if (!docs?.length && !profile) return ''

  const sections: string[] = [
    `## Client: ${profile?.company_name ?? 'Unknown'}`,
    profile?.business_type ? `**Business type:** ${profile.business_type}` : '',
    profile?.website_url ? `**Website:** ${profile.website_url}` : '',
    profile?.instagram_handle ? `**Instagram:** @${profile.instagram_handle}` : '',
  ]

  for (const doc of docs ?? []) {
    if (doc.content) {
      const label = doc.type.charAt(0).toUpperCase() + doc.type.slice(1)
      sections.push(`\n## Brand ${label}\n${doc.content}`)
    }
  }

  // Surface any additional brand answers not already covered by documents
  if (answers?.answers && typeof answers.answers === 'object') {
    const raw = answers.answers as Record<string, unknown>
    const extras = Object.entries(raw)
      .filter(([, v]) => v && String(v).trim().length > 0)
      .map(([k, v]) => `- **${k}:** ${v}`)
    if (extras.length) {
      sections.push(`\n## Brand Answers\n${extras.join('\n')}`)
    }
  }

  return sections.filter(Boolean).join('\n')
}
