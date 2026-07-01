import MayaOrb from '@/components/maya/MayaOrb'
import { HOW_IT_WORKS_STEPS } from '@/lib/marketing/howItWorksContent'

function StepVisual({ stepN }: { stepN: string }) {
  if (stepN === '01') {
    return (
      <div className="step-ui step-ui-chat">
        <div className="step-ui-chat-hd">
          <MayaOrb size={24} active />
          <span>Maya</span>
        </div>
        <div className="step-ui-bubble step-ui-bubble-user">Fill next Friday — it&apos;s our slow day.</div>
        <div className="step-ui-bubble step-ui-bubble-maya">
          On it. Drafting promo in your canvas now.
        </div>
      </div>
    )
  }

  if (stepN === '02') {
    return (
      <div className="step-ui step-ui-context">
        <div className="step-ui-pills">
          <span className="step-ui-pill step-ui-pill-foundation">Foundation</span>
          <span className="step-ui-pill step-ui-pill-brand">Brand Kit</span>
        </div>
        <p className="step-ui-feed-label">Feeds every specialist agent</p>
        <div className="step-ui-tags">
          <span>Campaign</span>
          <span>Posts</span>
          <span>Creative</span>
          <span>SEO</span>
        </div>
      </div>
    )
  }

  return (
    <div className="step-ui step-ui-approve">
      <div className="step-ui-queue step-ui-queue-active">
        <div>
          <p className="step-ui-queue-title">Friday promo</p>
          <p className="step-ui-queue-sub">Draft ready</p>
        </div>
        <span className="step-ui-queue-btn">Approve</span>
      </div>
      <div className="step-ui-queue">
        <div>
          <p className="step-ui-queue-title">IG post</p>
          <p className="step-ui-queue-sub">Brand Kit applied</p>
        </div>
        <span className="step-ui-queue-tag">Review</span>
      </div>
    </div>
  )
}

export default function HowItWorksSteps() {
  return (
    <div className="steps steps-polished">
      {HOW_IT_WORKS_STEPS.map((step) => (
        <article key={step.n} className={`step step-polished step-accent-${step.accent} reveal`}>
          <div className={`step-visual step-visual-${step.accent}`}>
            <div className="step-head">
              <span className="step-n">{step.n}</span>
              <span className="step-kicker">{step.kicker}</span>
            </div>
            <StepVisual stepN={step.n} />
          </div>
          <div className="step-body">
            <h3>
              {step.title}
              {step.titleBreak ? (
                <>
                  <br />
                  {step.titleBreak}
                </>
              ) : null}
            </h3>
            <p>{step.body}</p>
          </div>
        </article>
      ))}
    </div>
  )
}
