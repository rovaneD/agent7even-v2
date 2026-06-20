import { loadFoundationContext } from '@/lib/agents/loadFoundationContext'

/** Brand tokens expected to appear correctly in generated image text. */
export async function loadBrandTokensForQa(
  profileId: string,
  companyName: string | null,
): Promise<string[]> {
  const ctx = await loadFoundationContext(profileId)
  const tokens = new Set<string>()

  const add = (value: string | undefined | null) => {
    const v = value?.trim()
    if (!v || v.length < 2) return
    tokens.add(v)
  }

  add(companyName)
  add(ctx.answers.businessName)
  add(ctx.answers.brandName)
  add(ctx.answers.company)

  return [...tokens]
}
