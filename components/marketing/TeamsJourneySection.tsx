'use client'

import { trackEvent } from '@/lib/gtag'

const PEOPLE = {
  JD: { src: '/JD.png', alt: 'Team member JD', tone: 'amber' as const },
  MK: { src: '/MK.png', alt: 'Team member MK', tone: 'pink' as const },
  AS: { src: '/AS.png', alt: 'Team member AS', tone: 'blue' as const },
}

const STEPS = [
  {
    label: 'Invite the team',
    people: [PEOPLE.JD],
  },
  {
    label: 'Align on Foundation',
    people: [PEOPLE.JD, PEOPLE.MK],
  },
  {
    label: 'Draft with Maya',
    people: [PEOPLE.MK, PEOPLE.AS],
  },
  {
    label: 'Approve together',
    people: [PEOPLE.AS],
  },
]

export default function TeamsJourneySection() {
  return (
    <section id="teams" className="teams-journey" aria-labelledby="teams-journey-heading">
      <div className="wrap">
        <div className="teams-journey-head reveal">
          <span className="teams-journey-badge">Small teams. One approval queue.</span>
          <h2 id="teams-journey-heading" className="teams-journey-title">
            Marketing that moves your{' '}
            <span className="teams-journey-title-keep">whole team.</span>
          </h2>
          <p className="teams-journey-lead">
            Invite collaborators. Share one Foundation. Review drafts in one queue —
            nothing publishes until someone signs off.
          </p>
        </div>

        <div className="teams-journey-stage reveal" aria-hidden="false">
          <svg
            className="teams-journey-path"
            viewBox="0 0 1100 220"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="teamsPathGrad" x1="0" y1="0" x2="1100" y2="0" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#FCA509" />
                <stop offset="38%" stopColor="#F5349B" />
                <stop offset="72%" stopColor="#EE533B" />
                <stop offset="100%" stopColor="#3286FE" />
              </linearGradient>
            </defs>
            <path
              d="M20 180 C 160 180, 220 140, 300 120 C 400 95, 460 95, 540 85 C 640 72, 700 70, 780 55 C 880 38, 960 40, 1080 30"
              stroke="url(#teamsPathGrad)"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
            {[
              [120, 168],
              [380, 108],
              [660, 68],
              [940, 36],
            ].map(([cx, cy], i) => (
              <circle key={i} cx={cx} cy={cy} r="5.5" fill="url(#teamsPathGrad)" stroke="#fff" strokeWidth="2.5" />
            ))}
          </svg>

          <ol className="teams-journey-steps">
            {STEPS.map((step) => (
              <li key={step.label} className="teams-journey-step">
                <span className="teams-journey-chip">{step.label}</span>
                <div className="teams-journey-avatars">
                  {step.people.map((person, idx) => (
                    <span
                      key={`${step.label}-${person.src}-${idx}`}
                      className={`teams-journey-avatar tone-${person.tone}`}
                      style={{ zIndex: step.people.length - idx }}
                    >
                      <img src={person.src} alt={person.alt} width={44} height={44} />
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="teams-journey-cta reveal">
          <a
            className="btn btn-blue"
            href="/pricing"
            onClick={() => trackEvent('cta_click', { cta: 'see_growth', location: 'teams_journey' })}
          >
            See Growth
          </a>
          <p className="teams-journey-note">Growth includes 3 seats · ProAgent includes 5 · +$15/mo per extra</p>
        </div>
      </div>
    </section>
  )
}
