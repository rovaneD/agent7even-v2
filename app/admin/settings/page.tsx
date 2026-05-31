import { requireAdmin } from '@/lib/requireAdmin'
import { createServiceClient } from '@/lib/supabase/server'
import AdminSettingsClient from './AdminSettingsClient'
import CanvasContextDispatcher from '@/components/maya/CanvasContextDispatcher'

export default async function AdminSettingsPage() {
  await requireAdmin()

  const supabase = createServiceClient()

  // Fetch all platform settings
  const { data: settings } = await supabase
    .from('platform_settings')
    .select('*')

  const settingsMap = Object.fromEntries(
    (settings ?? []).map(s => [s.key, s.value])
  )

  // Fetch prompt library
  const { data: prompts } = await supabase
    .from('prompt_library')
    .select('*')
    .order('sort_order')

  // Fetch service catalogue
  const { data: services } = await supabase
    .from('services')
    .select('*')
    .order('sort_order')

  // Fetch all users
  const { data: users } = await supabase
    .from('profiles')
    .select('id, full_name, company_name, email, role, plan, status, created_at')
    .order('created_at', { ascending: false })

  const contextStr = [
    'ADMIN — SETTINGS',
    `Notification email: ${settingsMap.notify_email ?? 'admin@agent7even.com'}`,
    `Starter AI run limit: ${settingsMap.starter_ai_limit ?? 15} runs/month`,
    `Platform banner: ${settingsMap.platform_banner?.enabled ? `ACTIVE — "${settingsMap.platform_banner?.message}"` : 'disabled'}`,
    `Prompt library: ${(prompts ?? []).length} prompts (${(prompts ?? []).filter((p: any) => p.is_active).length} active)`,
    `Service catalogue: ${(services ?? []).length} services (${(services ?? []).filter((s: any) => s.is_active).length} active)`,
    `Total users: ${(users ?? []).length}`,
  ].join('\n')

  return (
    <>
      <CanvasContextDispatcher context={contextStr} />
      <AdminSettingsClient
        notifyEmail={settingsMap.notify_email ?? 'admin@agent7even.com'}
        starterAiLimit={settingsMap.starter_ai_limit ?? 15}
        platformBanner={settingsMap.platform_banner ?? { enabled: false, message: '', type: 'info' }}
        prompts={prompts ?? []}
        services={services ?? []}
        users={users ?? []}
      />
    </>
  )
}
