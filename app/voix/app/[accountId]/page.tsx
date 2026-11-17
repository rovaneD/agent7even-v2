import { redirect } from 'next/navigation'

export default async function VoixAccountIndex({ params }: { params: Promise<{ accountId: string }> }) {
  const { accountId } = await params
  redirect(`/voix/app/${accountId}/calls`)
}
