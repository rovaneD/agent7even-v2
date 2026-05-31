import { requireAdmin } from '@/lib/requireAdmin'
import CostActivityView from './CostActivityView'

export default async function AdminCostPage() {
  await requireAdmin()
  return <CostActivityView />
}
