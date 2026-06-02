-- =============================================================================
-- deduct_credits() — atomic credit reservation/debit
-- Run in Supabase SQL editor (service_role context).
-- =============================================================================
--
-- Atomically subtracts credits only when the user has enough balance, increments
-- lifetime_used, and writes the ledger row in the same transaction.
-- Schema verified against app usage:
--   credit_balances(user_id, balance, lifetime_used, updated_at)
--   credit_ledger(user_id, type, credits, balance_after, description,
--                 task_id, orchestration_id, created_at)
-- =============================================================================

create or replace function public.deduct_credits(
  p_user_id          uuid,
  p_amount           integer,
  p_description      text,
  p_task_id          uuid default null,
  p_orchestration_id uuid default null
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
     set balance       = balance - p_amount,
         lifetime_used = coalesce(lifetime_used, 0) + p_amount,
         updated_at    = now()
   where user_id = p_user_id
     and balance >= p_amount
  returning balance into v_new_balance;

  if v_new_balance is null then
    raise exception 'INSUFFICIENT_CREDITS' using errcode = 'P0001';
  end if;

  insert into public.credit_ledger
    (user_id, type, credits, balance_after, description, task_id, orchestration_id, created_at)
  values
    (p_user_id, 'usage', -p_amount, v_new_balance, p_description, p_task_id, p_orchestration_id, now());

  return v_new_balance;
end;
$$;

revoke all on function public.deduct_credits(uuid, integer, text, uuid, uuid) from public, anon, authenticated;
grant execute on function public.deduct_credits(uuid, integer, text, uuid, uuid) to service_role;
