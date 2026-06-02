export const VIRAL_HOOKS_FRAMEWORK = `VIRAL HOOKS SERVICE FRAMEWORK
Use this request to craft hook ideas, not a generic content plan.

Goal:
- Create short-form content hooks that can open Reels, TikToks, YouTube Shorts, carousels, captions, or emails.
- Use the customer's business, offer, audience, pain points, desired result, and Foundation/Brand Kit context when available.
- If the customer gives limited detail, make reasonable assumptions and produce usable hooks anyway.

Hook families to use:
1. Cost-Narration Hooks
- "It took me [x] years to master [a skill], but I'm going to teach you the [x] most powerful lessons in the next [x] seconds."
- "I spent [$] on [goal], so you don't have to. Here's what was worth it and definitely not worth it."
- "It took me [x] years to learn this but I'll teach it to you in less than 1 minute."
- "After over [x] years [doing action], here's what I wish someone would've told me from day one."
- "I spent [x] hours researching and testing every [tool]. Here are the only [x] you actually need."

2. False-Statement Hooks
- "The number 1 weakness of [tool] is that it can't [do action]... just kidding, of course it can."
- "If you don't [do action] then you will never [get dream result]. And that statement is completely wrong."
- "[Thing] is not a good [option] for [situation]. It's the best for [situation]."
- "[Controversial thing] is the biggest scam ever pulled on us... or is it?"
- "Never [do action]... unless you want to [get desirable result]."

3. Comparison Hooks
- "The only difference between [negative] and [positive] is [thing]."
- "This is how [thing] used to work. This is how it works today."
- "Do you want [popular desire] or do you want [deeper desire]?"
- "This is [common option] vs [new option]."
- "Do you want to be [common label] or do you want to be [desirable label]?"

4. Callout Hooks
- "If you can't [achieve result], it's not because you're not [positive trait], it's because you don't know how to [action]."
- "Your [common excuse] isn't the problem, [actual reason] is."
- "Everybody tells you to [do action] but nobody shows you how to do it, so let's [do action] together, step by step."
- "If you want [results] for free, with literally 0 extra effort, here's what you need to do."
- "So you wanna [achieve outcome] but hate [required painful action]."

5. Bold Statement Hooks
- "[Desirable outcome] for dummies."
- "There are only [x] different [things] you need to [action] to [achieve goal]."
- "Everyone tells you to [common advice] but nobody tells you how, so here's how to [do action] in [x] easy steps."
- "If I had [x] days to [achieve goal], this is exactly what I would do."
- "I genuinely believe anybody can [accomplish goal] if you just learn [unique solution]."

Output expectation:
- Return at least 25 hooks, grouped by the 5 hook families.
- Replace all placeholders with specific language for this customer.
- For each hook, include suggested format: Reel, TikTok, Short, carousel, caption, or email.
- Include a short note on why the strongest 5 hooks should work.
- Avoid fake claims, guaranteed results, or unverifiable numbers unless the customer provided them.`

export function displayServiceBrief(brief: string | null | undefined) {
  if (!brief) return ''
  return brief.split('\n\nVIRAL HOOKS SERVICE FRAMEWORK')[0].trim()
}
