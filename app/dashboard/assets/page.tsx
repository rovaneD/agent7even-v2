import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { listCreativeAssets, listCreativeAssetFolders } from '@/lib/creativeAssets'
import { createServiceClient } from '@/lib/supabase/server'
import AssetsClient from './AssetsClient'

export default async function AssetsPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const supabase = createServiceClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, company_name')
    .eq('clerk_user_id', userId)
    .single()

  if (!profile) redirect('/dashboard')

  const [assets, folders] = await Promise.all([
    listCreativeAssets(profile.id),
    listCreativeAssetFolders(profile.id),
  ])

  return (
    <AssetsClient
      companyName={profile.company_name ?? ''}
      initialAssets={assets}
      initialFolders={folders}
    />
  )
}
