import { OUTCOME_LABELS, OUTCOME_TONE, type VoixOutcome } from '@/lib/voix/types'

export default function OutcomeBadge({ outcome, status }: { outcome: VoixOutcome | null; status?: string }) {
  if (!outcome) {
    return (
      <span className="inline-flex items-center rounded-full bg-[#F2F3F6] px-2.5 py-0.5 text-xs font-medium text-[#5B6070]">
        {status === 'ongoing' ? 'Live now' : 'Processing'}
      </span>
    )
  }
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${OUTCOME_TONE[outcome]}`}>
      {OUTCOME_LABELS[outcome]}
    </span>
  )
}
