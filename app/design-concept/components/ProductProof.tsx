export default function ProductProof() {
  return (
    <section className="dc-proof" aria-labelledby="dc-proof-title">
      <div className="dc-wrap">
        <header className="dc-proof__head">
          <h2 id="dc-proof-title" className="dc-proof__title">
            Tomorrow&apos;s marketing is already waiting.
          </h2>
        </header>

        <div className="dc-proof__mosaic">
          <article className="dc-proof__panel dc-proof__panel--campaign">
            <p className="dc-proof__category">Campaigns</p>
            <h3 className="dc-proof__panel-title">Friday Slow-Day Promo</h3>
            <ul className="dc-proof__list">
              <li>3 Instagram posts drafted</li>
              <li>1 email ready</li>
              <li>2 ad variations prepared</li>
              <li>Timeline created</li>
            </ul>
            <div className="dc-proof__timeline" aria-hidden="true">
              <div className="dc-proof__timeline-node">
                <span>Thu</span>
                <em>Teaser</em>
              </div>
              <div className="dc-proof__timeline-line" />
              <div className="dc-proof__timeline-node dc-proof__timeline-node--active">
                <span>Fri</span>
                <em>Offer live</em>
              </div>
              <div className="dc-proof__timeline-line" />
              <div className="dc-proof__timeline-node">
                <span>Sat</span>
                <em>Reminder</em>
              </div>
            </div>
          </article>

          <article className="dc-proof__panel dc-proof__panel--creative">
            <p className="dc-proof__category">Creative</p>
            <h3 className="dc-proof__panel-title">On-brand visuals</h3>
            <div className="dc-proof__visuals" aria-hidden="true">
              <div className="dc-proof__visual-frame dc-proof__visual-frame--1" />
              <div className="dc-proof__visual-frame dc-proof__visual-frame--2" />
              <div className="dc-proof__visual-frame dc-proof__visual-frame--3" />
              <div className="dc-proof__visual-frame dc-proof__visual-frame--4" />
            </div>
            <p className="dc-proof__panel-note">
              Generated from saved colors, style, and scene direction.
            </p>
          </article>

          <article className="dc-proof__panel dc-proof__panel--seo">
            <p className="dc-proof__category">SEO</p>
            <h3 className="dc-proof__panel-title">Homepage gaps</h3>
            <p className="dc-proof__seo-find">2 missing title tags found.</p>
            <div className="dc-proof__seo-fix">
              <span className="dc-proof__seo-page">/menu</span>
              <span className="dc-proof__seo-arrow">→</span>
              <span className="dc-proof__seo-suggest">Add &ldquo;Ember Coffee Menu&rdquo;</span>
            </div>
          </article>

          <article className="dc-proof__panel dc-proof__panel--competitors">
            <p className="dc-proof__category">Competitors</p>
            <h3 className="dc-proof__panel-title">Rival Coffee Co.</h3>
            <p className="dc-proof__comp-line">Launched a 15% promotion yesterday.</p>
            <p className="dc-proof__comp-action">A response campaign is ready to review.</p>
            <div className="dc-proof__comp-meta">
              <time dateTime="2026-07-14">Yesterday · 4:12 PM</time>
              <span className="dc-proof__comp-cta">Review draft</span>
            </div>
          </article>
        </div>
      </div>
    </section>
  )
}
