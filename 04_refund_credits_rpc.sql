-- =============================================================================
-- refund_credits() — mirror of deduct_credits()
-- Run in Supabase SQL editor (service_role context).
-- =============================================================================
--
-- Adds credits back after a post-charge generation failure.
-- Does NOT decrement lifetime_used — that stays as gross spend.
-- Schema verified against live: credit_ledger(user_id, type, credits,
--   balance_after, description, task_id, orchestration_id, created_at)
--   credit_balances(user_id, balance, lifetime_used, updated_at)
-- =============================================================================

create or replace function public.refund_credits(
  p_user_id  uuid,
  p_amount   integer,
  p_reason   text,
  p_task_id  uuid default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_balance integer;
begin
  if p_amount is null or p_amount < 0 then
    raise exception 'INVALID_AMOUNT' using errcode = '22023';
  end if;

  if p_amount = 0 then
    select balance into v_new_balance
      from public.credit_balances
     where user_id = p_user_id;
    return coalesce(v_new_balance, 0);
  end if;

  update public.credit_balances
     set balance    = balance + p_amount,
         updated_at = now()
   where user_id = p_user_id
  returning balance into v_new_balance;

  if v_new_balance is null then
    raise exception 'NO_BALANCE_ROW' using errcode = 'P0002';
  end if;

  insert into public.credit_ledger
    (user_id, type, credits, balance_after, description, task_id, orchestration_id, created_at)
  values
    (p_user_id, 'refund', p_amount, v_new_balance, p_reason, p_task_id, null, now());

  return v_new_balance;
end;
$$;

revoke all on function public.refund_credits(uuid, integer, text, uuid) from public, anon, authenticated;
grant execute on function public.refund_credits(uuid, integer, text, uuid) to service_role;
