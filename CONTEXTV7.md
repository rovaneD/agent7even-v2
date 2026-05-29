# CONTEXTV7 — Maya Session Persistence, Edit Mode, Agent Skill Prompts
*Snapshot: May 29, 2026*

## What Changed Since CONTEXTV6

Everything in CONTEXTV6 still applies. This version documents the features built on top of that baseline in this session.

---

## Maya — Session Persistence

Conversations survive page refresh. One session per user, stored in `chat_sessions`.

**New route: `/api/maya/session`**
- `GET` — returns the most recent session (`messages`, `mode`) for the authenticated user
- `POST` — upserts with `onConflict: 'user_id'` — one row per user, always the latest session

**`app/maya/page.tsx` — server-side session fetch**
- Reads `task`, `campaignId`, `edit`, `prior` from `searchParams`
- Only fetches session when `!taskParam && !isEdit` — task and edit sessions always start fresh
- Passes `initialMessages` and `initialMode` to `MayaShell`

**`MayaShell.tsx` — session restoration + save**
- `shouldRestore = !isEdit && !initialPrompt` — gates whether `useChat` is seeded with prior messages
- `useChat` config: `messages: shouldRestore && initialMessages.length ? initialMessages : undefined`
- `messagesRef` — synced via `useEffect`; used in `onFinish` to avoid stale closure (`[...messagesRef.current, message]` captures the just-completed message before state updates)
- `modeRef` — same pattern for mode
- `onFinish` calls `POST /api/maya/session` to save after every assistant reply (skipped in task and edit modes)

---

## Maya — Edit Mode

Users can redo a completed quick win from `/my-campaigns`. Maya acknowledges the prior choice and opens ready to revise.

**URL shape:**
```
/maya?task=<win_text>&campaignId=<id>&edit=true&prior=<prior_selected_option>
```

**`MayaShell.tsx` — init useEffect**
When `isEdit` is true:
- Injects a synthetic assistant message via `setMessages` (no API call) acknowledging the task and prior option
- Sets `canvasState` to `'task'`
- Does not call `sendMessage` — model is only called when the user replies

```ts
const intro = `Looks like you want to revisit this one: **"${initialPrompt}"**
${priorOption
  ? `\n\nLast time you went with:\n\n*"${priorOption.slice(0, 80)}..."*\n\nWhat felt off about it? Or do you want me to generate fresh options in a different direction?`
  : '\n\nWhat would you like to change or improve?'
}`
setMessages([{ id: 'edit-intro', role: 'assistant', parts: [{ type: 'text', text: intro }], createdAt: new Date() }])
```

**`app/api/maya/chat/route.ts` — edit mode system prompt section**
When `isEdit: true` is in the request body:
```
EDIT MODE: The user is revisiting a completed task. Their previous selection was: "<priorOption>".
Acknowledge what they had before. Help them refine or regenerate — do not start from scratch unless they ask.
```

**`app/my-campaigns/CampaignList.tsx` — quick wins**
- `isDone` — checks `c.tasks?.some(t => t.task === win)`
- Done state: shows "Done ✓" label + pencil SVG icon linking to edit URL
- `prior` param populated from `c.tasks.find(t => ...)?.selected_option?.slice(0, 120)`
- Active state: links with `&campaignId=${c.id}` (no edit flag)

---

## Maya — Campaign ID Persistence

Campaign ID now flows cleanly from URL through the entire session.

**`activeCampaignIdRef`** — initialized at mount from `activeCampaignId` prop (URL param). Updated whenever a campaign is created or the task-complete route returns a new ID. `selectOption` reads from this ref, not from state, to avoid stale closures.

**`app/api/maya/task-complete/route.ts`**
Restructured: resolves `targetCampaignId` first (use param if provided, else query most-recent), then fetches tasks, then updates. Previously the logic was tangled.

---

## Maya — Campaign Builder Guard

The campaign builder trigger in `onFinish` no longer fires when:
- `canvasState` is already `'plan'` or `'task'`
- `campaignPlan` is already set

The `__TASK__` system prompt section includes an explicit instruction not to build a campaign plan during task-mode sessions.

---

## Agent System Prompt Pipeline

Agents now receive a fully assembled system prompt from the database — brand context + skill playbook — with no inline prompt strings in route files.

