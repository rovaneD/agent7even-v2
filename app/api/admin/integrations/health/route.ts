import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/requireAdmin'
import { createServiceClient } from '@/lib/supabase/server'
import { getIntegrationsHealth } from '@/lib/integrationsHealth'

export async function GET() {
  await requireAdmin()

  const supabase = createServiceClient()
  const [{ count: connectedGaTenantCount }, { data: sampleProfile }] = await Promise.all([
    supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .not('ga_refresh_token', 'is', null),
    supabase
      .from('profiles')
      .select('ga_refresh_token')
      .not('ga_refresh_token', 'is', null)
      .limit(1)
      .maybeSingle(),
  ])

  const report = await getIntegrationsHealth({
    sampleRefreshToken: sampleProfile?.ga_refresh_token,
    connectedGaTenantCount: connectedGaTenantCount ?? 0,
  })

  return NextResponse.json(report)
}
