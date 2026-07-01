import Link from 'next/link'
import {
  OS_STACK_LAYERS,
  SCATTERED_TOOLS,
  STACK_COMPARE_ROWS,
} from '@/lib/marketing/stackCompareContent'

export default function StackCompareSection() {
  const visibleTools = SCATTERED_TOOLS.slice(0, 5)
  const overflowCount = SCATTERED_TOOLS.length - visibleTools.length

  return (
    <section id="why-os" className="stack-compare-section">
      <div className="wrap">
        <div className="sec-head stack-compare-head reveal">
          <span className="eyebrow">Why an OS</span>
          <h2 className="t-h2">Stop stitching marketing together&nbsp;yourself.</h2>
          <p className="t-lead">
            Most owners already juggle AI, design, and scheduling. One Foundation feeds every agent.
            Agent7even connects the work into one approval-first system.
            <br />
            <Link href="/how-it-works">See the full&nbsp;workflow →</Link>
          </p>
        </div>

        <div className="stack-panel reveal">
          <div className="stack-flow">
            <div className="stack-flow-side">
              <span className="stack-flow-label">Today</span>
              <div className="stack-flow-tools">
                {visibleTools.map((tool) => (
                  <span key={tool} className="stack-flow-tool">
                    {tool}
                  </span>
                ))}
                {overflowCount > 0 && (
                  <span className="stack-flow-tool stack-flow-tool-more">+{overflowCount}</span>
                )}
              </div>
            </div>

            <div className="stack-flow-bridge" aria-hidden="true">
              <span className="stack-flow-bridge-line" />
              <span className="stack-flow-bridge-icon">→</span>
              <span className="stack-flow-bridge-line" />
            </div>

            <div className="stack-flow-side stack-flow-side-os">
              <span className="stack-flow-label">With Agent7even</span>
              <p className="stack-flow-os">One Foundation. Twelve specialist agents. One approval queue.</p>
            </div>
          </div>

          <div className="stack-body">
            <div className="stack-rails">
              {STACK_COMPARE_ROWS.map((row) => (
                <article key={row.dimension} className="stack-rail">
                  <span className="stack-rail-dim">{row.dimension}</span>
                  <div className="stack-rail-copy">
                    <p className="stack-rail-before">{row.scattered}</p>
                    <p className="stack-rail-after">{row.os}</p>
                  </div>
                </article>
              ))}
            </div>

            <aside className="stack-spine-wrap" aria-label="Agent7even marketing stack">
              <p className="stack-spine-title">How the stack connects</p>
              <ol className="stack-spine">
                {OS_STACK_LAYERS.map((layer, index) => (
                  <li key={layer} className={`stack-spine-step stack-spine-step-${index + 1}`}>
                    <span className="stack-spine-node" aria-hidden="true" />
                    <span className="stack-spine-label">{layer}</span>
                  </li>
                ))}
              </ol>
            </aside>
          </div>
        </div>
      </div>
    </section>
  )
}
