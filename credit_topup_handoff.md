# Credit Top-Up — Claude Code Handoff
*Work queue item 17*

Read MAYA_CONTEXT.md and CONTEXTV9.md before starting.
Confirm `git remote -v` shows `agent7even-v2`.

---

## Overview

One-time Stripe checkout for purchasing additional credits mid-month.
Top-up credits never expire and accumulate on top of monthly plan allocation.

Three surfaces:
1. Low balance modal — triggered from CreditBalance widget when ≤20% remaining
2. Billing page section — always visible below current plan card
3. Success page — post-checkout confirmation

---

## Part 1 — Stripe Setup

### Create products in Stripe dashboard (test mode)
Three one-time products — not subscriptions:

| Product | Credits | Price | Stripe Price ID env var |
|---|---|---|---|
| Credits — Small | 100 | $5.00 | `STRIPE_CREDITS_SMALL_PRICE_ID` |
| Credits — Medium | 350 | $15.00 | `STRIPE_CREDITS_MEDIUM_PRICE_ID` |
| Credits — Large | 1,000 | $40.00 | `STRIPE_CREDITS_LARGE_PRICE_ID` |

Add to `.env.local` and Vercel env vars:
```
STRIPE_CREDITS_SMALL_PRICE_ID=price_...
STRIPE_CREDITS_MEDIUM_PRICE_ID=price_...
STRIPE_CREDITS_LARGE_PRICE_ID=price_...
```

---

## Part 2 — Schema

```sql
-- Track top-up purchases separately from plan allocations
CREATE TABLE IF NOT EXISTS credit_topups (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid REFERENCES profiles(id) ON DELETE CASCADE,
  stripe_session_id  text NOT NULL,
  stripe_payment_id  text,
  credits            integer NOT NULL,
  amount_usd         numeric(10, 2) NOT NULL,
  status             text DEFAULT 'pending', -- pending | completed | refunded
  created_at         timestamptz DEFAULT now(),
  completed_at       timestamptz
);

CREATE INDEX idx_credit_topups_user ON credit_topups(user_id, created_at DESC);
CREATE INDEX idx_credit_topups_session ON credit_topups(stripe_session_id);
```

---

## Part 3 — Credit Packages Constant

Create `lib/credits-packages.ts`:

```typescript
export interface CreditPackage {
  id:          'small' | 'medium' | 'large'
  credits:     number
  priceUsd:    number
  label:       string
  description: string
  priceId:     string
  popular?:    boolean
}

export const CREDIT_PACKAGES: CreditPackage[] = [
  {
    id:          'small',
    credits:     100,
    priceUsd:    5,
    label:       '100 credits',
    description: 'Good for a few campaigns or Maya sessions',
    priceId:     process.env.STRIPE_CREDITS_SMALL_PRICE_ID!,
  },
  {
    id:          'medium',
    credits:     350,
    priceUsd:    15,
    label:       '350 credits',
    description: 'Same as a monthly Growth allocation',
    priceId:     process.env.STRIPE_CREDITS_MEDIUM_PRICE_ID!,
    popular:     true,
  },
  {
    id:          'large',
    credits:     1000,
    priceUsd:    40,
    label:       '1,000 credits',
    description: 'Same as a monthly ProAgent allocation',
    priceId:     process.env.STRIPE_CREDITS_LARGE_PRICE_ID!,
  },
]

export const CREDIT_VALUE_USD = 0.04 // $0.04 per credit
```

---

## Part 4 — Checkout API Route

Create `app/api/stripe/credits/checkout/route.ts`:

```typescript
import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createServiceClient } from '@/lib/supabase/server'
import { CREDIT_PACKAGES } from '@/lib/credits-packages'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-11-20.acacia',
})

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { packageId } = await req.json()
  const pkg = CREDIT_PACKAGES.find(p => p.id === packageId)
  if (!pkg) return NextResponse.json({ error: 'Invalid package' }, { status: 400 })

  const supabase = createServiceClient()
  const { data: profileRows } = await supabase
    .from('profiles')
    .select('id, email, full_name')
    .eq('clerk_user_id', userId)
    .limit(1)
  const profile = profileRows?.[0]
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://agent7even-v2.vercel.app'

  const session = await stripe.checkout.sessions.create({
    mode:                 'payment',
    payment_method_types: ['card'],
    line_items: [{
      price:    pkg.priceId,
      quantity: 1,
    }],
    customer_email: profile.email,
    success_url: `${appUrl}/dashboard/billing?topup=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url:  `${appUrl}/dashboard/billing?topup=cancelled`,
    metadata: {
      user_id:   profile.id,
      package_id: pkg.id,
      credits:   pkg.credits.toString(),
    },
  })

  // Create pending topup record
  await supabase.from('credit_topups').insert({
    user_id:           profile.id,
    stripe_session_id: session.id,
    credits:           pkg.credits,
    amount_usd:        pkg.priceUsd,
    status:            'pending',
  })

  return NextResponse.json({ url: session.url })
}
```

---

## Part 5 — Webhook Handler

Update existing Stripe webhook at `app/api/stripe/webhook/route.ts`
to handle `checkout.session.completed` for credit top-ups:

```typescript
// Add to existing webhook handler switch/if block:

