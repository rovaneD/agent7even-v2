import { NextResponse } from 'next/server'
import { generateText } from 'ai'
import { models } from '@/lib/ai/client'
import { updateTaskStatus, saveAgentOutput, buildSystemPrompt } from '@/lib/agents/runner'

function parseCampaignSections(text: string): Record<string, string> {
  const sections: Record<string, string> = {}
  const sectionNames = [
    'OVERVIEW', 'WEEK 1', 'WEEK 2', 'WEEK 3', 'WEEK 4',
    'CONTENT CALENDAR', 'EMAIL', 'BUDGET ALLOCATION', 'SUCCESS METRICS',
  ]

  sectionNames.forEach((name, i) => {
    const start = text.indexOf(name + ':')
    if (start === -1) return
    const nextPos = sectionNames
      .slice(i + 1)
      .map(n => text.indexOf(n + ':'))
      .filter(pos => pos > start)
      .sort((a, b) => a - b)[0]

    sections[name] = nextPos
      ? text.slice(start + name.length + 1, nextPos).trim()
      : text.slice(start + name.length + 1).trim()
  })

  return sections
}

export async function POST(req: Request) {
  const { taskId, input } = await req.json()

  if (!taskId) return NextResponse.json({ error: 'taskId required' }, { status: 400 })

  await updateTaskStatus(taskId, 'running')

  const baseSystem = await buildSystemPrompt(input.userId as string, 'campaign_builder')
  const system = baseSystem
    + (input.rejection_feedback
      ? `\n\nIMPORTANT — Previous version was rejected with this feedback: "${input.rejection_feedback}". Address this directly in the OVERVIEW before anything else.`
      : '')

  try {
    const { text } = await generateText({
      model: models.campaignGenerator,
      system,
      messages: [{
        role: 'user',
        content: `Build my 30-day marketing campaign.${input.conversation_summary ? ` Context from our conversation: ${JSON.stringify(input.conversation_summary)}` : ''}`,
      }],
      maxOutputTokens: 3000,
    })

    await saveAgentOutput({
      taskId,
      userId: input.userId as string,
      agent: 'campaign_builder',
      outputType: 'campaign',
      title: `30-Day Campaign — ${input.company_name ?? 'Your Business'}`,
      content: { raw: text, parsed: parseCampaignSections(text) },
    })

    await updateTaskStatus(taskId, 'complete', { outputSaved: true })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Campaign builder error:', err)
    await updateTaskStatus(taskId, 'failed', {}, String(err))
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
