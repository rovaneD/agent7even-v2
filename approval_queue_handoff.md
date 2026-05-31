# Approval Queue — Claude Code Handoff
*Dedicated approval review surface*

Read MAYA_CONTEXT.md and CONTEXTV8.md before starting.
Confirm `git remote -v` shows `agent7even-v2`.

---

## Overview

A focused approval review surface at `/dashboard/agents/approvals`.
Accessible from the morning digest "Review →" link, Agent Command Center,
and a persistent badge in the sidebar when items are pending.

Two interaction modes:
- **One at a time** — expand an item, read the full output, approve or reject
- **Selective bulk** — check multiple items, bulk approve unlocks after at least
  one item has been expanded and reviewed

---

## Part 1 — Schema Addition

```sql
-- Add rejection reason to agent_tasks
ALTER TABLE agent_tasks
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS reviewed_at      timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by      uuid REFERENCES profiles(id);

-- Add feedback type for training signal
ALTER TABLE agent_outputs
  ADD COLUMN IF NOT EXISTS feedback        text,  -- 'approved' | 'rejected' | 'edited'
  ADD COLUMN IF NOT EXISTS feedback_note   text,  -- optional rejection reason
  ADD COLUMN IF NOT EXISTS feedback_at     timestamptz;
```

---

## Part 2 — Approval Queue Page

Create `app/dashboard/agents/approvals/page.tsx`.

### Page header

```tsx
<div className="mb-6">
  <div className="flex items-center gap-2 mb-1">
    <p className="text-xs font-semibold text-[#c8522a] uppercase tracking-widest">
      Agents
    </p>
  </div>
  <div className="flex items-center justify-between">
    <div>
      <h1 className="text-2xl font-semibold text-gray-900">Approval Queue</h1>
      <p className="text-sm text-gray-400 mt-1">
        {pendingCount} item{pendingCount !== 1 ? 's' : ''} waiting for your review
      </p>
    </div>
    {/* Bulk actions — only visible when items checked AND at least one reviewed */}
    {checkedIds.size > 0 && hasReviewedOne && (
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-500">
          {checkedIds.size} selected
        </span>
        <button
          onClick={handleBulkReject}
          className="px-4 py-2 border border-gray-200 text-gray-600 text-sm
                     font-medium rounded-xl hover:border-gray-400 transition-colors"
        >
          Reject selected
        </button>
        <button
          onClick={handleBulkApprove}
          className="px-4 py-2 bg-black text-white text-sm font-medium
                     rounded-xl hover:bg-gray-800 transition-colors"
        >
          Approve selected
        </button>
      </div>
    )}
    {checkedIds.size > 0 && !hasReviewedOne && (
      <p className="text-xs text-gray-400">
        Open at least one item to enable bulk actions
      </p>
    )}
  </div>
</div>
```

### Empty state

```tsx
{pendingCount === 0 && (
  <div className="flex flex-col items-center justify-center py-24">
    <div className="w-12 h-12 rounded-2xl bg-green-50 flex items-center
                    justify-center mb-4">
      <CheckIcon className="w-6 h-6 text-green-500" />
    </div>
    <h3 className="font-semibold text-gray-900 mb-1">All caught up</h3>
    <p className="text-sm text-gray-400">
      No agent outputs waiting for review
    </p>
  </div>
)}
```

### Queue item component