if (event.type === 'checkout.session.completed') {
  const session = event.data.object as Stripe.Checkout.Session

  // Only handle credit top-up sessions (they have credits in metadata)
  if (session.metadata?.credits && session.metadata?.user_id) {
    const supabase = createServiceClient()
    const credits  = parseInt(session.metadata.credits)
    const userId   = session.metadata.user_id

    // 1. Update topup record
    await supabase
      .from('credit_topups')
      .update({
        status:           'completed',
        stripe_payment_id: session.payment_intent as string,
        completed_at:     new Date().toISOString(),
      })
      .eq('stripe_session_id', session.id)

    // 2. Add credits to balance
    const { data: current } = await supabase
      .from('credit_balances')
      .select('balance, lifetime_used')
      .eq('user_id', userId)
      .single()

    const newBalance = (current?.balance ?? 0) + credits

    await supabase
      .from('credit_balances')
      .upsert({
        user_id:      userId,
        balance:      newBalance,
        updated_at:   new Date().toISOString(),
      })

    // 3. Log to credit ledger
    await supabase.from('credit_ledger').insert({
      user_id:      userId,
      type:         'topup',
      credits:      credits,
      balance_after: newBalance,
      description:  `Credit top-up — ${credits} credits ($${session.amount_total! / 100})`,
    })

    // 4. Send confirmation notification
    await supabase.from('notifications').insert({
      user_id:    userId,
      type:       'credit_topup',
      title:      `${credits} credits added`,
      message:    `Your credit top-up is complete. You now have ${newBalance} credits available.`,
      read:       false,
      action_url: '/dashboard/billing',
    })
  }
}
```

---

## Part 6 — Credit Top-Up UI Component

Create `components/billing/CreditTopUp.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { CREDIT_PACKAGES, type CreditPackage } from '@/lib/credits-packages'
import { Zap } from 'lucide-react'

interface Props {
  currentBalance: number
  onSuccess?: () => void
}

