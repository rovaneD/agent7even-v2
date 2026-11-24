/**
 * Lock in: a failed video refunds its charge once, and a clip that was actually
 * saved is not refunded (a concurrent failure path charges the refund back).
 *
 * Usage: npx tsx scripts/verify-video-fail-refund.ts
 */
import { friendlyRunError } from '../lib/agents/agentRunUi'
import { completeVideoTask, failVideoTask } from '../lib/agents/videoGeneration/failVideoTask'

type Task = { id: string; status: string; error: string | null }
type Ledger = { task_id: string; credits: number }
type Output = { id: string; task_id: string }

type Store = {
  tasks: Task[]
  ledger: Ledger[]
  outputs: Output[]
  pauseFirstLedgerRead: Promise<void> | null
  ledgerReads: number
}

function createStore(): Store {
  return { tasks: [], ledger: [], outputs: [], pauseFirstLedgerRead: null, ledgerReads: 0 }
}

function matches(row: Record<string, unknown>, filters: { op: 'eq' | 'is'; column: string; value: unknown }[]): boolean {
  return filters.every(f => {
    const current = row[f.column]
    if (f.op === 'is') return f.value === null ? current == null : current === f.value
    return current === f.value
  })
}

function clientFor(store: Store) {
  function from(table: 'agent_tasks' | 'credit_ledger' | 'agent_outputs') {
    const filters: { op: 'eq' | 'is'; column: string; value: unknown }[] = []
    let patch: Record<string, unknown> | null = null
    let mode: 'select' | 'update' = 'select'
    let single = false
    const builder = {
      update(next: Record<string, unknown>) {
        mode = 'update'
        patch = next
        return builder
      },
      select() {
        return builder
      },
      eq(column: string, value: unknown) {
        filters.push({ op: 'eq', column, value })
        return builder
      },
      is(column: string, value: unknown) {
        filters.push({ op: 'is', column, value })
        return builder
      },
      order() {
        return builder
      },
      limit() {
        return builder
      },
      maybeSingle() {
        single = true
        return builder
      },
      then(resolve: (value: { data: unknown; error: null }) => unknown, reject?: (err: unknown) => unknown) {
        return exec().then(resolve, reject)
      },
    }

    async function exec(): Promise<{ data: unknown; error: null }> {
      if (table === 'credit_ledger' && mode === 'select') {
        store.ledgerReads += 1
        if (store.ledgerReads === 1 && store.pauseFirstLedgerRead) await store.pauseFirstLedgerRead
      }
      const rows = (table === 'agent_tasks' ? store.tasks : table === 'credit_ledger' ? store.ledger : store.outputs) as Record<string, unknown>[]
      const hit = rows.filter(row => matches(row, filters))
      if (mode === 'update') {
        for (const row of hit) Object.assign(row, patch)
        return { data: hit.map(row => ({ id: row.id })), error: null }
      }
      if (single) return { data: hit[0] ?? null, error: null }
      return { data: hit, error: null }
    }

    return builder
  }
  return { from }
}

function creditsFor(store: Store) {
  return {
    async refundCredits(userId: string, amount: number, _description: string, taskId?: string) {
      if (!userId || !taskId || amount <= 0) return { balance: 0 }
      store.ledger.push({ task_id: taskId, credits: amount })
      return { balance: 0 }
    },
    async deductCredits(userId: string, amount: number, _description: string, taskId?: string) {
      if (!userId || !taskId || amount <= 0) return { balance: 0 }
      store.ledger.push({ task_id: taskId, credits: -amount })
      return { balance: 0 }
    },
  }
}

function net(store: Store, taskId: string): number {
  return store.ledger.filter(row => row.task_id === taskId).reduce((sum, row) => sum + row.credits, 0)
}

function fail(message: string): never {
  console.error(`FAIL · ${message}`)
  process.exit(1)
}