### `lib/agents/buildAgentContext.ts` (new file)
Fetches three tables in parallel:
- `brand_documents` — `voice`, `positioning`, `persona`, `story` types
- `profiles` — `company_name`, `business_type`, `website_url`, `instagram_handle`
- `brand_answers` — raw Q&A answers

Assembles a markdown context string with `## Client:`, `## Brand Voice`, etc. sections. Returns `''` if no data found — callers handle gracefully.

### `lib/agents/runner.ts` — updated `buildSystemPrompt`

**Old signature:** `buildSystemPrompt(userId: string, agentPrompt: string): Promise<string>`
Took an inline prompt string, prepended brand context if available.

**New signature:** `buildSystemPrompt(userId: string, agentId: string): Promise<string>`
Fetches brand context + skill prompt from DB in parallel. Joins with `\n\n---\n\n`. Either can be absent — result is still usable.

New helper also exported: `getAgentSkill(agentId: string): Promise<{ skill_prompt: string } | null>`

### `agent_skills` table
All 9 agents seeded with real, opinionated skill prompts. Use `seed-agent-skills.sql` at project root (idempotent — safe to re-run).

| `agent_id` | Skill prompt focus |
|---|---|
| `competitor_watcher` | Competitive intelligence — report facts, surface one gap, one action |
| `content_writer` | Brand-matched copy — captions, email, ads; multiple labeled variations |
| `campaign_builder` | 30-day action plan — structured sections, platform-specific, no vague advice |
| `analytics_reader` | Data → decisions — headline + 3 signals + diagnosis + one next action |
| `trend_spotter` | Niche trend scout — relevance-scored, with expiry estimates |
| `email_sequence_builder` | Sequences by job type — subject + preview + body + CTA per email |
| `ad_copy_generator` | Direct response — 3+ variations, pain/desire-led, format-specific |
| `seo_scanner` | Effort vs. impact ranked — quick wins first, plain-English fixes |
| `brand_voice_guardian` | Off-brand content flagging — line-level flags with replacements |

### `app/api/agents/run/campaign-builder/route.ts` — updated
Replaced 20-line inline system prompt with:
```ts
const baseSystem = await buildSystemPrompt(input.userId as string, 'campaign_builder')
const system = baseSystem
  + (input.rejection_feedback
    ? `\n\nIMPORTANT — Previous version was rejected with this feedback: "${input.rejection_feedback}". Address this directly in the OVERVIEW before anything else.`
    : '')
```

---

## Profile Props Refactor (MayaShell)

`MayaShell` previously received 10+ individual props for profile fields. Now receives a single `Profile` object:

```ts
interface Profile {
  id?: string
  company_name?: string | null
  full_name?: string | null
  business_type?: string | null
  plan?: string | null
  website_url?: string | null
  instagram_handle?: string | null
  ideal_customer?: string | null
  sell_locations?: string[] | null
  marketing_budget?: string | null
  competitors?: string[] | null
  top_goals?: string[] | null
  marketing_challenge?: string | null
  content_comfort?: string | null
  foundation_complete?: boolean | null
}
```

`page.tsx` passes the whole `profile` object. The local variable inside MayaShell that was previously named `profile` (a computed chat transport object) was renamed to `profileData` to avoid shadowing.

---

## New Files This Session

| File | Purpose |
|---|---|
| `lib/agents/buildAgentContext.ts` | Fetches + assembles brand context markdown for agent system prompts |
| `app/api/maya/session/route.ts` | GET/POST for chat session persistence |
| `seed-agent-skills.sql` | Idempotent seed for all 9 agent skill prompts |

---

## What's NOT Built Yet (Updated Priority Order)

1. **Approval queue UI** — agent outputs pending approval need a proper review UI
2. **Agent scheduling UI** — clients can set frequency/day/hour per agent
3. **Credit top-up** — Stripe checkout for purchasing additional credits mid-month
4. **Orchestration progress UI** — real-time progress as parallel subagents complete
5. **Maya cost tracking** — Maya chat currently bypasses the runner; should log tokens + deduct credits
6. **Agent output history** — full searchable history of outputs per client
7. **Admin panel for `agent_skills`** — currently seeded via SQL; eventually editable in `/admin/settings`
8. **"New campaign" button** — reset mode + chat state to start fresh session
9. **Merge to production** — v2 features validated here before cherry-picking into `agent7even-app`