export default function CreditTopUp({ currentBalance, onSuccess }: Props) {
  const [selected, setSelected] = useState<string>('medium')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handlePurchase() {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/stripe/credits/checkout', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ packageId: selected }),
      })
      const data = await res.json()

      if (data.url) {
        window.location.href = data.url
      } else {
        setError('Could not start checkout. Please try again.')
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6">
      <div className="flex items-center gap-2 mb-1">
        <Zap className="w-4 h-4 text-[#c8522a]" />
        <h3 className="font-semibold text-gray-900">Top up credits</h3>
      </div>
      <p className="text-sm text-gray-400 mb-5">
        Current balance: <span className="font-medium text-gray-700">
          {currentBalance} credits
        </span> · Credits never expire
      </p>

      {/* Package selector */}
      <div className="space-y-3 mb-5">
        {CREDIT_PACKAGES.map(pkg => (
          <button
            key={pkg.id}
            onClick={() => setSelected(pkg.id)}
            className={`w-full flex items-center justify-between px-4 py-3.5
                        rounded-xl border-2 text-left transition-all
                        ${selected === pkg.id
                          ? 'border-black bg-black text-white'
                          : 'border-gray-100 hover:border-gray-300'}`}
          >
            <div>
              <div className="flex items-center gap-2">
                <span className={`text-sm font-semibold
                  ${selected === pkg.id ? 'text-white' : 'text-gray-900'}`}>
                  {pkg.label}
                </span>
                {pkg.popular && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                    ${selected === pkg.id
                      ? 'bg-white/20 text-white'
                      : 'bg-[#c8522a]/10 text-[#c8522a]'}`}>
                    Popular
                  </span>
                )}
              </div>
              <p className={`text-xs mt-0.5
                ${selected === pkg.id ? 'text-gray-300' : 'text-gray-400'}`}>
                {pkg.description}
              </p>
            </div>
            <span className={`text-lg font-bold ml-4 flex-shrink-0
              ${selected === pkg.id ? 'text-white' : 'text-gray-900'}`}>
              ${pkg.priceUsd}
            </span>
          </button>
        ))}
      </div>

      {error && (
        <p className="text-sm text-red-500 mb-3">{error}</p>
      )}

      <button
        onClick={handlePurchase}
        disabled={loading}
        className="w-full py-3 bg-[#c8522a] text-white font-medium rounded-xl
                   hover:bg-[#b44a25] transition-colors disabled:opacity-50
                   disabled:cursor-not-allowed"
      >
        {loading ? 'Redirecting to checkout…' : `Buy ${CREDIT_PACKAGES.find(p => p.id === selected)?.label}`}
      </button>

      <p className="text-xs text-gray-400 text-center mt-3">
        Secured by Stripe · Credits added instantly after payment
      </p>
    </div>
  )
}
```

---

## Part 7 — Low Balance Modal

Create `components/billing/LowBalanceModal.tsx`:

Triggered from `CreditBalance` component in sidebar when balance ≤ 20% of plan max.

```tsx
'use client'

import { useState } from 'react'
import { X, Zap } from 'lucide-react'
import CreditTopUp from './CreditTopUp'

interface Props {
  balance:     number
  planMax:     number
  onDismiss:   () => void
}

export default function LowBalanceModal({ balance, planMax, onDismiss }: Props) {
  const pct = Math.round((balance / planMax) * 100)

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center
                    justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
        <div className="flex items-start justify-between p-6 pb-0">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Zap className="w-4 h-4 text-orange-500" />
              <h2 className="font-semibold text-gray-900">Running low on credits</h2>
            </div>
            <p className="text-sm text-gray-400">
              You have {balance} credits left ({pct}% of your plan).
              Top up to keep Maya and your agents running.
            </p>
          </div>
          <button
            onClick={onDismiss}
            className="text-gray-400 hover:text-gray-600 ml-4 flex-shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6">
          <CreditTopUp currentBalance={balance} onSuccess={onDismiss} />
        </div>
        <div className="px-6 pb-4">
          <button
            onClick={onDismiss}
            className="w-full py-2 text-sm text-gray-400 hover:text-gray-600"
          >
            Remind me later
          </button>
        </div>
      </div>
    </div>
  )
}
```

Update `CreditBalance.tsx` to show modal when low:

```tsx
// Add to CreditBalance component:
const [showModal, setShowModal] = useState(false)

// Show modal once per session when balance drops ≤ 20%
useEffect(() => {
  if (balance !== null && balance <= max * 0.2) {
    const dismissed = sessionStorage.getItem('low-balance-dismissed')
    if (!dismissed) setShowModal(true)
  }
}, [balance])

// In render:
{showModal && (
  <LowBalanceModal
    balance={balance ?? 0}
    planMax={max}
    onDismiss={() => {
      setShowModal(false)
      sessionStorage.setItem('low-balance-dismissed', 'true')
    }}
  />
)}
```

---

## Part 8 — Billing Page Integration

In `app/dashboard/billing/BillingClient.tsx`, add `CreditTopUp`
below the current plan card:

```tsx
// Import
import CreditTopUp from '@/components/billing/CreditTopUp'

// Add below existing plan card, above invoice history:
<div className="mt-6">
  <CreditTopUp currentBalance={creditBalance} />
</div>
```

Also handle `?topup=success` and `?topup=cancelled` query params
to show success/cancelled banners:

```tsx
const searchParams = useSearchParams()
const topupStatus = searchParams.get('topup')

{topupStatus === 'success' && (
  <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 mb-6
                  flex items-center gap-3">
    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
    <div>
      <p className="text-sm font-medium text-green-800">Credits added successfully</p>
      <p className="text-xs text-green-600 mt-0.5">
        Your new credits are available immediately.
      </p>
    </div>
  </div>
)}

{topupStatus === 'cancelled' && (
  <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 mb-6">
    <p className="text-sm text-gray-600">Purchase cancelled — no charge was made.</p>
  </div>
)}
```

---

## Part 9 — Credit Ledger Type

Update `credit_ledger` type column to accept `'topup'` — it currently
accepts `'allocation' | 'usage' | 'refund' | 'bonus'`. Either add a
check constraint or just ensure the insert uses `'topup'` as the type
string (Postgres text column accepts any value).

---

## Definition of Done

- [ ] Three Stripe products created in test mode with correct price IDs
- [ ] Env vars added: `STRIPE_CREDITS_SMALL_PRICE_ID`, `STRIPE_CREDITS_MEDIUM_PRICE_ID`, `STRIPE_CREDITS_LARGE_PRICE_ID`
- [ ] SQL migration run — `credit_topups` table
- [ ] `lib/credits-packages.ts` created with 3 packages
- [ ] `POST /api/stripe/credits/checkout` creates Stripe session + pending topup row
- [ ] Stripe webhook handles `checkout.session.completed` for credit purchases
- [ ] Webhook adds credits to `credit_balances` + logs to `credit_ledger` with type `topup`
- [ ] Webhook sends in-app notification on successful purchase
- [ ] `CreditTopUp` component renders correctly with 3 package options
- [ ] Medium package shows "Popular" badge
- [ ] Selecting a package and clicking buy redirects to Stripe checkout
- [ ] Post-checkout success redirect shows success banner on billing page
- [ ] Post-checkout cancel redirect shows cancelled message
- [ ] `LowBalanceModal` appears when balance ≤ 20% of plan max
- [ ] Modal shows once per session (sessionStorage dismiss)
- [ ] "Remind me later" dismisses for the session
- [ ] `CreditTopUp` component visible on billing page below plan card
- [ ] Test end-to-end with Stripe test card `4242 4242 4242 4242`
- [ ] Verify `credit_balances` increases by correct amount after test purchase
- [ ] Verify `credit_topups` row shows `status=completed` after webhook fires
- [ ] Verify `credit_ledger` has `type=topup` row with correct credits

