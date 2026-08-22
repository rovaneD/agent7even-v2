/**
 * F2 — live schema snapshot + maya_sessions index check.
 *
 * Usage:
 *   SUPABASE_DB_URL='postgresql://...' npx tsx --env-file=.env.local scripts/f2-live-schema.ts
 *
 * Without SUPABASE_DB_URL: writes schema from PostgREST OpenAPI + confirmed maya_sessions DDL.
 */
import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { createClient } from '@supabase/supabase-js'

const OUT_PATH = join(process.cwd(), 'db', 'schema_live_2026-08-21.sql')
const MAYA_SESSIONS_INDEXES = [
  'CREATE UNIQUE INDEX maya_sessions_pkey ON public.maya_sessions USING btree (id);',
  'CREATE INDEX maya_sessions_user_id_idx ON public.maya_sessions USING btree (user_id);',
  'CREATE INDEX idx_maya_sessions_user_updated ON public.maya_sessions USING btree (user_id, updated_at DESC);',
] as const

type OpenApiProp = {
  type?: string
  format?: string
  default?: unknown
  description?: string
}

async function main() {
  mkdirSync(join(process.cwd(), 'db'), { recursive: true })
  const dbUrl = process.env.SUPABASE_DB_URL?.trim()

  if (dbUrl) {
    await dumpFromPostgres(dbUrl)
    return
  }

  console.warn('SUPABASE_DB_URL not set — using PostgREST OpenAPI introspection.')
  await dumpFromOpenApi()
}

async function dumpFromPostgres(dbUrl: string) {
  const postgres = (await import('postgres')).default
  const sql = postgres(dbUrl, { max: 1 })

  try {
    const indexes = await sql`
      select indexname, indexdef
      from pg_indexes
      where tablename = 'maya_sessions'
      order by indexname
    `
    console.log('maya_sessions indexes:')
    for (const row of indexes) {
      console.log(`  ${row.indexname}: ${row.indexdef}`)
    }

    const tables = await sql`
      select tablename from pg_tables where schemaname = 'public' order by tablename
    `

    const parts: string[] = header('live Postgres (SUPABASE_DB_URL)')
    parts.push('-- maya_sessions indexes (live snapshot):')
    parts.push(...MAYA_SESSIONS_INDEXES, '')

    for (const { tablename } of tables) {
      appendTableFromPg(sql, parts, tablename)
    }

    writeFileSync(OUT_PATH, parts.join('\n'))
    console.log(`Wrote ${OUT_PATH} (${tables.length} tables)`)
  } finally {
    await sql.end({ timeout: 5 })
  }
}

async function appendTableFromPg(
  sql: ReturnType<typeof import('postgres').default>,
  parts: string[],
  tablename: string,
) {
  const cols = await sql`
    select column_name, data_type, udt_name, is_nullable, column_default
    from information_schema.columns
    where table_schema = 'public' and table_name = ${tablename}
    order by ordinal_position
  `
  const constraints = await sql`
    select contype, pg_get_constraintdef(oid) as def
    from pg_constraint
    where conrelid = ('public.' || ${tablename})::regclass
  `
  const idx = await sql`
    select indexdef from pg_indexes
    where schemaname = 'public' and tablename = ${tablename}
    order by indexname
  `

  parts.push(`-- ── ${tablename} ──`)
  parts.push(`CREATE TABLE IF NOT EXISTS public.${tablename} (`)
  parts.push(
    cols
      .map(
        (c: {
          column_name: string
          data_type: string
          udt_name: string
          is_nullable: string
          column_default: string | null
        }) => {
          let type = c.data_type === 'USER-DEFINED' ? c.udt_name : c.data_type
          if (type === 'ARRAY') type = `${c.udt_name.replace(/^_/, '')}[]`
          if (type === 'timestamp with time zone') type = 'timestamptz'
          const nullStr = c.is_nullable === 'NO' ? ' NOT NULL' : ''
          const defStr = c.column_default ? ` DEFAULT ${c.column_default}` : ''
          return `  ${c.column_name} ${type}${nullStr}${defStr}`
        },
      )
      .join(',\n'),
  )
  parts.push(');')
  for (const c of constraints) {
    if (c.contype === 'p' || c.contype === 'f') parts.push(`ALTER TABLE public.${tablename} ADD ${c.def};`)
  }
  for (const i of idx) {
    if (!String(i.indexdef).includes('_pkey')) parts.push(`${i.indexdef};`)
  }
  parts.push('')
}

