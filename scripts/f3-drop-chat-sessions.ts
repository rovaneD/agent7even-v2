/**
 * F3 — drop empty chat_sessions table. Requires SUPABASE_DB_URL in .env.local.
 *
 * Usage: npx tsx --env-file=.env.local scripts/f3-drop-chat-sessions.ts
 */
async function main() {
  const dbUrl = process.env.SUPABASE_DB_URL?.trim()
  if (!dbUrl) {
    console.error('SUPABASE_DB_URL not set in .env.local')
    process.exit(1)
  }

  const postgres = (await import('postgres')).default
  const sql = postgres(dbUrl, { max: 1 })

  try {
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

    const exists = await sql`
      select to_regclass('public.chat_sessions') as reg
    `
    if (exists[0]?.reg) {
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
