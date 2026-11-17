import type { SupabaseClient } from '@supabase/supabase-js'
import type { VoixFollowupReason, VoixOutcome, VoixTranscriptTurn } from '@/lib/voix/types'

/**
 * Sample calls so a spa (or we) can see the dashboard before real calls arrive.
 * All numbers use the 555-01xx fictional range. Rows are flagged is_sample and
 * can be removed in one click from the admin page.
 */
type Sample = {
  hoursAgo: number
  durationSec: number
  callerName: string | null
  from: string
  outcome: VoixOutcome
  urgent?: boolean
  interest?: string
  summary: string
  followup?: VoixFollowupReason
  turns: [string, string][] // [role, text]
}

const SAMPLES: Sample[] = [
  {
    hoursAgo: 1.2,
    durationSec: 142,
    callerName: 'Jenna Morales',
    from: '+13105550142',
    outcome: 'booked',
    interest: 'Botox consult',
    summary: 'New client booked a Botox consultation for Thursday at 4:30pm with Dr. Lee. Asked about the new-client special.',
    turns: [
      ['agent', 'Thanks for calling Lumen Aesthetics, this is the virtual front desk. How can I help?'],
      ['user', "Hi, I'd like to come in for Botox. I've never been to you before."],
      ['agent', 'Welcome! First visits start with a quick consult. Would Thursday at 4:30 with Dr. Lee work?'],
      ['user', 'That works. Is the new-client special still on?'],
      ['agent', "It is — $50 off your first treatment. You're booked for Thursday at 4:30. I'll text you a confirmation now."],
    ],
  },
  {
    hoursAgo: 3.5,
    durationSec: 96,
    callerName: 'Priya Shah',
    from: '+13105550177',
    outcome: 'clinical',
    urgent: true,
    interest: 'Filler follow-up',
    summary:
      'Client had lip filler 2 days ago and reports more swelling on one side. Voix did not give medical advice and promised a provider callback within the hour.',
    followup: 'clinical',
    turns: [
      ['agent', 'Thanks for calling Lumen Aesthetics. How can I help?'],
      ['user', 'I got lip filler on Saturday and one side is a lot more swollen today. Is that normal?'],
      ['agent', "I'm not able to give medical advice, but I want a provider to look at this. Is the swelling getting worse, or do you have trouble breathing?"],
      ['user', "No, nothing like that, it's just uneven."],
      ['agent', "Thank you. I've flagged this as urgent and a provider will call you back within the hour. If anything gets worse, call 911 or go to the ER."],
    ],
  },
  {
    hoursAgo: 9,
    durationSec: 64,
    callerName: null,
    from: '+14245550109',
    outcome: 'question_answered',
    interest: 'HydraFacial',
    summary: 'Caller asked about HydraFacial pricing and Saturday hours. Voix gave the approved price ($199) and hours (9am–3pm).',
    turns: [
      ['user', 'How much is a HydraFacial and are you open Saturday?'],
      ['agent', 'A signature HydraFacial is $199, and on Saturdays we are open 9am to 3pm. Would you like me to book one?'],
      ['user', "Not yet, I'll call back. Thanks."],
    ],
  },
  {
    hoursAgo: 22,
    durationSec: 118,
    callerName: 'Mark Chen',
    from: '+13235550163',
    outcome: 'callback_needed',
    interest: 'Laser hair removal package',
    summary: 'Asked if the 6-session laser package can be split across two people (him and his wife). Not in the approved answers, so Voix promised a callback.',
    followup: 'callback_needed',
    turns: [
      ['user', 'Can my wife and I share one of the six-session laser packages?'],
      ['agent', "Good question — I don't have an approved answer for sharing packages. I'll have someone from the team call you back today."],
      ['user', 'Great, this number is fine.'],
    ],
  },
  {
    hoursAgo: 26,
    durationSec: 71,
    callerName: 'Alyssa Grant',
    from: '+13105550118',
    outcome: 'rescheduled',
    interest: 'Microneedling',
    summary: 'Moved her microneedling appointment from Friday 11am to Monday 2pm.',
    turns: [
      ['user', 'I need to move my microneedling on Friday.'],
      ['agent', 'No problem. I have Monday at 2pm or Tuesday at 10am.'],
      ['user', 'Monday at 2.'],
      ['agent', "Done — you're now Monday at 2pm. I'll text you the update."],
    ],
  },
  {
    hoursAgo: 30,
    durationSec: 6,
    callerName: null,
    from: '+18185550190',
    outcome: 'hang_up',
    summary: 'Caller hung up during the greeting.',
    turns: [['agent', 'Thanks for calling Lumen Aesthetics, this is the virtual front desk—']],
  },
  {
    hoursAgo: 47,
    durationSec: 133,
    callerName: 'Dana Ruiz',
    from: '+13105550151',
    outcome: 'complaint',
    interest: 'Chemical peel',
    summary: 'Unhappy that her peel appointment started 25 minutes late last week. Wants to speak with the manager.',
    followup: 'complaint',
    turns: [
      ['user', 'I waited almost half an hour for my peel last week and nobody apologized.'],
      ['agent', "I'm really sorry about that wait. I'll pass this to the manager and ask them to call you personally. Is this the best number?"],
      ['user', 'Yes.'],
    ],
  },
  {
    hoursAgo: 52,
    durationSec: 39,
    callerName: null,
    from: '+12135550199',
    outcome: 'spam',
    summary: 'Robocall offering business loans.',
    turns: [['user', 'This is a message about your business funding eligibility…']],
  },
]

