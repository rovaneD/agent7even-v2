/**
 * F3 — drop empty chat_sessions table. Uses direct Postgres (see resolve-direct-db-url.ts).
 *
 * Usage: npx tsx --env-file=.env.local scripts/f3-drop-chat-sessions.ts
 */
import { execSync } from 'child_process'

async function main() {
  const dbUrl = execSync('npx --yes tsx --env-file=.env.local scripts/resolve-direct-db-url.ts', {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  }).trim()

  if (!dbUrl) {
    console.error('Could not resolve direct DB URL')
    process.exit(1)
  }

  const postgres = (await import('postgres')).default
  const sql = postgres(dbUrl, { max: 1 })

  try {
    const reg = await sql`select to_regclass('public.chat_sessions') as reg`
    if (!reg[0]?.reg) {
      console.log('chat_sessions already absent — nothing to drop')
      return
    }

    const [{ count }] = await sql`
      select count(*)::int as count from public.chat_sessions
    `
    console.log('chat_sessions row count:', count)
    if (count > 0) {
      console.error('Refusing to drop — table is not empty')
      process.exit(1)
    }

    await sql.unsafe('drop table if exists public.chat_sessions cascade')
    console.log('Dropped public.chat_sessions')

    const after = await sql`select to_regclass('public.chat_sessions') as reg`
    if (after[0]?.reg) {
      console.error('Drop failed — table still exists')
      process.exit(1)
    }
    console.log('Verified: chat_sessions gone')
  } finally {
    await sql.end({ timeout: 5 })
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
