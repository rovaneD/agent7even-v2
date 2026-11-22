/**
 * Lock in: a finished product ad is a video post. Approving it must be allowed
 * to create a Posts draft, the same as presenter and B-roll.
 *
 * Usage: npx tsx scripts/verify-product-ad-approval.ts
 */
import { approvalQueueKind, singlePostPublishBlockReason } from '../lib/agents/contentPosting'

function fail(message: string): never {
  console.error(`FAIL · ${message}`)
  process.exit(1)
}

const video = {
  raw: 'Milky body lotion',
  media_storage_path: 'workspace/clip.mp4',
  media_mime: 'video/mp4',
}

const productTask = {
  agent: 'video_product_ad',
  input: { typeId: 'product_ad', productName: 'Milky body lotion' },
  agent_outputs: [{ content: video, created_at: '2026-11-09T00:00:00.000Z' }],
}

if (approvalQueueKind(productTask) !== 'post') {
  fail('video_product_ad must be classified as a post, not Other')
}

const productBlock = singlePostPublishBlockReason({
  agentId: 'video_product_ad',
  taskInput: productTask.input,
  outputContent: video,
  caption: video.raw,
})
if (productBlock !== null) {
  fail(`approving a product ad must be allowed to create a Posts draft (blocked: ${productBlock})`)
}

for (const agentId of ['video_presenter', 'video_broll', 'video_generation']) {
  if (approvalQueueKind({ agent: agentId, agent_outputs: [{ content: video }] }) !== 'post') {
    fail(`${agentId} must stay classified as a post`)
  }
  const block = singlePostPublishBlockReason({
    agentId,
    taskInput: {},
    outputContent: video,
    caption: 'A spoken tip',
  })
  if (block !== null) fail(`${agentId} must still be allowed to create a Posts draft (blocked: ${block})`)
}

const weekly = singlePostPublishBlockReason({
  agentId: 'weekly_content',
  taskInput: {},
  outputContent: video,
  caption: 'Week plan',
})
if (!weekly) fail('weekly plans must still stay out of Posts')

const imageOnly = singlePostPublishBlockReason({
  agentId: 'video_product_ad',
  taskInput: {},
  outputContent: { raw: 'Milky body lotion', media_storage_path: 'workspace/still.png', media_mime: 'image/png' },
  caption: 'Milky body lotion',
})
if (!imageOnly) fail('a product-ad row without a video must not be treated as a video draft')

console.log('PASS · product ads are posts and can create a Posts draft on approve')
console.log('PASS · presenter, B-roll, and the older video agent are unchanged')
