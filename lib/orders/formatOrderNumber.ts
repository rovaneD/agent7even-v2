export function formatOrderNumber(order: { id: string; created_at?: string | null }) {
  const year = order.created_at ? new Date(order.created_at).getFullYear() : new Date().getFullYear()
  const suffix = order.id.replace(/-/g, '').slice(0, 8).toUpperCase()
  return `ORD-${year}-${suffix}`
}
