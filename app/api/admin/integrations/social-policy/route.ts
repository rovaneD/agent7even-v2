import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/requireAdmin'
import { getSocialPolicyReport } from '@/lib/admin/socialPolicyReport'

export async function GET() {
  await requireAdmin()
  const report = await getSocialPolicyReport()
  return NextResponse.json(report)
}
