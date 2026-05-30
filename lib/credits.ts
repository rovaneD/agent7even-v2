import { createServiceClient } from '@/lib/supabase/server'

export async function deductCredits(
  profileId: string,
  credits: number,
  description: string
): Promise<void> {
  const supabase = createServiceClient()

  const { data: balance, error } = await supabase
    .from('credit_balances')
    .select('balance')
    .eq('user_id', profileId)
    .single()

  if (error || !balance) throw new Error('Credit balance not found')
  if (balance.balance < credits) throw new Error('Insufficient credits')

  const newBalance = balance.balance - credits

  await supabase
    .from('credit_balances')
    .update({ balance: newBalance, updated_at: new Date().toISOString() })
    .eq('user_id', profileId)

  await supabase.from('credit_ledger').insert({
    user_id:      profileId,
    type:         'debit',
    credits:      -credits,
    balance_after: newBalance,
    description,
  })
}