```tsx
function ApprovalItem({
  task,
  checked,
  onCheck,
  onApprove,
  onReject,
  onReviewed,  // called when item is expanded — unlocks bulk actions
}: ApprovalItemProps) {
  const [expanded, setExpanded] = useState(false)
  const [rejectMode, setRejectMode] = useState(false)
  const [rejectionNote, setRejectionNote] = useState('')
  const output = task.agent_outputs?.[0]

  function handleExpand() {
    setExpanded(true)
    onReviewed(task.id)  // mark as reviewed for bulk unlock
  }

  return (
    <div className={`bg-white rounded-2xl border transition-all duration-150
                     ${expanded ? 'border-gray-300' : 'border-gray-100'}
                     ${checked ? 'ring-2 ring-black ring-offset-1' : ''}`}>

      {/* Item header — always visible */}
      <div className="flex items-start gap-4 p-5">

        {/* Checkbox */}
        <input
          type="checkbox"
          checked={checked}
          onChange={e => onCheck(task.id, e.target.checked)}
          className="mt-1 w-4 h-4 rounded accent-black flex-shrink-0"
        />

        {/* Agent info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <AgentIcon agentId={task.agent_id} className="w-4 h-4 text-gray-400" />
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              {formatAgentName(task.agent_id)}
            </span>
            <span className="text-xs text-gray-400">·</span>
            <span className="text-xs text-gray-400">
              {formatRelative(task.created_at)}
            </span>
          </div>

          {/* Output preview — first 120 chars */}
          <p className={`text-sm text-gray-700 ${expanded ? '' : 'line-clamp-2'}`}>
            {expanded ? output?.content : output?.content?.slice(0, 120) + '...'}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {!expanded && (
            <button
              onClick={handleExpand}
              className="text-xs font-medium text-gray-600 hover:text-black
                         px-3 py-1.5 border border-gray-200 rounded-lg
                         hover:border-gray-400 transition-colors"
            >
              Review →
            </button>
          )}
          {expanded && !rejectMode && (
            <>
              <button
                onClick={() => setRejectMode(true)}
                className="text-xs font-medium text-gray-600 px-3 py-1.5
                           border border-gray-200 rounded-lg hover:border-gray-400
                           transition-colors"
              >
                Reject
              </button>
              <button
                onClick={() => onApprove(task.id)}
                className="text-xs font-medium bg-black text-white px-3 py-1.5
                           rounded-lg hover:bg-gray-800 transition-colors"
              >
                Approve
              </button>
            </>
          )}
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="px-5 pb-5 border-t border-gray-100 pt-4">

          {/* Full output */}
          <div className="bg-gray-50 rounded-xl p-4 mb-4">
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
              {output?.content}
            </p>
          </div>

          {/* Task context */}
          {task.input && (
            <div className="mb-4">
              <p className="text-xs font-semibold text-gray-400 uppercase
                             tracking-widest mb-2">
                What the agent was asked to do
              </p>
              <p className="text-sm text-gray-500">
                {typeof task.input === 'object'
                  ? JSON.stringify(task.input, null, 2)
                  : task.input}
              </p>
            </div>
          )}

          {/* Cost info */}
          <div className="flex items-center gap-4 text-xs text-gray-400 mb-4">
            <span>{task.input_tokens?.toLocaleString()} tokens in</span>
            <span>{task.output_tokens?.toLocaleString()} tokens out</span>
            <span>${task.cost_usd?.toFixed(4)} cost</span>
          </div>

          {/* Rejection form */}
          {rejectMode && (
            <div className="border-t border-gray-100 pt-4">
              <p className="text-xs font-semibold text-gray-400 uppercase
                             tracking-widest mb-2">
                Rejection reason (optional — helps Maya improve)
              </p>
              <div className="flex flex-col gap-2">
                {/* Quick rejection reasons */}
                <div className="flex flex-wrap gap-2 mb-2">
                  {[
                    'Off-brand tone',
                    'Inaccurate information',
                    'Too long',
                    'Too short',
                    'Wrong audience',
                    'Needs more specificity',
                  ].map(reason => (
                    <button
                      key={reason}
                      onClick={() => setRejectionNote(reason)}
                      className={`text-xs px-3 py-1.5 rounded-lg border transition-colors
                        ${rejectionNote === reason
                          ? 'border-black bg-black text-white'
                          : 'border-gray-200 text-gray-600 hover:border-gray-400'}`}
                    >
                      {reason}
                    </button>
                  ))}
                </div>
                <textarea
                  value={rejectionNote}
                  onChange={e => setRejectionNote(e.target.value)}
                  placeholder="Or describe what was wrong..."
                  rows={2}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3
                             text-sm resize-none focus:outline-none focus:border-black"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => setRejectMode(false)}
                    className="flex-1 py-2.5 border border-gray-200 text-sm
                               rounded-xl text-gray-600"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => onReject(task.id, rejectionNote)}
                    className="flex-1 py-2.5 bg-red-600 text-white text-sm
                               font-medium rounded-xl hover:bg-red-700"
                  >
                    Confirm rejection
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

---

## Part 3 — Filtering & Sorting

```tsx
// Filter bar above queue
<div className="flex items-center gap-3 mb-4">
  {/* Agent filter */}
  <select
    value={agentFilter}
    onChange={e => setAgentFilter(e.target.value)}
    className="text-sm border border-gray-200 rounded-xl px-3 py-2"
  >
    <option value="all">All agents</option>
    {uniqueAgents.map(agent => (
      <option key={agent} value={agent}>{formatAgentName(agent)}</option>
    ))}
  </select>

  {/* Sort */}
  <select
    value={sortOrder}
    onChange={e => setSortOrder(e.target.value)}
    className="text-sm border border-gray-200 rounded-xl px-3 py-2"
  >
    <option value="newest">Newest first</option>
    <option value="oldest">Oldest first</option>
  </select>

  {/* Select all */}
  <button
    onClick={handleSelectAll}
    className="ml-auto text-sm text-gray-500 hover:text-black"
  >
    {checkedIds.size === filteredTasks.length ? 'Deselect all' : 'Select all'}
  </button>