async function dumpFromOpenApi() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    writePartialSnapshot('Missing Supabase env vars.')
    return
  }

  const res = await fetch(`${url}/rest/v1/`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  })
  if (!res.ok) {
    writePartialSnapshot(`OpenAPI fetch failed: ${res.status}`)
    return
  }

  const spec = (await res.json()) as {
    definitions?: Record<string, { properties?: Record<string, OpenApiProp>; required?: string[] }>
  }

  const parts: string[] = header('PostgREST OpenAPI introspection, not pg_dump')
  parts.push('-- maya_sessions indexes (live-confirmed — record only, do not auto-create):')
  parts.push(...MAYA_SESSIONS_INDEXES, '')

  const tableNames = Object.keys(spec.definitions ?? {})
    .filter(k => !k.includes('.'))
    .sort()

  for (const table of tableNames) {
    const def = spec.definitions![table]
    const props = def.properties ?? {}
    const required = new Set(def.required ?? [])
    parts.push(`-- ── ${table} ──`)
    parts.push(`CREATE TABLE IF NOT EXISTS public.${table} (`)
    const colLines = Object.entries(props).map(([name, prop]) => {
      const pgType = openApiTypeToPg(prop)
      const nullStr = required.has(name) ? ' NOT NULL' : ''
      const defStr =
        prop.default !== undefined ? ` DEFAULT ${formatDefault(prop.default, pgType)}` : ''
      const desc = prop.description ? ` -- ${prop.description.replace(/\n/g, ' ')}` : ''
      return `  ${name} ${pgType}${nullStr}${defStr}${desc}`
    })
    parts.push(colLines.join(',\n'))
    parts.push(');', '')
  }

  // maya_sessions confirmed constraints (OpenAPI omits FK/PK detail)
  parts.push('-- ── maya_sessions — live constraints (Phase 1 confirmed) ──')
  parts.push('ALTER TABLE public.maya_sessions ADD PRIMARY KEY (id);')
  parts.push(
    'ALTER TABLE public.maya_sessions ADD FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;',
  )
  parts.push(...MAYA_SESSIONS_INDEXES)
  parts.push('')

  writeFileSync(OUT_PATH, parts.join('\n'))
  console.log(`Wrote ${OUT_PATH} (${tableNames.length} tables from OpenAPI)`)
}

function header(source: string): string[] {
  return [
    `-- GENERATED FROM information_schema, not pg_dump`,
    `-- Snapshot date: 2026-08-21`,
    `-- Source: ${source}`,
    '',
  ]
}

function openApiTypeToPg(prop: OpenApiProp): string {
  const fmt = prop.format ?? ''
  if (prop.type === 'integer') return fmt === 'int64' ? 'bigint' : 'integer'
  if (prop.type === 'number') return 'numeric'
  if (prop.type === 'boolean') return 'boolean'
  if (prop.type === 'string') {
    if (fmt === 'uuid') return 'uuid'
    if (fmt === 'date-time') return 'timestamptz'
    if (fmt === 'date') return 'date'
    return 'text'
  }
  if (prop.type === 'object' || prop.description?.includes('json')) return 'jsonb'
  if (prop.type === 'array') return 'jsonb'
  return 'text'
}

function formatDefault(val: unknown, pgType: string): string {
  if (val === null) return 'NULL'
  if (typeof val === 'boolean') return val ? 'true' : 'false'
  if (typeof val === 'number') return String(val)
  if (pgType === 'jsonb') return `'${JSON.stringify(val)}'::jsonb`
  return `'${String(val)}'`
}

function writePartialSnapshot(note: string) {
  const body = `${header(note).join('\n')}-- maya_sessions indexes (live-confirmed):
${MAYA_SESSIONS_INDEXES.join('\n')}

CREATE TABLE IF NOT EXISTS public.maya_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  mode text,
  updated_at timestamptz,
  title text,
  canvas_context text
);
`
  writeFileSync(OUT_PATH, body)
  console.log(`Wrote partial ${OUT_PATH}`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
