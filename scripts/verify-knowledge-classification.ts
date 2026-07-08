/**
 * Smoke test for knowledge URL heuristics (no API keys required).
 *
 * Usage: npx --yes tsx scripts/verify-knowledge-classification.ts
 */
import { classifyKnowledgeSource } from '../lib/foundation/classifyKnowledge'

async function main() {
  const cases: Array<{
    name: string
    type: string
    source: string
    ownerSite: string
    expect: string
  }> = [
    {
      name: 'Own website URL',
      type: 'url',
      source: 'https://agent7even.ai/about',
      ownerSite: 'https://agent7even.ai',
      expect: 'own_business',
    },
    {
      name: 'External competitor URL',
      type: 'url',
      source: 'https://blaze.ai/pricing',
      ownerSite: 'https://agent7even.ai',
      expect: 'competitor',
    },
  ]

  let passed = 0
  for (const c of cases) {
    const result = await classifyKnowledgeSource('placeholder text for heuristic', c.type, c.source, c.ownerSite)
    const ok = result.purpose === c.expect
    console.log(`${ok ? '✓' : '✗'} ${c.name}: ${result.purpose} (${result.confidence}) — ${result.reason}`)
    if (ok) passed++
  }

  console.log(`\n${passed}/${cases.length} heuristic checks passed`)
  process.exit(passed === cases.length ? 0 : 1)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
