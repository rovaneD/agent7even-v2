/** Parse service-order linkage embedded in support ticket bodies at order creation. */

const ORDER_ID_PATTERN = /Order ID:\s*([a-f0-9-]+)/i

export function parseOrderIdFromTicketBody(body: string | null | undefined): string | null {
  if (!body) return null
  return body.match(ORDER_ID_PATTERN)?.[1] ?? null
}

export function isServiceOrderTicketSubject(subject: string | null | undefined): boolean {
  if (!subject) return false
  return subject.startsWith('Service request:') || subject.startsWith('Self-serve service:')
}

export type LinkedServiceOrder = {
  orderId: string
  title: string | null
}

export function resolveLinkedServiceOrder(
  ticket: { subject?: string | null; body?: string | null },
  orderById: Map<string, { id: string; title: string }>,
): LinkedServiceOrder | null {
  const orderId = parseOrderIdFromTicketBody(ticket.body)
  if (!orderId) return null
  const order = orderById.get(orderId)
  return { orderId, title: order?.title ?? null }
}
