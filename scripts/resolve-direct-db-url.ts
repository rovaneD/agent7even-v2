/**
 * Print a Postgres URI suitable for pg_dump / DDL.
 * Prefers DIRECT_URL (Session pooler from Connect), then SUPABASE_DB_URL.
 * Strips Supabase UI placeholder brackets and fixes aws-0 → aws-1 pooler host.
 */
function main() {
  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const raw = (
    process.env.DIRECT_URL ||
    process.env.SUPABASE_DB_URL ||
    ''
  )
    .trim()
    .replace(/\[|\]/g, '')

  if (!raw) {
    console.error('Set DIRECT_URL or SUPABASE_DB_URL in .env.local')
    process.exit(1)
  }
  if (!projectUrl) {
    console.error('NEXT_PUBLIC_SUPABASE_URL not set')
    process.exit(1)
  }

  let url: URL
  try {
    url = new URL(raw)
  } catch {
    console.error('Database URL is not valid')
    process.exit(1)
  }

  const refMatch = projectUrl.match(/^https?:\/\/([^.]+)\.supabase\.co/i)
  const ref = refMatch?.[1]
  if (!ref) {
    console.error('Could not parse project ref from NEXT_PUBLIC_SUPABASE_URL')
    process.exit(1)
  }

  if (!url.password) {
    console.error('Database URL has no password')
    process.exit(1)
  }

  const isPooler = url.hostname.includes('pooler.supabase.com')

  if (isPooler && url.hostname.includes('aws-0-us-east-1.pooler.supabase.com')) {
    url.hostname = 'aws-1-us-east-1.pooler.supabase.com'
  }

  if (isPooler && url.port === '6543') {
    url.port = '5432'
    if (url.username === 'postgres') {
      url.username = `postgres.${ref}`
    }
  }

  if (isPooler && url.username === 'postgres') {
    url.username = `postgres.${ref}`
  }

  process.stdout.write(url.toString())
}

main()
