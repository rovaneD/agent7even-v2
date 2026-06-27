/* ============================================================
   Maya product mockups — reusable, injected into [data-mk="<name>"]
   Decorative app chrome shared across all directions.
   ============================================================ */
(function () {
  /* Maya orb avatar — mirrors components/maya/MayaOrb.tsx */
  const ORB_BAR_COUNT = 24
  const ORB_CENTER = 16
  const ORB_INNER_R = 10.5
  const ORB_OUTER_R = 15.5
  const ORB_INNER_RING_R = 9.25

  function orbBarColor(i) {
    return i % 5 === 0 ? '#F5349B' : '#3B82F6'
  }

  function mayaOrbSvg(size, active) {
    const activeClass = active ? ' maya-orb--active' : ''
    const bars = []
    for (let i = 0; i < ORB_BAR_COUNT; i++) {
      const angle = (i / ORB_BAR_COUNT) * 360
      const rad = (angle * Math.PI) / 180
      const x1 = ORB_CENTER + ORB_INNER_R * Math.sin(rad)
      const y1 = ORB_CENTER - ORB_INNER_R * Math.cos(rad)
      const x2 = ORB_CENTER + ORB_OUTER_R * Math.sin(rad)
      const y2 = ORB_CENTER - ORB_OUTER_R * Math.cos(rad)
      const delay = ((i / ORB_BAR_COUNT) * 1.2).toFixed(2)
      bars.push(
        `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="${orbBarColor(i)}" stroke-width="2.25" stroke-linecap="round" class="maya-orb-bar" style="animation-delay:${delay}s"/>`
      )
    }
    return `<svg class="maya-orb${activeClass}" width="${size}" height="${size}" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><circle cx="${ORB_CENTER}" cy="${ORB_CENTER}" r="${ORB_INNER_RING_R}" stroke="#6366F1" stroke-width="1.35" class="maya-orb-inner-ring" opacity="0.85"/>${bars.join('')}</svg>`
  }

  function mayaOrbAvatar(size, active) {
    return `<div class="mk-ava">${mayaOrbSvg(size || 24, active !== false)}</div>`
  }

  const rail = (icons) => `
    <div class="mk-rail">
      <div class="mk-rail-logo"><img src="/agent7even_mark.svg" alt="" /></div>
      ${icons.map(([i, on]) => `<div class="mk-ic ${on ? 'on' : ''}">${ic(i)}</div>`).join('')}
      <div class="mk-ic mt-auto">${ic('user')}</div>
    </div>`;

  function ic(name) {
    const p = {
      grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
      spark: '<path d="M12 3v6M12 15v6M3 12h6M15 12h6" /><circle cx="12" cy="12" r="2.4"/>',
      mega: '<path d="M3 11v2a1 1 0 0 0 1 1h2l4 4V6L6 10H4a1 1 0 0 0-1 1Z"/><path d="M14 8a4 4 0 0 1 0 8"/>',
      cal: '<rect x="3.5" y="4.5" width="17" height="16" rx="2"/><path d="M3.5 9h17M8 3v3M16 3v3"/>',
      eye: '<path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z"/><circle cx="12" cy="12" r="2.6"/>',
      inbox: '<path d="M4 13h4l1.5 2.5h5L16 13h4M4 13 6 5h12l2 8v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1Z"/>',
      user: '<circle cx="12" cy="8.5" r="3.3"/><path d="M5.5 19a6.5 6.5 0 0 1 13 0"/>',
    }[name] || '';
    return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
  }
  const chev = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>';
  const arrowUp = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M9 7h8v8"/></svg>';
  const check = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l4.5 4.5L19 7"/></svg>';

  const miniBar = (url) => `
    <div class="mk-bar" style="height:30px;padding:0 10px">
      <div class="mk-traffic" style="gap:5px"><i style="width:8px;height:8px"></i><i style="width:8px;height:8px"></i><i style="width:8px;height:8px"></i></div>
      <div class="mk-url" style="height:18px;font-size:9.5px;margin:0 6px">${url}</div>
    </div>`;

  const M = {
    /* hero dashboard: rail + maya chat + dashboard canvas */
    dashboard: () => `
      <div class="mk-bar"><div class="mk-traffic"><i></i><i></i><i></i></div>
        <div class="mk-url">agent7even.ai/dashboard</div></div>
      <div class="mk-body" style="height:418px">
        ${rail([['grid', true], ['spark', false], ['mega', false], ['cal', false]])}
        <div class="mk-chat">
          <div class="mk-chat-hd">${mayaOrbAvatar(24, true)}<div><div class="nm">Maya</div><div class="rl">Your marketing partner</div></div></div>
          <div class="mk-msgs">
            <div class="bub bub-u">Fill next Friday — it's our slow day.</div>
            <div class="bub bub-m">On it. A Friday promo — offer, email draft and three posts. Drafting it in your canvas now.<span class="lnk">View campaign draft ${arrowUp}</span></div>
            <div class="bub bub-m">Want me to match the 20% you ran last spring, or go a little deeper?</div>
          </div>
          <div class="mk-compose"><div class="field"><span>Message Maya…</span><b>${arrowUp}</b></div></div>
        </div>
        <div class="mk-main">
          <div class="mk-main-hd"><div><div class="ttl">Good morning</div><div class="sub">Here's where things stand</div></div><div class="pill" style="font-size:11px;padding:5px 11px"><span class="live-dot"></span>Maya is working</div></div>
          <div class="mk-pad">
            <div class="mk-stats">
              <div class="mk-stat"><div class="n">3</div><div class="l">Awaiting approval</div></div>
              <div class="mk-stat"><div class="n" style="color:var(--green)">12</div><div class="l">Drafted this week</div></div>
              <div class="mk-stat"><div class="n">2</div><div class="l">Campaigns in progress</div></div>
            </div>
            <div class="mk-row"><span class="dot" style="background:var(--green)"></span><div class="grow"><div class="rt">Summer Launch</div><div class="rs">Sequence 2 of 4 · strong engagement</div></div><span class="tag tag-green">Approved</span></div>
            <div class="mk-row"><span class="dot" style="background:var(--amber)"></span><div class="grow"><div class="rt">Friday Slow-Day Promo</div><div class="rs">Drafted by Maya · ready to review</div></div><span class="tag tag-amber">Draft</span></div>
            <div class="mk-row"><span class="dot" style="background:var(--blue)"></span><div class="grow"><div class="rt">Win-back email sequence</div><div class="rs">12 lapsed customers identified</div></div><span class="tag tag-blue">Queued</span></div>
          </div>
        </div>
      </div>`,

    /* campaign canvas: list + detail + copy options */
    campaign: () => `
      <div class="mk-bar"><div class="mk-traffic"><i></i><i></i><i></i></div><div class="mk-url">agent7even.ai/campaigns</div></div>
      <div class="mk-body" style="height:392px">
        ${rail([['grid', false], ['mega', true], ['cal', false]])}
        <div class="mk-side" style="width:124px;flex-shrink:0;border-right:1px solid var(--line-2);background:#fff;min-width:0">
          <div style="padding:10px 12px;font-family:var(--mono);font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--faint);border-bottom:1px solid var(--line-2)">Campaigns</div>
          <div style="padding:10px 12px;background:#F4F8FF;border-left:2px solid var(--blue)"><div style="font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">Friday Slow-Day</div><div style="font-size:10.5px;color:var(--faint);margin-top:2px">Draft · Week 1</div></div>
          <div style="padding:10px 12px;border-bottom:1px solid var(--line-2)"><div style="font-size:12px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">Summer Launch</div><div style="font-size:10.5px;color:var(--faint);margin-top:2px">Live · Week 2</div></div>
          <div style="padding:10px 12px"><div style="font-size:12px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">Win-back email</div><div style="font-size:10.5px;color:var(--faint);margin-top:2px">Draft</div></div>
        </div>
        <div class="mk-main" style="border-right:1px solid var(--line-2);min-width:0">
          <div class="mk-main-hd" style="padding:12px 14px"><div><div class="ttl">Friday Slow-Day Promo</div><div class="sub">20% off · this week only</div></div><span class="tag tag-amber">Draft</span></div>
          <div class="mk-pad" style="gap:8px;padding:12px 14px">
            <div class="mk-note accent-blue" style="padding:10px 12px"><div class="nl">Strategy</div><div class="nt" style="font-size:12px;line-height:1.45">Drive Friday traffic with 20% off all drinks — Instagram + an email to regulars. Run this week only.</div></div>
            <div class="mk-row" style="padding:8px 10px"><span class="tag tag-ghost">Email</span><div class="grow"><div class="rt" style="font-weight:500">Promo announcement</div></div><span style="font-size:11px;color:var(--blue);font-weight:500;display:inline-flex;gap:2px;align-items:center;white-space:nowrap;flex-shrink:0">Do this ${chev}</span></div>
            <div class="mk-row" style="padding:8px 10px;border-color:#DCE9FF"><span class="tag tag-blue">IG</span><div class="grow"><div class="rt" style="font-weight:500">Post 1 — lead visual</div></div><span style="font-size:10.5px;color:var(--green);font-weight:500;display:inline-flex;gap:3px;align-items:center;white-space:nowrap;flex-shrink:0">${check}Drafted</span></div>
            <div class="mk-row" style="padding:8px 10px"><span class="tag tag-blue">IG</span><div class="grow"><div class="rt" style="font-weight:500">Post 2 — offer close</div></div><span style="font-size:11px;color:var(--blue);font-weight:500;display:inline-flex;gap:2px;align-items:center;white-space:nowrap;flex-shrink:0">Do this ${chev}</span></div>
          </div>
        </div>
        <div class="mk-side" style="width:132px;flex-shrink:0;background:#FCFCFD;min-width:0">
          <div style="padding:10px 12px;font-family:var(--mono);font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--faint);border-bottom:1px solid var(--line-2)">Copy options</div>
          <div style="padding:10px 11px;display:flex;flex-direction:column;gap:8px">
            <div style="background:#fff;border:1.5px solid var(--blue);border-radius:10px;padding:9px 10px"><div style="font-family:var(--mono);font-size:9.5px;color:var(--blue);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">Option A</div><div style="font-size:11px;color:var(--ink-2);line-height:1.45">Fridays just got better. 20% off every drink — this Friday only.</div></div>
            <div style="background:#fff;border:1px solid var(--line);border-radius:10px;padding:9px 10px"><div style="font-family:var(--mono);font-size:9.5px;color:var(--faint);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">Option B</div><div style="font-size:11px;color:var(--ink-2);line-height:1.45">Your Friday deserves a proper sit-down. 20% off, all day.</div></div>
          </div>
        </div>
      </div>`,

    /* approval queue */
    approvals: () => `
      <div class="mk-bar"><div class="mk-traffic"><i></i><i></i><i></i></div><div class="mk-url">agent7even.ai/approvals</div></div>
      <div class="mk-body" style="height:392px">
        ${rail([['inbox', true], ['mega', false], ['cal', false]])}
        <div class="mk-main">
          <div class="mk-main-hd"><div><div class="ttl">Approval queue</div><div class="sub">3 items ready</div></div><span class="pill" style="font-size:11px;padding:5px 11px">3 waiting</span></div>
          <div class="mk-pad">
            <div class="mk-row" style="border-color:#DCE9FF;background:#F8FBFF;align-items:flex-start"><span class="dot" style="background:var(--blue);margin-top:5px"></span><div class="grow"><div class="rt">Friday promo email</div><div class="rs">Draft ready · paste into your ESP after approval</div></div>
              <div style="display:flex;gap:6px"><span class="btn-blue" style="font-size:12px;padding:6px 13px;border-radius:8px;color:#fff;font-weight:500">Approve</span><span class="tag tag-ghost" style="padding:6px 11px">Edit</span></div></div>
            <div class="mk-row" style="align-items:flex-start"><span class="dot" style="background:var(--green);margin-top:5px"></span><div class="grow"><div class="rt">Instagram post — slow-day promo</div><div class="rs">Image + caption drafted in your voice</div></div><span class="tag tag-green" style="padding:6px 12px">Approve</span></div>
            <div class="mk-row" style="align-items:flex-start"><span class="dot" style="background:var(--amber);margin-top:5px"></span><div class="grow"><div class="rt">Weekly content plan</div><div class="rs">5 posts · one approval session</div></div><span class="tag tag-amber" style="padding:6px 12px">Review</span></div>
            <div class="mk-note accent-pink" style="margin-top:2px"><div class="nl">Maya · waiting on you</div><div class="nt">Nothing goes live until you say so. Approve what's right, then publish when you're ready.</div></div>
          </div>
        </div>
      </div>`,

    /* content calendar */
    calendar: () => `
      <div class="mk-bar"><div class="mk-traffic"><i></i><i></i><i></i></div><div class="mk-url">agent7even.ai/calendar</div></div>
      <div class="mk-body" style="height:392px">
        ${rail([['cal', true], ['mega', false], ['grid', false]])}
        <div class="mk-main">
          <div class="mk-main-hd"><div><div class="ttl">Content calendar</div><div class="sub">This week · queued for approval</div></div><span class="tag tag-green">6 queued</span></div>
          <div class="mk-pad" style="gap:10px">
            <div class="mk-cal-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
              <div style="background:#F4F8FF;border:1px solid #DCE9FF;border-radius:11px;padding:11px 13px"><div style="font-family:var(--mono);font-size:10px;font-weight:500;color:var(--blue);margin-bottom:4px">MON</div><div style="font-size:12px;color:var(--ink-2);line-height:1.4">IG — new roast drop</div></div>
              <div style="background:#E9FBF3;border:1px solid #BFEFDB;border-radius:11px;padding:11px 13px"><div style="font-family:var(--mono);font-size:10px;font-weight:500;color:var(--green);margin-bottom:4px">WED</div><div style="font-size:12px;color:var(--ink-2);line-height:1.4">Email — loyalty offer</div></div>
              <div style="background:#FFF3E2;border:1px solid #FBDFB4;border-radius:11px;padding:11px 13px"><div style="font-family:var(--mono);font-size:10px;font-weight:500;color:#B26B00;margin-bottom:4px">FRI</div><div style="font-size:12px;color:var(--ink-2);line-height:1.4">Story — slow-day promo</div></div>
              <div style="background:#F4F4F6;border:1px solid var(--line);border-radius:11px;padding:11px 13px;display:flex;align-items:center;justify-content:center;color:var(--faint);font-size:12px;text-align:center;line-height:1.35">+ 3 more queued</div>
            </div>
            <div class="mk-note accent-pink"><div class="nl">Maya suggestion</div><div class="nt">Tuesday looks quiet. Want a behind-the-scenes post of the morning bake? I can have it ready in your voice.</div></div>
          </div>
        </div>
      </div>`,

    /* competitor watch */
    competitor: () => `
      <div class="mk-bar"><div class="mk-traffic"><i></i><i></i><i></i></div><div class="mk-url">agent7even.ai/watch</div></div>
      <div class="mk-body" style="height:392px">
        ${rail([['eye', true], ['mega', false], ['cal', false]])}
        <div class="mk-main">
          <div class="mk-main-hd"><div><div class="ttl">Competitor watch</div><div class="sub">Weekly report · updated 2 hours ago</div></div><span class="pill" style="font-size:11px;padding:5px 11px">Report</span></div>
          <div class="mk-pad">
            <div class="mk-note accent-red"><div class="nl">Maya flagged</div><div style="font-size:13.5px;font-weight:600;color:var(--ink);margin:1px 0 3px">Rival Coffee Co. launched a 15% off promo</div><div class="nt">Running on Instagram since yesterday. Want a counter-offer drafted before the weekend?</div></div>
            <div class="mk-row"><span class="dot" style="background:var(--amber)"></span><div class="grow"><div class="rt">The Press Bar — new Instagram ad</div><div class="rs">Spotted 2 days ago</div></div><span class="tag tag-ghost">Watching</span></div>
            <div class="mk-row"><span class="dot" style="background:var(--blue)"></span><div class="grow"><div class="rt">Grounds Market — email campaign</div><div class="rs">Spotted 3 days ago</div></div><span class="tag tag-ghost">Watching</span></div>
          </div>
        </div>
      </div>`,

    /* card widgets — cropped mini UI for homepage cards */
    'widget-campaign': () => `
      ${miniBar('agent7even.ai/campaigns')}
      <div class="mk-body" style="height:auto;background:#fff">
        <div class="mk-main">
          <div class="mk-main-hd" style="padding:10px 12px"><div><div class="ttl" style="font-size:12px">Friday Slow-Day Promo</div><div class="sub" style="font-size:10px">20% off · this week only</div></div><span class="tag tag-amber" style="font-size:10px;padding:3px 8px">Draft</span></div>
          <div class="mk-pad" style="padding:10px 12px;gap:7px">
            <div class="mk-note accent-blue" style="padding:8px 10px"><div class="nl">Strategy</div><div class="nt" style="font-size:11px">Drive Friday traffic with 20% off — Instagram + email to regulars.</div></div>
            <div class="mk-row" style="padding:7px 9px"><span class="tag tag-blue">IG</span><div class="grow"><div class="rt" style="font-weight:500;font-size:12px">Post 1 — lead visual</div></div><span style="font-size:10px;color:var(--green);font-weight:500">${check}Drafted</span></div>
            <div class="mk-row" style="padding:7px 9px"><span class="tag tag-ghost">Email</span><div class="grow"><div class="rt" style="font-weight:500;font-size:12px">Promo announcement</div></div><span style="font-size:10px;color:var(--blue);font-weight:500">Do this ${chev}</span></div>
          </div>
        </div>
      </div>`,

    'widget-competitor': () => `
      ${miniBar('agent7even.ai/watch')}
      <div class="mk-body" style="height:auto;background:#fff">
        <div class="mk-main">
          <div class="mk-main-hd" style="padding:10px 12px"><div><div class="ttl" style="font-size:12px">Competitor watch</div><div class="sub" style="font-size:10px">Weekly report</div></div><span class="pill" style="font-size:10px;padding:3px 9px">Report</span></div>
          <div class="mk-pad" style="padding:10px 12px;gap:7px">
            <div class="mk-note accent-red" style="padding:8px 10px"><div class="nl">Maya flagged</div><div style="font-size:12px;font-weight:600;color:var(--ink);margin:1px 0 2px">Rival Coffee Co. — 15% off promo</div><div class="nt" style="font-size:11px">Running on Instagram since yesterday.</div></div>
            <div class="mk-row" style="padding:7px 9px"><span class="dot" style="background:var(--amber)"></span><div class="grow"><div class="rt" style="font-size:12px">The Press Bar — new ad</div></div><span class="tag tag-ghost" style="font-size:10px">Watching</span></div>
          </div>
        </div>
      </div>`,

    'widget-reputation': () => M['widget-approvals'](),

    'widget-approvals': () => `
      ${miniBar('agent7even.ai/approvals')}
      <div class="mk-body" style="height:auto;background:#fff">
        <div class="mk-main">
          <div class="mk-main-hd" style="padding:10px 12px"><div><div class="ttl" style="font-size:12px">Approval queue</div><div class="sub" style="font-size:10px">3 drafts waiting</div></div><span class="pill" style="font-size:10px;padding:3px 9px">3 waiting</span></div>
          <div class="mk-pad" style="padding:10px 12px;gap:7px">
            <div class="mk-row" style="padding:7px 9px;border-color:#DCE9FF;background:#F8FBFF;align-items:flex-start"><span class="dot" style="background:var(--blue);margin-top:4px"></span><div class="grow"><div class="rt" style="font-size:12px">Friday promo email</div><div class="rs" style="font-size:10px">Draft · approve to use</div></div><span style="font-size:10px;padding:5px 10px;border-radius:7px;background:var(--blue);color:#fff;font-weight:500">Approve</span></div>
            <div class="mk-row" style="padding:7px 9px;align-items:flex-start"><span class="dot" style="background:var(--green);margin-top:4px"></span><div class="grow"><div class="rt" style="font-size:12px">IG post + caption</div><div class="rs" style="font-size:10px">Image generated · on-brand</div></div><span class="tag tag-green" style="font-size:10px;padding:4px 9px">Approve</span></div>
          </div>
        </div>
      </div>`,

    'widget-voice': () => `
      ${miniBar('agent7even.ai/campaigns')}
      <div class="mk-body" style="height:auto;background:#fff">
        <div class="mk-main">
          <div class="mk-main-hd" style="padding:10px 12px"><div><div class="ttl" style="font-size:12px">Copy options</div><div class="sub" style="font-size:10px">Friday promo · your voice</div></div><span class="tag tag-blue" style="font-size:10px;padding:3px 8px">On-brand</span></div>
          <div class="mk-pad" style="padding:10px 12px;gap:7px">
            <div style="background:#fff;border:1.5px solid var(--blue);border-radius:10px;padding:9px 11px"><div style="font-family:var(--mono);font-size:9px;color:var(--blue);text-transform:uppercase;letter-spacing:.06em;margin-bottom:3px">Option A</div><div style="font-size:11px;color:var(--ink-2);line-height:1.45">Fridays just got better. 20% off every drink — this Friday only.</div></div>
            <div style="background:#fff;border:1px solid var(--line);border-radius:10px;padding:9px 11px"><div style="font-family:var(--mono);font-size:9px;color:var(--faint);text-transform:uppercase;letter-spacing:.06em;margin-bottom:3px">Option B</div><div style="font-size:11px;color:var(--ink-2);line-height:1.45">Your Friday deserves a proper sit-down. 20% off, all day.</div></div>
          </div>
        </div>
      </div>`,

    'widget-use-ecommerce': () => `
      ${miniBar('agent7even.ai/campaigns')}
      <div class="mk-body" style="height:auto;background:#fff">
        <div class="mk-main">
          <div class="mk-main-hd" style="padding:10px 12px"><div><div class="ttl" style="font-size:12px">Autumn launch</div><div class="sub" style="font-size:10px">Product drop · Fri</div></div><span class="tag tag-amber" style="font-size:10px;padding:3px 8px">Draft</span></div>
          <div class="mk-pad" style="padding:10px 12px;gap:7px">
            <div class="mk-row" style="padding:7px 9px"><span class="tag tag-ghost">Fri</span><div class="grow"><div class="rt" style="font-weight:500;font-size:12px">Drop email — "It's here"</div></div><span style="font-size:10px;color:var(--green);font-weight:500">${check}Drafted</span></div>
            <div class="mk-row" style="padding:7px 9px"><span class="tag tag-ghost">Sun</span><div class="grow"><div class="rt" style="font-weight:500;font-size:12px">Abandoned-cart catch</div></div><span style="font-size:10px;color:var(--blue);font-weight:500">Review ${chev}</span></div>
            <div class="mk-stats" style="margin-top:0"><div class="mk-stat"><div class="n" style="font-size:18px">5</div><div class="l">Assets drafted</div></div><div class="mk-stat"><div class="n" style="font-size:18px;color:var(--green)">1</div><div class="l">Cart recovery</div></div></div>
          </div>
        </div>
      </div>`,

    'widget-use-local': () => `
      ${miniBar('agent7even.ai/approvals')}
      <div class="mk-body" style="height:auto;background:#fff">
        <div class="mk-main">
          <div class="mk-main-hd" style="padding:10px 12px"><div><div class="ttl" style="font-size:12px">Ready for you</div><div class="sub" style="font-size:10px">3 items waiting</div></div><span class="pill" style="font-size:10px;padding:3px 9px">3 waiting</span></div>
          <div class="mk-pad" style="padding:10px 12px;gap:7px">
            <div class="mk-row" style="padding:7px 9px;border-color:#BFEFDB;background:#F4FCF8"><span class="dot" style="background:var(--green)"></span><div class="grow"><div class="rt" style="font-size:12px">Midweek promo — "Book by Friday"</div></div><span style="font-size:10px;padding:4px 9px;border-radius:7px;background:var(--green);color:#fff;font-weight:500">Approve</span></div>
            <div class="mk-row" style="padding:7px 9px"><span class="dot" style="background:var(--blue)"></span><div class="grow"><div class="rt" style="font-size:12px">SEO scan notes</div><div class="rs" style="font-size:10px">3 quick wins flagged</div></div><span class="tag tag-blue" style="font-size:10px;padding:4px 9px">View</span></div>
          </div>
        </div>
      </div>`,

    'widget-use-creators': () => `
      ${miniBar('agent7even.ai/campaigns')}
      <div class="mk-body" style="height:auto;background:#fff">
        <div class="mk-main">
          <div class="mk-main-hd" style="padding:10px 12px"><div><div class="ttl" style="font-size:12px">Cohort 4 — launch</div><div class="sub" style="font-size:10px">Lena Ray · opens Mon</div></div><span class="tag tag-pink" style="font-size:10px;padding:3px 8px">In your voice</span></div>
          <div class="mk-pad" style="padding:10px 12px;gap:7px">
            <div class="mk-note accent-pink" style="padding:8px 10px"><div class="nl">Voice match</div><div class="nt" style="font-size:11px">Warm, direct, no hype — <b style="color:var(--brand)">98% on-voice.</b></div></div>
            <div class="mk-row" style="padding:7px 9px"><span class="tag tag-ghost">Email</span><div class="grow"><div class="rt" style="font-weight:500;font-size:12px">Waitlist — "Doors open Monday"</div></div><span style="font-size:10px;color:var(--green);font-weight:500">${check}Drafted</span></div>
          </div>
        </div>
      </div>`,

    'widget-use-startups': () => `
      ${miniBar('agent7even.ai/campaigns')}
      <div class="mk-body" style="height:auto;background:#fff">
        <div class="mk-main">
          <div class="mk-main-hd" style="padding:10px 12px"><div><div class="ttl" style="font-size:12px">Product launch — v1</div><div class="sub" style="font-size:10px">Northline · ships next week</div></div><span class="tag tag-blue" style="font-size:10px;padding:3px 8px">Launch plan</span></div>
          <div class="mk-pad" style="padding:10px 12px;gap:7px">
            <div class="mk-row" style="padding:7px 9px"><span class="tag tag-ghost">Email</span><div class="grow"><div class="rt" style="font-weight:500;font-size:12px">Waitlist → launch sequence</div></div><span style="font-size:10px;color:var(--green);font-weight:500">${check}Drafted</span></div>
            <div class="mk-row" style="padding:7px 9px"><span class="tag tag-ghost">Ads</span><div class="grow"><div class="rt" style="font-weight:500;font-size:12px">3 ad variations to test</div></div><span style="font-size:10px;color:var(--blue);font-weight:500">Review ${chev}</span></div>
          </div>
        </div>
      </div>`,
  };

  function boot() {
    document.querySelectorAll('[data-mk]').forEach((el) => {
      const name = el.getAttribute('data-mk');
      if (M[name]) { el.classList.add('mk'); el.innerHTML = M[name](); }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  window.__initMockups = boot;
})();
