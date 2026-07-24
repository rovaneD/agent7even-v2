import Link from 'next/link'
import {
  AGENT7EVEN_SCHEDULING_LAYERS,
  SCHEDULING_TOOL_NAMES,
  VS_SCHEDULING_STACK_ROWS,
} from '@/lib/marketing/vsSchedulingToolsContent'

export default function VsSchedulingCompareSection() {
  const visibleTools = SCHEDULING_TOOL_NAMES.slice(0, 4)
  const overflowCount = SCHEDULING_TOOL_NAMES.length - visibleTools.length

  return (
    <section id="compare" className="stack-compare-section">
      <div className="wrap">
        <div className="sec-head stack-compare-head reveal">
          <span className="eyebrow">The difference</span>
          <h2 className="t-h2">Publish button vs marketing&nbsp;OS.</h2>
          <p className="t-lead">
            Scheduling tools excel at timing. Agent7even plans campaigns, drafts in your voice, and routes everything to one approval queue — then you schedule when you are ready.
            <br />
            <Link href="/how-it-works">See the full workflow →</Link>
          </p>
        </div>

        <div className="stack-panel reveal">
          <div className="stack-flow">
            <div className="stack-flow-side">
              <span className="stack-flow-label">Scheduling tools</span>
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
              <p className="stack-flow-os">Draft first. You approve every output. Schedule when you sign off.</p>
            </div>
          </div>

          <div className="stack-body">
            <div className="stack-rails">
              {VS_SCHEDULING_STACK_ROWS.map((row) => (
                <article key={row.dimension} className="stack-rail">
                  <span className="stack-rail-dim">{row.dimension}</span>
                  <div className="stack-rail-copy">
                    <p className="stack-rail-before">{row.scheduling}</p>
                    <p className="stack-rail-after">{row.agent7even}</p>
                  </div>
                </article>
              ))}
            </div>

            <aside className="stack-spine-wrap" aria-label="Approval-first workflow">
              <p className="stack-spine-title">How Agent7even works</p>
              <ol className="stack-spine">
                {AGENT7EVEN_SCHEDULING_LAYERS.map((layer, index) => (
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
