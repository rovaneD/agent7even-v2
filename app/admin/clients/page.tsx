import { requireAdmin } from '@/lib/requireAdmin'
import ClientHealthView from './ClientHealthView'

export default async function AdminClientsPage() {
  await requireAdmin()
  return <ClientHealthView />
}