</div>
```

---

## Part 4 — API Routes

### `GET /api/agents/approvals`
Returns all `approval_required` tasks for the current user with outputs:

```typescript
const { data } = await supabase
  .from('agent_tasks')
  .select(`
    id, agent_id, status, input, input_tokens, output_tokens,
    cost_usd, created_at, rejection_reason, reviewed_at,
    agent_outputs(id, content, feedback, feedback_note)
  `)
  .eq('user_id', profile.id)
  .eq('status', 'approval_required')
  .order('created_at', { ascending: false })
```

### `POST /api/agents/tasks/[id]/approve` (already exists — verify it updates feedback)
Should also:
```typescript
// Update agent_outputs feedback
await supabase
  .from('agent_outputs')
  .update({ feedback: 'approved', feedback_at: new Date().toISOString() })
  .eq('task_id', taskId)

// Update agent_tasks
await supabase
  .from('agent_tasks')
  .update({
    status:      'completed',
    reviewed_at: new Date().toISOString(),
    reviewed_by: profile.id,
  })
  .eq('id', taskId)
```

### `POST /api/agents/tasks/[id]/reject` (already exists — add rejection reason)
```typescript
const { reason } = await req.json()

await supabase
  .from('agent_outputs')
  .update({
    feedback:      'rejected',
    feedback_note: reason ?? null,
    feedback_at:   new Date().toISOString(),
  })
  .eq('task_id', taskId)

await supabase
  .from('agent_tasks')
  .update({
    status:           'rejected',
    rejection_reason: reason ?? null,
    reviewed_at:      new Date().toISOString(),
    reviewed_by:      profile.id,
  })
  .eq('id', taskId)
```

### `POST /api/agents/approvals/bulk`
Handles bulk approve or reject:

```typescript
const { action, taskIds, reason } = await req.json()
// action: 'approve' | 'reject'
// taskIds: string[]

for (const taskId of taskIds) {
  if (action === 'approve') {
    // same as individual approve
  } else {
    // same as individual reject with shared reason
  }
}

