export const FIELD_EXPECTATIONS: Record<string, { label: string; minWords: number; weight: number }> = {
  businessDescription:   { label: 'Business description',        minWords: 15, weight: 8  },
  problemSolved:         { label: 'Problem solved',              minWords: 10, weight: 8  },
  transformation:        { label: 'Customer transformation',     minWords: 10, weight: 6  },
  customerWho:           { label: 'Customer description',        minWords: 10, weight: 10 },
  customerFrustration:   { label: 'Customer frustration',        minWords: 10, weight: 10 },
  customerTriedBefore:   { label: 'What they tried before',      minWords: 5,  weight: 6  },
  customerBuyingTrigger: { label: 'Buying trigger',              minWords: 5,  weight: 6  },
  differentiator:        { label: 'Differentiator',              minWords: 1,  weight: 8  },
  differentiatorOwn:     { label: 'Differentiator (own words)',  minWords: 0,  weight: 4  },
  toneTraits:            { label: 'Tone traits',                 minWords: 0,  weight: 6  },
  brandsAdmired:         { label: 'Brands admired',              minWords: 0,  weight: 3  },
  neverSoundLike:        { label: 'Never sound like',            minWords: 0,  weight: 3  },
  marketingBudget:       { label: 'Marketing budget',            minWords: 0,  weight: 6  },
  channels:              { label: 'Channels',                    minWords: 0,  weight: 6  },
  monthlyGoal:           { label: 'Monthly goal',                minWords: 0,  weight: 6  },
  competitors:           { label: 'Competitors',                 minWords: 0,  weight: 4  },
  visualAesthetic:       { label: 'Visual aesthetic',            minWords: 5,  weight: 4  },
  visualCasting:         { label: 'Visual casting',              minWords: 3,  weight: 3  },
  visualHeroSubjects:    { label: 'Hero visual subjects',        minWords: 3,  weight: 4  },
  visualPaletteWords:    { label: 'Palette in words',            minWords: 0,  weight: 2  },
  visualMustNotDepict:   { label: 'Forbidden visuals',           minWords: 0,  weight: 3  },
}

export type FoundationFieldScore = { score: number; feedback: string | null }

/** Merge model output with empty-answer zeros; retain previous scores when model omits a filled field. */
export function mergeScoredFields(
  parsed: Record<string, FoundationFieldScore>,
  answersForScoring: Record<string, string>,
  previous: Record<string, FoundationFieldScore> = {},
): Record<string, FoundationFieldScore> {
  const out: Record<string, FoundationFieldScore> = {}
  for (const key of Object.keys(FIELD_EXPECTATIONS)) {
    if (parsed[key]) {
      out[key] = parsed[key]
      continue
    }
    const answer = answersForScoring[key] ?? ''
    if (!answer.trim()) {
      out[key] = { score: 0, feedback: null }
      continue
    }
    if (previous[key]) {
      out[key] = previous[key]
      continue
    }
    out[key] = { score: 0, feedback: null }
  }
  return out
}

export function topWeakFieldKeys(
  fieldScores: Record<string, FoundationFieldScore>,
  limit = 5,
): string[] {
  return Object.entries(fieldScores)
    .filter(([, row]) => row.score < 70)
    .sort((a, b) => a[1].score - b[1].score)
    .slice(0, limit)
    .map(([key]) => key)
}
