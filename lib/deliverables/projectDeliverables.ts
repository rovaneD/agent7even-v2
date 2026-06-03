export type ProjectBackedDeliverable = {
  id: string
  project_id: string
  project_name: string
  file_name: string
  file_path: string
  file_size: number | null
  file_type: string | null
  notes: string | null
  uploaded_by: string | null
  uploaded_by_role: string | null
  created_at: string
}

export function errorMessage(error: unknown) {
  if (!error) return 'Unknown error'
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && 'message' in error && typeof error.message === 'string') return error.message
  return String(error)
}

export function safeStorageSegment(value: string) {
  return value
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'deliverable'
}

export async function ensureDeliverablesBucket(supabase: any) {
  const { error } = await supabase.storage.createBucket('deliverables', {
    public: false,
    fileSizeLimit: 50 * 1024 * 1024,
  })

  if (error && !/already exists/i.test(errorMessage(error))) {
    throw new Error(`Deliverables bucket could not be created: ${errorMessage(error)}`)
  }
}

export async function uploadDeliverableFile({
  supabase,
  filePath,
  body,
  contentType,
}: {
  supabase: any
  filePath: string
  body: Uint8Array
  contentType: string
}) {
  let { error } = await supabase.storage.from('deliverables').upload(filePath, body, {
    contentType,
    upsert: false,
  })

  if (error && /bucket/i.test(errorMessage(error)) && /not found|does not exist/i.test(errorMessage(error))) {
    await ensureDeliverablesBucket(supabase)
    const retry = await supabase.storage.from('deliverables').upload(filePath, body, {
      contentType,
      upsert: false,
    })
    error = retry.error
  }

  if (error) throw new Error(`Deliverables storage upload failed: ${errorMessage(error)}`)
}

export async function findOrCreateProject({
  supabase,
  userId,
  title,
  description,
}: {
  supabase: any
  userId: string
  title: string
  description?: string
}) {
  const { data: existing, error: selectError } = await supabase
    .from('projects')
    .select('id, title')
    .eq('user_id', userId)
    .eq('title', title)
    .maybeSingle()

  if (selectError) throw new Error(`Project lookup failed: ${errorMessage(selectError)}`)
  if (existing) return existing

  const { data: project, error: insertError } = await supabase
    .from('projects')
    .insert({
      user_id: userId,
      title,
      description: description ?? null,
      phase: 'active',
      progress_percent: 0,
    })
    .select('id, title')
    .single()

  if (insertError) throw new Error(`Project record insert failed: ${errorMessage(insertError)}`)
  return project
}

export function normalizeDeliverable(row: any): ProjectBackedDeliverable {
  const project = Array.isArray(row.projects) ? row.projects[0] : row.projects

  return {
    id: row.id,
    project_id: row.project_id,
    project_name: project?.title ?? 'Deliverables',
    file_name: row.title,
    file_path: row.file_url,
    file_size: row.file_size ?? null,
    file_type: row.file_type ?? null,
    notes: row.description ?? null,
    uploaded_by: row.uploaded_by ?? null,
    uploaded_by_role: row.uploaded_by_role ?? null,
    created_at: row.created_at,
  }
}
