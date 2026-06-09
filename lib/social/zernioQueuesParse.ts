/** Normalise Zernio GET /queue/slots responses. */

export type ZernioQueueRow = {
  id: string
  name: string
  isDefault: boolean
  timezone: string
}

function asObject(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : []
}

function asString(v: unknown): string {
  return typeof v === 'string' ? v : v != null ? String(v) : ''
}

function mapQueue(raw: unknown): ZernioQueueRow | null {
  const row = asObject(raw)
  const id = asString(row._id ?? row.id)
  if (!id) return null
  return {
    id,
    name: asString(row.name) || 'Queue',
    isDefault: row.isDefault === true || row.is_default === true,
    timezone: asString(row.timezone ?? row.timeZone) || 'UTC',
  }
}

export function parseQueueList(raw: unknown): ZernioQueueRow[] {
  const envelope = asObject(raw)
  const nested = asObject(envelope.data ?? envelope.result)

  const candidates = [
    ...asArray(envelope.queues ?? nested.queues),
    ...asArray(envelope.schedules ?? nested.schedules),
  ]

  if (envelope.schedule) {
    const one = mapQueue(envelope.schedule)
    if (one) candidates.unshift(one)
  }
  if (nested.schedule) {
    const one = mapQueue(nested.schedule)
    if (one) candidates.unshift(one)
  }

  const seen = new Set<string>()
  const queues: ZernioQueueRow[] = []
  for (const item of candidates) {
    const mapped = mapQueue(item)
    if (mapped && !seen.has(mapped.id)) {
      seen.add(mapped.id)
      queues.push(mapped)
    }
  }

  queues.sort((a, b) => {
    if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1
    return a.name.localeCompare(b.name)
  })

  return queues
}
