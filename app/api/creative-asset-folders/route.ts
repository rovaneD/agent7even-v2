import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createCreativeAssetFolder, listCreativeAssetFolders } from '@/lib/creativeAssets'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('clerk_user_id', userId)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const folders = await listCreativeAssetFolders(profile.id)
  return NextResponse.json({ folders })
}

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('clerk_user_id', userId)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  let body: { name?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const result = await createCreativeAssetFolder(profile.id, body.name ?? '')
  if (!result.ok) {
    return NextResponse.json(
      { error: result.code, message: result.message },
      { status: result.code === 'table_missing' ? 503 : 400 },
    )
  }

  return NextResponse.json({ folder: result.folder })
}
