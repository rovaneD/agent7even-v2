import { loadFoundationContext } from '@/lib/agents/loadFoundationContext'

/** Phase 1 markdown bundle — Guardian's only reference frame. */
export async function loadPhase1Bundle(profileId: string): Promise<string> {
  const foundation = await loadFoundationContext(profileId)
  const { documents, answers, hasFoundation } = foundation

  const sections: string[] = [
    '# Phase 1 — Guarded Bedrock (read-only reference frame)',
    'Guardian must check every candidate against this text only. Never treat Observer suggestions as Phase 1 updates.',
  ]

  const hasDocs = Object.values(documents).some(v => v.length > 0)

  if (hasDocs) {
    if (documents.brief) sections.push(`## Business Brief\n${documents.brief}`)
    if (documents.icp) sections.push(`## Ideal Customer Profile\n${documents.icp}`)
    if (documents.positioning) sections.push(`## Positioning\n${documents.positioning}`)
    if (documents.voice) sections.push(`## Brand Voice\n${documents.voice}`)
    if (documents.plan) sections.push(`## 30-Day Plan\n${documents.plan}`)
  } else if (hasFoundation) {
    const lines = [
      answers.businessDescription && `**Business:** ${answers.businessDescription}`,
      answers.customerWho && `**Ideal customer:** ${answers.customerWho}`,
      answers.customerFrustration && `**Customer frustration:** ${answers.customerFrustration}`,
      answers.differentiator && `**Differentiator:** ${answers.differentiator}`,
      answers.differentiatorOwn && `**In their words:** ${answers.differentiatorOwn}`,
      answers.toneTraits && `**Tone:** ${answers.toneTraits}`,
      answers.monthlyGoal && `**Monthly goal:** ${answers.monthlyGoal}`,
    ].filter(Boolean)
    sections.push(`## Foundation Answers\n${lines.join('\n')}`)
  } else {
    sections.push('## (No Phase 1 content found for this profile)')
  }

  return sections.join('\n\n')
}
