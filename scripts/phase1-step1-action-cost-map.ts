/**
 * Phase 1 Step 1 — print ACTION_CREDIT_COST and generation constants from live code.
 * Usage: npx tsx scripts/phase1-step1-action-cost-map.ts
 */
import { ACTION_CREDIT_COST } from '../lib/credits/actionCosts'
import { briefComposeModel, imageOptionCount } from '../lib/agents/imageGeneration/briefCompose'

console.log('=== ACTION_CREDIT_COST (lib/credits/actionCosts.ts) ===')
console.log(JSON.stringify(ACTION_CREDIT_COST, null, 2))

console.log('\n=== IMAGE_GENERATION_OPTIONS_COUNT (env or default) ===')
console.log(String(imageOptionCount()))

console.log('\n=== briefComposeModel() ===')
console.log(briefComposeModel())

console.log('\n=== Step 1 code paths (file:line anchors) ===')
const paths: Record<string, string> = {
  maya_chat_turn: 'app/api/maya/chat/route.ts — createTask jobType maya_chat; cost_usd on stream complete',
  text_run: 'lib/agents/runner.ts runAgent L401 action_type text_run; executeAgentRun chargeAgentRun; app/api/campaigns/generate/route.ts',
  image_standard_premium_options:
    'app/api/posts/generate-images/route.ts → generateImageOptions → insertImageOptionsCostTask (job_type image_options)',
  image_standard_premium_compose:
    'lib/agents/imageGeneration/queueGeneratedPost.ts — deductCredits image_generation_bundle; chargeAgentRun caption',
  video_standard_premium:
    'app/api/posts/generate-video/route.ts — brief cost on insert; app/api/webhooks/openrouter-video/route.ts adds video job cost',
  publish: 'lib/agents/publishApprovedOutput.ts — PUBLISH_CREDIT_COST; no agent_tasks cost row',
  brandkit_gen: 'app/api/brand-kit/generate-colors|fonts/route.ts — deductCredits; no agent_tasks row',
  foundation_gen: 'lib/foundation/runFoundationGeneration.ts — orchestration; foundation agent tasks via runAgent',
}
console.log(JSON.stringify(paths, null, 2))
