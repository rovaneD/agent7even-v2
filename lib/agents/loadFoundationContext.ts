import { createServiceClient } from '@/lib/supabase/server'

export interface FoundationContext {
  // Raw Foundation answers from profiles.foundation_answers JSONB.
  // Primary source when foundation_documents haven't been generated yet.
  answers: Record<string, string>

  // Generated Foundation documents — canonical when present (per MAYA_CONTEXT).
  // Documents win over answers when both exist.
  documents: {
    brief:       string
    icp:         string
    positioning: string
    voice:       string
    plan:        string
  }

  // Competitor info from answers.competitors freetext.
  // NOT profiles.competitors — that array is null for most accounts.
  // Answers-sourced until generate is fixed; documents layer richer context on top.
  competitorsFreetext: string

  // True when answers OR documents contain any content.
  // Do NOT derive this from profiles.foundation_complete — that flag is unreliable
  // (can be true with 0 foundation_documents rows).
  hasFoundation: boolean
}

export async function loadFoundationContext(profileId: string): Promise<FoundationContext> {
  const supabase = createServiceClient()

  const [{ data: profileRow }, { data: docRows }] = await Promise.all([
    supabase
      .from('profiles')
      .select('foundation_answers')
      .eq('id', profileId)
      .single(),

    supabase
      .from('foundation_documents')
      .select('type, markdown')
      .eq('user_id', profileId),
  ])

  // Parse JSONB answers — coerce all values to strings; arrays join as CSV.
  const rawAnswers = (profileRow?.foundation_answers ?? {}) as Record<string, unknown>
  const answers: Record<string, string> = {}
  for (const [k, v] of Object.entries(rawAnswers)) {
    if (v != null) {
      answers[k] = Array.isArray(v)
        ? (v as unknown[]).filter(Boolean).join(', ')
        : String(v).trim()
    }
  }

  // Documents are canonical — answers are the temporary fallback while generate is unfixed.
  const documents = {
    brief:       docRows?.find(d => d.type === 'brief')?.markdown       ?? '',
    icp:         docRows?.find(d => d.type === 'icp')?.markdown         ?? '',
    positioning: docRows?.find(d => d.type === 'positioning')?.markdown ?? '',
    voice:       docRows?.find(d => d.type === 'voice')?.markdown       ?? '',
    plan:        docRows?.find(d => d.type === 'plan')?.markdown        ?? '',
  }

  const competitorsFreetext = (answers.competitors ?? '').trim()

  const hasFoundation =
    Object.values(answers).some(v => v.length > 0) ||
    Object.values(documents).some(v => v.length > 0)

  return { answers, documents, competitorsFreetext, hasFoundation }
}
