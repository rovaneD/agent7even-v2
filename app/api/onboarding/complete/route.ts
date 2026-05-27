import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const {
      companyName,
      businessType,
      idealCustomer,
      sellLocations,
      marketingBudget,
      competitors,
      topGoals,
      marketingChallenge,
      contentComfort,
      websiteUrl,
      instagramHandle,
    } = await req.json()

    const supabase = createServiceClient()

    const { error } = await supabase
      .from('profiles')
      .update({
        company_name: companyName ?? null,
        business_type: businessType ?? null,
        ideal_customer: idealCustomer ?? null,
        sell_locations: sellLocations ?? [],
        marketing_budget: marketingBudget ?? null,
        competitors: competitors?.filter(Boolean) ?? [],
        top_goals: topGoals ?? [],
        marketing_challenge: marketingChallenge ?? null,
        content_comfort: contentComfort ?? null,
        website_url: websiteUrl ?? null,
        instagram_handle: instagramHandle ?? null,
        onboarding_complete: true,
        status: 'active',
        updated_at: new Date().toISOString(),
      })
      .eq('clerk_user_id', userId)

    if (error) {
      console.error('Supabase update error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Onboarding API error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
