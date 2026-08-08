/**
 * Static verification: client-supplied Zernio accountIds must be tenant-owned.
 *
 * Usage: npx tsx scripts/verify-zernio-accountid-ownership.ts
 */
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  collectOwnedAccountIds,
  extractPlatformAccountIds,
  findForeignAccountId,
  isOwnedZernioAccountId,
} from '../lib/social/zernioOwnedAccountIds'

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg)
}

function assertIncludes(src: string, needle: string, label: string): void {
  assert(src.includes(needle), `${label} must include ${needle}`)
}

function main() {
  const owned = collectOwnedAccountIds([
    { id: 'acct_owner_ig' },
    { id: 'acct_owner_li' },
    { id: '' },
  ])
  assert(owned.size === 2, 'empty account ids must be dropped from the allowlist')
  assert(isOwnedZernioAccountId(owned, 'acct_owner_ig') === true, 'owned account must pass')
  assert(isOwnedZernioAccountId(owned, 'acct_victim_99') === false, 'foreign account must fail')
  assert(isOwnedZernioAccountId(owned, null) === false, 'missing accountId must fail closed')
  assert(isOwnedZernioAccountId(owned, '') === false, 'empty accountId must fail closed')

  assert(
    findForeignAccountId(owned, ['acct_owner_ig', 'acct_owner_li']) === null,
    'all-owned platforms must pass',
  )
  assert(
    findForeignAccountId(owned, ['acct_owner_ig', 'acct_victim_99']) === 'acct_victim_99',
    'mixed platforms must surface the foreign id',
  )

  {
    const extracted = extractPlatformAccountIds([
      { platform: 'instagram', accountId: 'acct_owner_ig' },
      { platform: 'linkedin', accountId: 'acct_victim_99' },
      { platform: 'x' },
      null,
    ])
    assert(
      extracted.length === 2 &&
        extracted[0] === 'acct_owner_ig' &&
        extracted[1] === 'acct_victim_99',
      'extractPlatformAccountIds must collect only non-empty accountId strings',
    )
  }

  const postsSrc = readFileSync(join(process.cwd(), 'app/api/posts/route.ts'), 'utf8')
  assertIncludes(postsSrc, 'loadOwnedAccountIdSet', 'posts route')
  assertIncludes(postsSrc, 'findForeignAccountId', 'posts route create path')
  assertIncludes(postsSrc, 'foreign_account', 'posts route')
  assert(
    postsSrc.includes('createPost') &&
      postsSrc.indexOf('findForeignAccountId') < postsSrc.indexOf('createPost'),
    'posts create must allowlist accountIds before publisher.createPost',
  )

  const patchSrc = readFileSync(join(process.cwd(), 'app/api/posts/[postId]/route.ts'), 'utf8')
  assertIncludes(patchSrc, 'extractPlatformAccountIds', 'posts PATCH route')
  assertIncludes(patchSrc, 'findForeignAccountId', 'posts PATCH route')
  assertIncludes(patchSrc, 'foreign_account', 'posts PATCH route')
  assert(
    patchSrc.includes('updatePost') &&
      patchSrc.indexOf('findForeignAccountId') < patchSrc.indexOf('updatePost'),
    'posts PATCH must allowlist accountIds before publisher.updatePost',
  )

  const messagesSrc = readFileSync(
    join(process.cwd(), 'app/api/inbox/conversations/[id]/messages/route.ts'),
    'utf8',
  )
  assertIncludes(messagesSrc, 'isOwnedZernioAccountId', 'inbox messages route')
  assertIncludes(messagesSrc, 'foreign_account', 'inbox messages route')
  assert(
    messagesSrc.includes('sendInboxReply') &&
      messagesSrc.indexOf('isOwnedZernioAccountId') < messagesSrc.indexOf('sendInboxReply'),
    'inbox reply must allowlist accountId before sendInboxReply',
  )

  const commentsSrc = readFileSync(
    join(process.cwd(), 'app/api/inbox/comments/[postId]/route.ts'),
    'utf8',
  )
  assertIncludes(commentsSrc, 'isOwnedZernioAccountId', 'inbox comments route')
  assertIncludes(commentsSrc, 'foreign_account', 'inbox comments route')
  assert(
    commentsSrc.includes('sendInboxCommentReply') &&
      commentsSrc.indexOf('isOwnedZernioAccountId') < commentsSrc.indexOf('sendInboxCommentReply'),
    'inbox comment reply must allowlist accountId before sendInboxCommentReply',
  )

  console.log('verify-zernio-accountid-ownership: ok')
}

main()
