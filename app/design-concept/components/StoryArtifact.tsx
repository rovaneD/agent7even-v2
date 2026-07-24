import type { WorkItemType } from '../storyData'

type Props = {
  type: WorkItemType
  title: string
  meta: string
  status?: string
  compact?: boolean
  queued?: boolean
  queueSource?: string
  queueStatus?: string
  queueEffort?: string
}

export default function StoryArtifact({
  type,
  title,
  meta,
  status,
  compact = false,
  queued = false,
  queueSource,
  queueStatus,
  queueEffort,
}: Props) {
  if (queued) {
    return (
      <article className={`dc-work dc-work--queued dc-work--${type}${compact ? ' dc-work--compact' : ''}`}>
        <span className="dc-work__type">{typeLabel(type)}</span>
        <p className="dc-work__title">{title}</p>
        {queueSource && <p className="dc-work__source">{queueSource}</p>}
        <div className="dc-work__queue-foot">
          {queueStatus && (
            <span className={`dc-work__status${queueStatus.toLowerCase().includes('approve') ? ' is-ready' : ''}`}>
              {queueStatus}
            </span>
          )}
          {queueEffort && <span className="dc-work__effort">{queueEffort}</span>}
        </div>
      </article>
    )
  }

  return (
    <article className={`dc-work dc-work--${type}${compact ? ' dc-work--compact' : ''}`}>
      <span className="dc-work__type">{typeLabel(type)}</span>
      {type === 'email' && (
        <div className="dc-work__email">
          <p className="dc-work__email-subj">{title}</p>
          <p className="dc-work__email-preview">
            Hey — this Friday is usually quiet. Come in for 20% off and bring a friend…
          </p>
        </div>
      )}
      {type === 'social' && (
        <div className="dc-work__social">
          <div className="dc-work__social-thumb" aria-hidden="true" />
          <p className="dc-work__social-caption">Friday just got better. 20% off for regulars.</p>
        </div>
      )}
      {type === 'visual' && (
        <div className="dc-work__visual-thumb" aria-hidden="true">
          <span className="dc-work__visual-gradient" />
        </div>
      )}
      {type === 'campaign' && (
        <div className="dc-work__campaign">
          <p className="dc-work__title">{title}</p>
          <ul className="dc-work__timeline">
            <li>Teaser · Thu</li>
            <li>Offer · Fri</li>
            <li>Reminder · Sat</li>
          </ul>
        </div>
      )}
      {type === 'seo' && (
        <div className="dc-work__seo">
          <p className="dc-work__seo-find">2 missing title tags</p>
          <p className="dc-work__seo-page">/menu · Add &ldquo;Ember Coffee Menu&rdquo;</p>
        </div>
      )}
      {type === 'competitor' && (
        <div className="dc-work__competitor">
          <p className="dc-work__title">{title}</p>
          <p className="dc-work__competitor-note">Rival launched 15% off · response drafted</p>
        </div>
      )}
      {!['email', 'social', 'visual', 'campaign', 'seo', 'competitor'].includes(type) && (
        <p className="dc-work__title">{title}</p>
      )}
      <p className="dc-work__meta">{meta}</p>
      {status && <p className="dc-work__status-line">{status}</p>}
    </article>
  )
}

function typeLabel(type: WorkItemType): string {
  const labels: Record<WorkItemType, string> = {
    campaign: 'Campaign plan',
    email: 'Email draft',
    social: 'Instagram post',
    visual: 'Generated visual',
    seo: 'SEO insight',
    competitor: 'Competitor brief',
  }
  return labels[type]
}
