-- =============================================================================
-- add_credits() — atomic credit grant (top-ups, refunds-as-credit, admin grants)
-- Run in Supabase SQL editor (service_role context).
-- =============================================================================
--
-- Atomically adds credits and writes the ledger row in the same transaction.
-- Mirrors deduct_credits / refund_credits so concurrent top-up webhooks cannot
-- clobber each other via non-atomic read-modify-write on credit_balances.
--
-- Schema verified against app usage:
--   credit_balances(user_id, balance, lifetime_used, updated_at)
--   credit_ledger(user_id, type, credits, balance_after, description,
--                 task_id, orchestration_id, created_at)
-- =============================================================================

create or replace function public.add_credits(
  p_user_id     uuid,
  p_amount      integer,
  p_type        text,
  p_description text,
  p_task_id     uuid default null
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

  if p_type is null or btrim(p_type) = '' then
    raise exception 'INVALID_TYPE' using errcode = '22023';
  end if;

  if p_amount = 0 then
    select balance into v_new_balance
      from public.credit_balances
     where user_id = p_user_id;
    return coalesce(v_new_balance, 0);
  end if;

  insert into public.credit_balances (user_id, balance, updated_at)
  values (p_user_id, p_amount, now())
  on conflict (user_id) do update
    set balance    = public.credit_balances.balance + excluded.balance,
        updated_at = now()
  returning balance into v_new_balance;

  insert into public.credit_ledger
    (user_id, type, credits, balance_after, description, task_id, orchestration_id, created_at)
  values
    (p_user_id, p_type, p_amount, v_new_balance, p_description, p_task_id, null, now());

  return v_new_balance;
end;
$$;

revoke all on function public.add_credits(uuid, integer, text, text, uuid) from public, anon, authenticated;
grant execute on function public.add_credits(uuid, integer, text, text, uuid) to service_role;
