import type { FormFieldSchema } from '@/lib/maya/formActuation'

type EditField = {
  key: string
  label: string
  type: 'textarea' | 'text' | 'chips' | 'competitors'
}

type SectionLike = {
  key: string
  editFields: EditField[]
}

export function buildHubFormSurfaceSchema(
  sections: SectionLike[],
  options?: { includeWebsite?: boolean },
): FormFieldSchema[] {
  const fields: FormFieldSchema[] = []
  if (options?.includeWebsite) {
    fields.push({ key: 'websiteUrl', label: 'Website URL', type: 'text' })
  }
  for (const section of sections) {
    for (const field of section.editFields) {
      if (field.type === 'competitors') {
        fields.push(
          { key: 'competitors_0', label: 'Competitor 1', type: 'textarea' },
          { key: 'competitors_1', label: 'Competitor 2', type: 'textarea' },
          { key: 'competitors_2', label: 'Competitor 3', type: 'textarea' },
        )
      } else {
        fields.push({
          key: field.key,
          label: field.label,
          type: field.type === 'text' ? 'text' : field.type === 'chips' ? 'text' : 'textarea',
        })
      }
    }
  }
  return fields
}

export function hubFormValuesFromAnswers(
  answers: Record<string, unknown>,
  sections: SectionLike[],
  websiteUrl?: string | null,
): Record<string, string> {
  const values: Record<string, string> = {}
  if (websiteUrl != null) values.websiteUrl = websiteUrl

  for (const section of sections) {
    for (const field of section.editFields) {
      const val = answers[field.key]
      if (field.type === 'competitors') {
        const comps = Array.isArray(val) ? val.map(v => String(v ?? '').trim()) : ['', '', '']
        values.competitors_0 = comps[0] ?? ''
        values.competitors_1 = comps[1] ?? ''
        values.competitors_2 = comps[2] ?? ''
      } else if (field.type === 'chips') {
        values[field.key] = Array.isArray(val) ? val.join(', ') : String(val ?? '')
      } else {
        values[field.key] = String(val ?? '')
      }
    }
  }
  return values
}

/** Map patch keys → partial answers object + section keys that need doc regen. */
export function applyHubFormPatch(
  answers: Record<string, unknown>,
  patch: Record<string, string>,
  sections: SectionLike[],
): {
  nextAnswers: Record<string, unknown>
  partialSave: Record<string, unknown>
  affectedSectionKeys: string[]
} {
  const nextAnswers: Record<string, unknown> = { ...answers }
  const partialSave: Record<string, unknown> = {}
  const affected = new Set<string>()

  const fieldToSection = new Map<string, string>()
  for (const section of sections) {
    for (const field of section.editFields) {
      if (field.type === 'competitors') {
        fieldToSection.set('competitors_0', section.key)
        fieldToSection.set('competitors_1', section.key)
        fieldToSection.set('competitors_2', section.key)
      } else {
        fieldToSection.set(field.key, section.key)
      }
    }
  }

  for (const [key, raw] of Object.entries(patch)) {
    const sectionKey = fieldToSection.get(key)
    if (!sectionKey) continue

    if (key.startsWith('competitors_')) {
      const current = Array.isArray(nextAnswers.competitors)
        ? [...(nextAnswers.competitors as string[])]
        : ['', '', '']
      while (current.length < 3) current.push('')
      const idx = Number(key.replace('competitors_', ''))
      if (idx >= 0 && idx <= 2) current[idx] = raw
      nextAnswers.competitors = current
      partialSave.competitors = current
      affected.add(sectionKey)
      continue
    }

    const fieldDef = sections
      .flatMap(s => s.editFields.map(f => ({ section: s.key, field: f })))
      .find(row => row.field.key === key)?.field

    if (fieldDef?.type === 'chips') {
      const chips = raw.split(',').map(s => s.trim()).filter(Boolean)
      nextAnswers[key] = chips
      partialSave[key] = chips
    } else {
      nextAnswers[key] = raw
      partialSave[key] = raw
    }
    affected.add(sectionKey)
  }

  return {
    nextAnswers,
    partialSave,
    affectedSectionKeys: [...affected],
  }
}

export function sectionKeysForAffectedDocs(
  sections: Array<{ key: string; affectedDocs: string[] }>,
  affectedSectionKeys: string[],
): string[] {
  return affectedSectionKeys.filter(key =>
    sections.some(s => s.key === key && s.affectedDocs.length > 0),
  )
}
