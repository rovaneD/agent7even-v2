/**
 * Lock in: bulk approve must select the same publish targets as single approve.
 *
 * Usage:
 *   npx tsx scripts/verify-bulk-approve-publish.ts
 */
import { selectApprovedPublishTargets } from '../lib/agents/approvedPublishTargets'

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(message)
}

const imageCaption = {
  raw: 'A short caption for the shop window.',
  media_storage_path: 'workspace-1/post.jpg',
  media_mime: 'image/jpeg',
  image_caption_mode: true,
  contentFlow: 'single',
}

const weeklyPlan = {
  raw: '# 7-day content plan\n**Week Goal:** grow local reach\nDay 1 ...',
  contentFlow: 'weekly',
}

function main() {
  const outputs = [
    { id: 'out-post', task_id: 'task-post', content: imageCaption },
    { id: 'out-plan', task_id: 'task-plan', content: weeklyPlan },
    { id: 'out-empty', task_id: 'task-empty', content: { raw: '', image_caption_mode: true } },
    { id: 'out-orphan', task_id: 'missing-task', content: imageCaption },
    {
      id: 'out-legacy',
      task_id: 'task-legacy',
      content: {
        raw: 'Legacy caption agent post.',
        media_storage_path: 'workspace-1/legacy.jpg',
        media_mime: 'image/jpeg',
      },
    },
  ]

  const tasksById = new Map<string, { agent?: string | null; input?: unknown }>([
    ['task-post', { agent: 'content_posting', input: { contentFlow: 'single' } }],
    ['task-plan', { agent: 'content_posting', input: { contentFlow: 'weekly' } }],
    ['task-empty', { agent: 'content_posting', input: { contentFlow: 'single' } }],
    ['task-legacy', { agent: 'post_caption', input: { platform: 'instagram' } }],
  ])

  const targets = selectApprovedPublishTargets(outputs, tasksById)
  const ids = targets.map(t => t.outputId).sort()

  assert(ids.includes('out-post'), 'single-post content_posting with image must publish')
  assert(ids.includes('out-legacy'), 'legacy post_caption with image must publish')
  assert(!ids.includes('out-plan'), 'weekly plans must not publish')
  assert(!ids.includes('out-empty'), 'empty caption must not publish')
  assert(!ids.includes('out-orphan'), 'outputs without a matching task must not publish')
  assert(ids.length === 2, `expected 2 publish targets, got ${ids.length}: ${ids.join(',')}`)

  const post = targets.find(t => t.outputId === 'out-post')
  assert(post?.caption === imageCaption.raw, 'caption must come from output.raw')
  assert(post?.taskId === 'task-post', 'task id must follow the output')

  console.log('PASS — bulk approve selects the same publishable posts as single approve')
}

main()
