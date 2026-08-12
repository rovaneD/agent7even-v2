/**
 * Static verification: client-supplied media_storage_path must be workspace-owned
 * before service-role download, vision, or Zernio publish.
 *
 * Usage: npx tsx scripts/verify-media-storage-path-ownership.ts
 */
import { readFileSync } from 'fs'
import { join } from 'path'
import { assertPostAssetOwnedByProfile } from '../lib/agents/imageGeneration'

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg)
}

function assertIncludes(src: string, needle: string, label: string): void {
  assert(src.includes(needle), `${label} must include ${needle}`)
}

function main() {
  const owner = '11111111-1111-1111-1111-111111111111'
  const victim = '22222222-2222-2222-2222-222222222222'

  assert(
    assertPostAssetOwnedByProfile(`${owner}/abc-upload.jpg`, owner) === true,
    'owned path must pass',
  )
  assert(
    assertPostAssetOwnedByProfile(`${victim}/secret.png`, owner) === false,
    'foreign tenant path must fail',
  )
  assert(
    assertPostAssetOwnedByProfile(`${owner}-extra/file.jpg`, owner) === false,
    'prefix-adjacent profile id must fail',
  )
  assert(assertPostAssetOwnedByProfile('', owner) === false, 'empty path must fail closed')
  assert(assertPostAssetOwnedByProfile(`${owner}/x.jpg`, '') === false, 'empty profile must fail closed')

  const createSrc = readFileSync(
    join(process.cwd(), 'app/api/agents/tasks/create/route.ts'),
    'utf8',
  )
  assertIncludes(createSrc, 'assertPostAssetOwnedByProfile', 'tasks/create route')
  assertIncludes(createSrc, 'invalid_storage_path', 'tasks/create route')
  assert(
    createSrc.includes('createTask') &&
      createSrc.indexOf('assertPostAssetOwnedByProfile') < createSrc.indexOf('createTask'),
    'tasks/create must reject foreign media paths before createTask',
  )

  const executeSrc = readFileSync(join(process.cwd(), 'lib/agents/executeAgentRun.ts'), 'utf8')
  assertIncludes(executeSrc, 'assertPostAssetOwnedByProfile', 'executeAgentRun')
  assert(
    executeSrc.includes('buildVisionUserMessageFromStorage') &&
      executeSrc.indexOf('assertPostAssetOwnedByProfile') <
        executeSrc.indexOf('buildVisionUserMessageFromStorage'),
    'executeAgentRun must reject foreign paths before vision download',
  )
  assert(
    executeSrc.includes('deductCredits') &&
      executeSrc.indexOf('assertPostAssetOwnedByProfile') < executeSrc.indexOf('deductCredits'),
    'executeAgentRun must reject foreign paths before credit reservation',
  )

  const publishSrc = readFileSync(
    join(process.cwd(), 'lib/agents/publishApprovedOutput.ts'),
    'utf8',
  )
  assertIncludes(publishSrc, 'assertPostAssetOwnedByProfile', 'publishApprovedOutput')
  assertIncludes(publishSrc, 'invalid_storage_path', 'publishApprovedOutput')
  assert(
    publishSrc.includes('downloadPostAsset') &&
      publishSrc.indexOf('assertPostAssetOwnedByProfile') < publishSrc.indexOf('downloadPostAsset'),
    'publish must reject foreign paths before downloadPostAsset',
  )

  const approvalsSrc = readFileSync(
    join(process.cwd(), 'app/dashboard/agents/approvals/page.tsx'),
    'utf8',
  )
  assertIncludes(approvalsSrc, 'assertPostAssetOwnedByProfile', 'approvals page')
  assert(
    approvalsSrc.includes('createPostAssetSignedUrl') &&
      approvalsSrc.indexOf('assertPostAssetOwnedByProfile') <
        approvalsSrc.indexOf('createPostAssetSignedUrl'),
    'approvals page must not sign URLs for foreign media paths',
  )

  console.log('verify-media-storage-path-ownership: ok')
}

main()
