import { timingSafeEqual } from 'crypto'

export function isAuthorizedCronRequest(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false

  const authHeader = req.headers.get('authorization') ?? ''
  const expected = `Bearer ${secret}`
  const actualBuffer = Buffer.from(authHeader)
  const expectedBuffer = Buffer.from(expected)

  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer)
}