async function testConcurrentFailureRefundsOnce() {
  const store = createStore()
  store.tasks.push({ id: 'task-1', status: 'running', error: null })
  store.ledger.push({ task_id: 'task-1', credits: -40 })
  const supabase = clientFor(store)
  const credits = creditsFor(store)
  await Promise.all([
    failVideoTask(supabase as never, 'task-1', 'user-1', credits),
    failVideoTask(supabase as never, 'task-1', 'user-1', credits),
  ])
  if (store.tasks[0]?.status !== 'failed') fail(`concurrent failure status ${store.tasks[0]?.status}`)
  if (net(store, 'task-1') !== 0) fail(`concurrent failure net ${net(store, 'task-1')}, expected 0`)
  const refunds = store.ledger.filter(row => row.task_id === 'task-1' && row.credits > 0)
  if (refunds.length !== 1) fail(`concurrent failure wrote ${refunds.length} refunds`)
  console.log('PASS · two concurrent failure paths refund the charge once')
}

async function testSecondFailureDoesNotRefundAgain() {
  const store = createStore()
  store.tasks.push({ id: 'task-2', status: 'running', error: null })
  store.ledger.push({ task_id: 'task-2', credits: -10 })
  const supabase = clientFor(store)
  const credits = creditsFor(store)
  await failVideoTask(supabase as never, 'task-2', 'user-1', credits)
  await failVideoTask(supabase as never, 'task-2', 'user-1', credits)
  if (net(store, 'task-2') !== 0) fail(`sequential retry net ${net(store, 'task-2')}`)
  console.log('PASS · a second failure call does not refund again')
}

async function testDeliveredClipIsNotRefunded() {
  const store = createStore()
  store.tasks.push({ id: 'task-3', status: 'completed', error: null })
  store.outputs.push({ id: 'out-3', task_id: 'task-3' })
  store.ledger.push({ task_id: 'task-3', credits: -40 })
  await failVideoTask(clientFor(store) as never, 'task-3', 'user-1', creditsFor(store))
  if (store.tasks[0]?.status !== 'completed') fail('delivered clip was marked failed')
  if (net(store, 'task-3') !== -40) fail(`delivered clip net ${net(store, 'task-3')}`)
  console.log('PASS · a saved clip is not refunded when a late failure arrives')
}

async function testFailureDuringSaveChargesBack() {
  const store = createStore()
  store.tasks.push({ id: 'task-4', status: 'running', error: null })
  store.ledger.push({ task_id: 'task-4', credits: -40 })
  let release!: () => void
  store.pauseFirstLedgerRead = new Promise(resolve => { release = resolve })
  const supabase = clientFor(store)
  const credits = creditsFor(store)
  const failing = failVideoTask(supabase as never, 'task-4', 'user-1', credits)
  for (let i = 0; i < 50 && store.tasks[0]?.error !== 'video_refunding'; i += 1) {
    await new Promise(resolve => setTimeout(resolve, 5))
  }
  if (store.tasks[0]?.error !== 'video_refunding') fail('failure path did not claim the refund')
  store.outputs.push({ id: 'out-4', task_id: 'task-4' })
  await completeVideoTask(supabase as never, 'task-4', 'user-1', credits)
  release()
  await failing
  if (store.tasks[0]?.status !== 'completed') fail(`saved-during-failure status ${store.tasks[0]?.status}`)
  if (net(store, 'task-4') !== -40) fail(`saved-during-failure net ${net(store, 'task-4')}, expected -40`)
  console.log('PASS · a clip saved during the refund is charged back once')
}

function testFailureCopy() {
  const refunded = friendlyRunError('video_refunded')
  if (refunded.includes('video_refund')) fail('internal refund token leaked into the activity feed')
  if (!refunded.toLowerCase().includes('refund')) fail('refunded failure copy does not mention the refund')
  const settled = friendlyRunError('video_fail_settled')
  if (settled.includes('video_fail')) fail('internal settled token leaked into the activity feed')
  console.log('PASS · failure markers are not shown raw')
}

async function main() {
  await testConcurrentFailureRefundsOnce()
  await testSecondFailureDoesNotRefundAgain()
  await testDeliveredClipIsNotRefunded()
  await testFailureDuringSaveChargesBack()
  testFailureCopy()
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
