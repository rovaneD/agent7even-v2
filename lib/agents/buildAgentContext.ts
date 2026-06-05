import { createServiceClient } from '@/lib/supabase/server'
import { loadFoundationContext, loadFoundationMemory, formatMemoryForAgent } from './loadFoundationContext'

export async function buildAgentContext(userId: string): Promise<string> {
  const supabase = createServiceClient()

  // Brand context + Foundation run in parallel.
  // loadFoundationContext queries profiles.foundation_answers + foundation_documents.
  // profileId = userId here (both are the Supabase profiles.id UUID).
  const [
    { data: docs },
    { data: profile },
    { data: brandAnswers },
    foundation,
    memory,
  ] = await Promise.all([
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

    loadFoundationContext(userId),
    loadFoundationMemory(userId),
  ])

  if (!docs?.length && !profile && !foundation.hasFoundation) return ''

  const p = profile as Record<string, unknown> | null

  const sections: string[] = [
    `## Client: ${p?.company_name ?? 'Unknown'}`,
    p?.business_type    ? `**Business type:** ${p.business_type}`  : '',
    p?.website_url      ? `**Website:** ${p.website_url}`          : '',
    p?.instagram_handle ? `**Instagram:** @${p.instagram_handle}`  : '',
  ]

  // Competitors — from foundation_answers.competitors freetext (not the null profiles.competitors array)
  if (foundation.competitorsFreetext) {
    sections.push(`\n## Competitors\n${foundation.competitorsFreetext}`)
  }

  // Brand documents (voice guide, positioning, persona, story)
  for (const doc of docs ?? []) {
    if (doc.content) {
      const label = doc.type.charAt(0).toUpperCase() + doc.type.slice(1)
      sections.push(`\n## Brand ${label}\n${doc.content}`)
    }
  }

  // Brand Q&A answers
  if (brandAnswers?.answers && typeof brandAnswers.answers === 'object') {
    const raw = brandAnswers.answers as Record<string, unknown>
    const extras = Object.entries(raw)
      .filter(([, v]) => v && String(v).trim().length > 0)
      .map(([k, v]) => `- **${k}:** ${v}`)
    if (extras.length) {
      sections.push(`\n## Brand Answers\n${extras.join('\n')}`)
    }
  }

  // Foundation — documents are canonical; answers are the fallback while generate is unfixed.
  const { documents, answers } = foundation
  const hasGeneratedDocs = Object.values(documents).some(v => v.length > 0)

  if (hasGeneratedDocs) {
    if (documents.brief)       sections.push(`\n## Foundation: Business Brief\n${documents.brief}`)
    if (documents.icp)         sections.push(`\n## Foundation: Ideal Customer Profile\n${documents.icp}`)
    if (documents.positioning) sections.push(`\n## Foundation: Positioning\n${documents.positioning}`)
    if (documents.voice)       sections.push(`\n## Foundation: Brand Voice\n${documents.voice}`)
    if (documents.plan)        sections.push(`\n## Foundation: 30-Day Plan\n${documents.plan}`)
  } else if (foundation.hasFoundation) {
    // Temporary fallback: render raw Foundation answers until generate produces documents
    const answerLines = [
      answers.businessDescription && `**What they do:** ${answers.businessDescription}`,
      answers.problemSolved       && `**Problem solved:** ${answers.problemSolved}`,
      answers.transformation      && `**Transformation:** ${answers.transformation}`,
      answers.customerWho         && `**Ideal customer:** ${answers.customerWho}`,
      answers.customerFrustration && `**Customer frustration:** ${answers.customerFrustration}`,
      answers.differentiator      && `**Differentiator:** ${answers.differentiator}`,
      answers.differentiatorOwn   && `**In their words:** ${answers.differentiatorOwn}`,
      answers.toneTraits          && `**Tone:** ${answers.toneTraits}`,
      answers.monthlyGoal         && `**Goal this month:** ${answers.monthlyGoal}`,
    ].filter(Boolean)
    if (answerLines.length) {
      sections.push(`\n## Foundation Answers (documents pending)\n${answerLines.join('\n')}`)
    }
  }

  const memorySection = formatMemoryForAgent(memory)
  if (memorySection) sections.push(`\n${memorySection}`)

  return sections.filter(Boolean).join('\n')
}