export async function addSampleCalls(supabase: SupabaseClient, account: { id: string; retell_agent_ids: string[] }) {
  const now = Date.now()
  const stamp = now.toString(36)
  for (const [i, s] of SAMPLES.entries()) {
    const started = new Date(now - s.hoursAgo * 3_600_000)
    const turns: VoixTranscriptTurn[] = s.turns.map(([role, content]) => ({ role, content }))
    const { data: call, error } = await supabase
      .from('voix_calls')
      .insert({
        account_id: account.id,
        retell_call_id: `sample_${account.id.slice(0, 8)}_${stamp}_${i}`,
        agent_id: account.retell_agent_ids[0] ?? null,
        direction: 'inbound',
        status: 'analyzed',
        from_number: s.from,
        to_number: null,
        caller_name: s.callerName,
        started_at: started.toISOString(),
        ended_at: new Date(started.getTime() + s.durationSec * 1000).toISOString(),
        duration_sec: s.durationSec,
        transcript: turns.map((t) => `${t.role === 'agent' ? 'Agent' : 'User'}: ${t.content}`).join('\n'),
        transcript_object: turns,
        summary: s.summary,
        outcome: s.outcome,
        urgent: !!s.urgent,
        treatment_interest: s.interest ?? null,
        is_sample: true,
      })
      .select('id')
      .single()
    if (error || !call) throw new Error(`sample insert failed: ${error?.message}`)

    if (s.followup) {
      const { data: f, error: fErr } = await supabase
        .from('voix_followups')
        .insert({
          account_id: account.id,
          call_id: call.id,
          reason: s.followup,
          priority: s.urgent || s.followup === 'clinical' || s.followup === 'complaint' ? 'urgent' : 'normal',
          status: 'open',
          created_at: new Date(started.getTime() + s.durationSec * 1000).toISOString(),
        })
        .select('id')
        .single()
      if (fErr || !f) throw new Error(`sample follow-up insert failed: ${fErr?.message}`)
      await supabase.from('voix_followup_events').insert({
        followup_id: f.id,
        account_id: account.id,
        type: 'created',
        actor_label: 'Voix',
        created_at: new Date(started.getTime() + s.durationSec * 1000).toISOString(),
      })
    }
  }
  return SAMPLES.length
}

/** Follow-ups and their events cascade with the calls. */
export async function removeSampleCalls(supabase: SupabaseClient, accountId: string) {
  const { error, count } = await supabase
    .from('voix_calls')
    .delete({ count: 'exact' })
    .eq('account_id', accountId)
    .eq('is_sample', true)
  if (error) throw new Error(error.message)
  return count ?? 0
}