return NextResponse.json({ processed: taskIds.length })
```

---

## Part 5 — Sidebar Badge

In `DashboardShell`, add a pending approval count badge to the Agents nav item:

```typescript
// Fetch pending approval count on shell load
const { count } = await supabase
  .from('agent_tasks')
  .select('id', { count: 'exact', head: true })
  .eq('user_id', profile.id)
  .eq('status', 'approval_required')
```

```tsx
<NavItem
  href="/dashboard/agents"
  icon={<AgentsIcon />}
  label="Agents"
  badge={pendingApprovals > 0 ? pendingApprovals : undefined}
/>
```

Badge style:
```tsx
{badge && (
  <span className="ml-auto bg-[#c8522a] text-white text-xs font-semibold
                   px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
    {badge > 99 ? '99+' : badge}
  </span>
)}
```

Also add a direct "Approvals" link under Agents in the sidebar when
`pendingApprovals > 0`:

```tsx
{pendingApprovals > 0 && (
  <NavSubItem
    href="/dashboard/agents/approvals"
    label={`${pendingApprovals} pending approval${pendingApprovals > 1 ? 's' : ''}`}
    urgent
  />
)}
```

---

## Part 6 — Agent Command Center Link

In `AgentCommandCenter.tsx`, update the approval queue section to link
to the dedicated page instead of showing inline:

```tsx
{pendingApprovals > 0 && (
  <div className="flex items-center justify-between p-4 bg-orange-50
                  border border-orange-100 rounded-xl mb-6">
    <div>
      <p className="text-sm font-semibold text-gray-900">
        {pendingApprovals} output{pendingApprovals > 1 ? 's' : ''} need your review
      </p>
      <p className="text-xs text-gray-500 mt-0.5">
        Approve or reject before they're used
      </p>
    </div>
    <Link
      href="/dashboard/agents/approvals"
      className="text-sm font-medium text-[#c8522a] hover:underline whitespace-nowrap"
    >
      Review now →
    </Link>
  </div>
)}
```

---

## Part 7 — Maya Canvas Context

Dispatch canvas context from the approvals page:

```typescript
useEffect(() => {
  if (!tasks) return
  window.dispatchEvent(new CustomEvent('maya:canvas-context', {
    detail: {
      context: `Approval Queue — ${tasks.length} items pending review.
Agents with pending outputs: ${[...new Set(tasks.map(t => formatAgentName(t.agent_id)))].join(', ')}.
Oldest pending: ${tasks[tasks.length - 1] ? formatRelative(tasks[tasks.length - 1].created_at) : 'n/a'}`
    }
  }))
}, [tasks])
```

---

## Definition of Done

- [ ] SQL migration run — rejection_reason, reviewed_at, reviewed_by on agent_tasks + feedback columns on agent_outputs
- [ ] `/dashboard/agents/approvals` page loads with pending items
- [ ] Empty state shows when queue is clear
- [ ] Each item shows agent name, relative time, output preview
- [ ] "Review →" expands item to show full output + context + cost
- [ ] Approve button works — task moves to completed
- [ ] Reject button opens rejection form with quick-select reasons + free text
- [ ] Rejection reason saved to both agent_tasks and agent_outputs
- [ ] Checkbox on each item
- [ ] Bulk actions visible only after at least one item is expanded
- [ ] Bulk approve works — all checked items approved in one call
- [ ] Bulk reject works — all checked items rejected with shared reason
- [ ] "Select all" / "Deselect all" toggle works
- [ ] Agent filter dropdown filters queue
- [ ] Sort by newest/oldest works
- [ ] Sidebar Agents nav item shows orange badge with pending count
- [ ] Pending approvals sub-item appears under Agents when count > 0
- [ ] Agent Command Center shows banner linking to approvals page
- [ ] Morning digest "Review →" links to `/dashboard/agents/approvals?task={id}`
- [ ] Maya canvas context dispatched from approvals page
- [ ] `/api/agents/approvals/bulk` route handles approve + reject

