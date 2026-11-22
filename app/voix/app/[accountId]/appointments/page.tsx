import { requireVoixAccount } from '@/lib/voix/access'
import { APPOINTMENT_SELECT, type BookingWindows, type VoixAppointment } from '@/lib/voix/appointments'
import AppointmentsBoard from './AppointmentsBoard'

export const dynamic = 'force-dynamic'

export default async function AppointmentsPage({ params }: { params: Promise<{ accountId: string }> }) {
  const { accountId } = await params
  const { account, supabase } = await requireVoixAccount(accountId)
  const since = new Date(Date.now() - 35 * 86_400_000).toISOString()
  const { data: cfg } = await supabase.from('voix_accounts').select('booking_windows').eq('id', account.id).maybeSingle()
  const { data } = await supabase
    .from('voix_appointments')
    .select(APPOINTMENT_SELECT)
    .eq('account_id', account.id)
    .or(`start_at.gte.${since},status.eq.pending`)
    .order('start_at', { ascending: true })
    .limit(300)

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-[40px] leading-none" style={{ fontFamily: 'var(--voix-serif), Georgia, serif' }}>
          Appointments
        </h1>
        <p className="mt-2 text-sm text-[#5B6070]">
          Times Voix offered callers. Confirm each one after you add it to your booking system; Voix then calls the client to confirm.
        </p>
      </div>
      <AppointmentsBoard accountId={account.id} timezone={account.timezone} items={(data ?? []) as VoixAppointment[]}
        windows={((cfg?.booking_windows ?? {}) as BookingWindows)}
      />
    </div>
  )
}
