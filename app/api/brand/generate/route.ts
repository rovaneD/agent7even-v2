import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient } from '@/lib/supabase/server'
import { resolveClerkProfile } from '@/lib/profiles/resolveClerkProfile'
import { DOCUMENT_TYPES } from '@/app/dashboard/brand-kit/questions'
import { createNotification } from '@/lib/createNotification'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function buildPrompt(docType: string, answers: Record<string, unknown>): string {
  const a = answers as Record<string, string | string[]>

  const context = `
Business Description: ${a.business_description ?? ''}
Who They Serve: ${a.who_you_serve ?? ''}
Problem Solved: ${a.problem_solved ?? ''}
Transformation: ${a.transformation ?? ''}
Mission: ${a.mission ?? ''}
Core Values: ${Array.isArray(a.core_values) ? a.core_values.join(', ') : a.core_values ?? ''}
Stands For: ${a.stands_for ?? ''}
Stands Against: ${a.stands_against ?? ''}
Personality Words: ${Array.isArray(a.personality_words) ? a.personality_words.join(', ') : a.personality_words ?? ''}
Tone Descriptors: ${Array.isArray(a.tone_descriptors) ? a.tone_descriptors.join(', ') : a.tone_descriptors ?? ''}
Tone To Avoid: ${a.tone_avoid ?? ''}
Brands Admired: ${a.brand_admired ?? ''}
Client Fears: ${a.client_fears ?? ''}
Client Aspirations: ${a.client_aspirations ?? ''}
Client Objections: ${a.client_objections ?? ''}
What They Need To Hear: ${a.what_they_need_to_hear ?? ''}
Competitors: ${a.competitors ?? ''}
Differentiators: ${a.differentiators ?? ''}
Proof Points: ${a.proof_points ?? ''}
Price Positioning: ${a.price_positioning ?? ''}
Origin Story: ${a.origin_story ?? ''}
Founder Motivation: ${a.founder_motivation ?? ''}
Defining Moment: ${a.defining_moment ?? ''}
Future Vision: ${a.future_vision ?? ''}
`.trim()

  const prompts: Record<string, string> = {
    voice: `You are a brand strategist writing a professional Brand Voice Statement for a business.

Based on the following brand information, write a comprehensive Brand Voice Statement that covers:
1. Voice Overview (2-3 sentences describing the overall tone)
2. Personality Traits (the 3-5 core traits with a short description of what each means in practice)
3. How We Speak (5-7 specific guidelines for writing in this voice)
4. Words We Use (10-15 words and phrases that fit the brand)
5. Words We Avoid (8-10 words and phrases that feel off-brand, with brief explanations)
6. Voice In Action (3 examples: one social media post, one email opener, one tagline — all in this voice)

Write in a clear, professional format. Be specific and actionable. This document will be used by anyone creating content for this brand.

Brand Information:
${context}

Write the Brand Voice Statement now:`,

    story: `You are a brand copywriter writing a powerful Brand Story for a business.

Based on the following brand information, write a compelling Brand Story that includes:
1. The Opening Hook (1-2 sentences that immediately capture attention)
2. The Problem (what gap or frustration existed before this business)
3. The Origin (how and why this business was created — the human story)
4. The Mission (what drives the business beyond profit)
5. Who We Serve (a vivid description of the ideal client and what they need)
6. The Promise (what the business commits to delivering)
7. The Vision (where the business is going and the impact it will create)

Write in a warm, authentic, narrative voice. Aim for 400-500 words total. This story should feel human and true — not corporate. It should make the ideal client feel seen and understood.

Brand Information:
${context}

Write the Brand Story now:`,

    persona: `You are a brand strategist creating a detailed Ideal Client Profile (buyer persona) for a business.

Based on the following brand information, create a comprehensive Ideal Client Profile that includes:
1. Profile Name & Overview (give the persona a name and 2-3 sentence summary)
2. Demographics (age range, role/title, business size, industry, location)
3. Psychographics (values, beliefs, lifestyle, what they care about)
4. Goals & Aspirations (what they're working toward professionally and personally)
5. Fears & Frustrations (what keeps them up at night, what they're afraid of)
6. Buying Triggers (what makes them take action and invest)
7. Objections (what holds them back before saying yes)
8. Where They Hang Out (platforms, communities, media they consume)
9. How To Speak To Them (the exact language and messaging that resonates)
10. What They Need To Hear (the core message that makes them feel understood)

Be specific and vivid. A good persona feels like a real person. Use the brand's own words where possible.

Brand Information:
${context}

Write the Ideal Client Profile now:`,

    positioning: `You are a brand strategist writing a Brand Positioning Statement for a business.

Based on the following brand information, create a comprehensive Brand Positioning document that includes:
1. The Core Positioning Statement (the classic "For [audience] who [need], [brand] is the [category] that [benefit] because [reason to believe]" format — written 2-3 different ways)
2. The One-Liner (a single sentence that captures the brand's unique value — punchy and memorable)
3. The Elevator Pitch (3-4 sentences — what you do, who for, why it matters, what makes you different)
4. Competitive Positioning (how this brand sits relative to competitors — what it owns that no one else can claim)
5. Key Proof Points (the 3-5 strongest reasons to believe the positioning)
6. Positioning In Headlines (5 example headlines that express this positioning — for ads, landing pages, social)

Be direct and confident. Good positioning is specific, not generic. Avoid vague claims — every statement should be ownable.

Brand Information:
${context}

Write the Brand Positioning Statement now:`,
  }

  return prompts[docType] ?? ''
}

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { answers } = await req.json()

  const supabase = createServiceClient()

  const profile = await resolveClerkProfile(supabase, userId, 'id')

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  // Generate all 4 documents in parallel
  const generations = await Promise.all(
    DOCUMENT_TYPES.map(async (docType) => {
      const prompt = buildPrompt(docType.type, answers)

      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      })

      const content = message.content[0].type === 'text' ? message.content[0].text : ''
      return { type: docType.type, title: docType.title, content }
    })
  )

  // Save each document — upsert so regeneration updates in place
  const savedDocuments = await Promise.all(
    generations.map(async (gen) => {
      const { data: existing } = await supabase
        .from('brand_documents')
        .select('id, version, content')
        .eq('user_id', profile.id)
        .eq('type', gen.type)
        .single()

      if (existing) {
        // Archive current version before overwriting
        await supabase.from('brand_document_versions').insert({
          document_id: existing.id,
          content: existing.content,
          version: existing.version,
        })

        const { data: updated } = await supabase
          .from('brand_documents')
          .update({
            content: gen.content,
            version: existing.version + 1,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
          .select()
          .single()

        return updated
      } else {
        const { data: created } = await supabase
          .from('brand_documents')
          .insert({
            user_id: profile.id,
            type: gen.type,
            title: gen.title,
            content: gen.content,
            version: 1,
          })
          .select()
          .single()

        return created
      }
    })
  )

  await createNotification({
    userId: profile.id,
    title: 'Your Brand Kit is ready',
    body: 'Your Brand Voice Statement, Brand Story, Ideal Client Profile, and Positioning Statement have been generated.',
    type: 'brand_kit_generated',
    link: '/dashboard/brand-kit',
    sendEmail: false,
  })

  return NextResponse.json({ documents: savedDocuments.filter(Boolean) })
}
