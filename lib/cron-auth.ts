export function isAuthorizedCronRequest(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  const authHeader = req.headers.get('authorization')

  return Boolean(secret) && authHeader === `Bearer ${secret}`
}
