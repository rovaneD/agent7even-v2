/* ============================================================
   Maya product mockups — reusable, injected into [data-mk="<name>"]
   Decorative app chrome shared across all directions.
   ============================================================ */
(function () {
  const rail = (icons) => `
    <div class="mk-rail">
      <div class="mk-rail-logo">7</div>
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

  const M = {
    /* hero dashboard: rail + maya chat + dashboard canvas */
    dashboard: () => `
      <div class="mk-bar"><div class="mk-traffic"><i></i><i></i><i></i></div>
        <div class="mk-url">agent7even.com/dashboard</div></div>
      <div class="mk-body" style="height:418px">
        ${rail([['grid', true], ['spark', false], ['mega', false], ['cal', false]])}
        <div class="mk-chat">
          <div class="mk-chat-hd"><div class="mk-ava">M</div><div><div class="nm">Maya</div><div class="rl">Your marketing partner</div></div></div>
          <div class="mk-msgs">
            <div class="bub bub-u">Fill next Friday — it's our slow day.</div>
            <div class="bub bub-m">On it. A Friday promo for Ember Coffee — offer, email and three posts. Drafting it in your canvas now.<span class="lnk">View campaign draft ${arrowUp}</span></div>
            <div class="bub bub-m">Want me to match the 20% you ran last spring, or go a little deeper?</div>
          </div>
          <div class="mk-compose"><div class="field"><span>Message Maya…</span><b>${arrowUp}</b></div></div>
        </div>
        <div class="mk-main">
          <div class="mk-main-hd"><div><div class="ttl">Good morning, Ember</div><div class="sub">Here's where things stand</div></div><div class="pill" style="font-size:11px;padding:5px 11px"><span class="live-dot"></span>Maya is working</div></div>
          <div class="mk-pad">
            <div class="mk-stats">
              <div class="mk-stat"><div class="n">3</div><div class="l">Awaiting approval</div></div>
              <div class="mk-stat"><div class="n" style="color:var(--green)">12</div><div class="l">Sent this week</div></div>
              <div class="mk-stat"><div class="n">2</div><div class="l">Campaigns live</div></div>
            </div>
            <div class="mk-row"><span class="dot" style="background:var(--green)"></span><div class="grow"><div class="rt">Summer Launch — Ember Coffee</div><div class="rs">Sequence 2 of 4 · performing above target</div></div><span class="tag tag-green">Live</span></div>
            <div class="mk-row"><span class="dot" style="background:var(--amber)"></span><div class="grow"><div class="rt">Friday Slow-Day Promo</div><div class="rs">Drafted by Maya · ready to review</div></div><span class="tag tag-amber">Draft</span></div>
            <div class="mk-row"><span class="dot" style="background:var(--blue)"></span><div class="grow"><div class="rt">Win-back email sequence</div><div class="rs">12 lapsed customers identified</div></div><span class="tag tag-blue">Queued</span></div>
          </div>
        </div>
      </div>`,

    /* campaign canvas: list + detail + copy options */
    campaign: () => `
      <div class="mk-bar"><div class="mk-traffic"><i></i><i></i><i></i></div><div class="mk-url">agent7even.com/campaigns</div></div>
      <div class="mk-body" style="height:392px">
        ${rail([['grid', false], ['mega', true], ['cal', false]])}
        <div style="width:156px;flex-shrink:0;border-right:1px solid var(--line-2);background:#fff">
          <div style="padding:11px 14px;font-family:var(--mono);font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--faint);border-bottom:1px solid var(--line-2)">Campaigns</div>
          <div style="padding:11px 14px;background:#F4F8FF;border-left:2px solid var(--blue)"><div style="font-size:12.5px;font-weight:600">Friday Slow-Day</div><div style="font-size:11px;color:var(--faint);margin-top:2px">Draft · Week 1</div></div>
          <div style="padding:11px 14px;border-bottom:1px solid var(--line-2)"><div style="font-size:12.5px;font-weight:500">Summer Launch</div><div style="font-size:11px;color:var(--faint);margin-top:2px">Live · Week 2</div></div>
          <div style="padding:11px 14px"><div style="font-size:12.5px;font-weight:500">Win-back email</div><div style="font-size:11px;color:var(--faint);margin-top:2px">Draft</div></div>
        </div>
        <div class="mk-main" style="border-right:1px solid var(--line-2)">
          <div class="mk-main-hd"><div><div class="ttl">Friday Slow-Day Promo</div><div class="sub">20% off · Ember Coffee</div></div><span class="tag tag-amber">Draft</span></div>
          <div class="mk-pad" style="gap:10px">
            <div class="mk-note accent-blue"><div class="nl">Strategy</div><div class="nt">Drive Friday traffic with 20% off all drinks — Instagram + an email to regulars. Run this week only.</div></div>
            <div class="mk-row" style="padding:9px 12px"><span class="tag tag-ghost">Email</span><div class="grow"><div class="rt" style="font-weight:500">Promo announcement</div></div><span style="font-size:12px;color:var(--blue);font-weight:500;display:inline-flex;gap:2px;align-items:center;white-space:nowrap">Do this ${chev}</span></div>
            <div class="mk-row" style="padding:9px 12px;border-color:#DCE9FF"><span class="tag tag-blue">IG</span><div class="grow"><div class="rt" style="font-weight:500">Post 1 — lead visual</div></div><span style="font-size:11px;color:var(--green);font-weight:500;display:inline-flex;gap:3px;align-items:center;white-space:nowrap">${check}Drafted</span></div>
            <div class="mk-row" style="padding:9px 12px"><span class="tag tag-blue">IG</span><div class="grow"><div class="rt" style="font-weight:500">Post 2 — offer close</div></div><span style="font-size:12px;color:var(--blue);font-weight:500;display:inline-flex;gap:2px;align-items:center;white-space:nowrap">Do this ${chev}</span></div>
          </div>
        </div>
        <div style="width:158px;flex-shrink:0;background:#FCFCFD">
          <div style="padding:11px 14px;font-family:var(--mono);font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--faint);border-bottom:1px solid var(--line-2)">Copy options</div>
          <div style="padding:12px 13px;display:flex;flex-direction:column;gap:9px">
            <div style="background:#fff;border:1.5px solid var(--blue);border-radius:10px;padding:10px 12px"><div style="font-family:var(--mono);font-size:10px;color:var(--blue);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">Option A</div><div style="font-size:12px;color:var(--ink-2);line-height:1.45">Fridays just got better. 20% off every drink — this Friday only.</div></div>
            <div style="background:#fff;border:1px solid var(--line);border-radius:10px;padding:10px 12px"><div style="font-family:var(--mono);font-size:10px;color:var(--faint);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">Option B</div><div style="font-size:12px;color:var(--ink-2);line-height:1.45">Your Friday deserves a proper sit-down. 20% off, all day.</div></div>
          </div>
        </div>
      </div>`,

    /* approval queue */
    approvals: () => `
      <div class="mk-bar"><div class="mk-traffic"><i></i><i></i><i></i></div><div class="mk-url">agent7even.com/approvals</div></div>
      <div class="mk-body" style="height:392px">
        ${rail([['inbox', true], ['mega', false], ['cal', false]])}
        <div class="mk-main">
          <div class="mk-main-hd"><div><div class="ttl">Approval queue</div><div class="sub">3 items ready · Ember Coffee</div></div><span class="pill" style="font-size:11px;padding:5px 11px">3 waiting</span></div>
          <div class="mk-pad">
            <div class="mk-row" style="border-color:#DCE9FF;background:#F8FBFF;align-items:flex-start"><span class="dot" style="background:var(--blue);margin-top:5px"></span><div class="grow"><div class="rt">Friday promo email</div><div class="rs">Ember Coffee · ready to send</div></div>
              <div style="display:flex;gap:6px"><span class="btn-blue" style="font-size:12px;padding:6px 13px;border-radius:8px;color:#fff;font-weight:500">Approve</span><span class="tag tag-ghost" style="padding:6px 11px">Edit</span></div></div>
            <div class="mk-row" style="align-items:flex-start"><span class="dot" style="background:var(--green);margin-top:5px"></span><div class="grow"><div class="rt">New 4★ review — Google</div><div class="rs">2 hours ago · Maya drafted a reply</div></div><span class="tag tag-green" style="padding:6px 12px">Reply</span></div>
            <div class="mk-row" style="align-items:flex-start"><span class="dot" style="background:var(--amber);margin-top:5px"></span><div class="grow"><div class="rt">Win-back — Sarah M.</div><div class="rs">No reply in 14 days · follow-up ready</div></div><span class="tag tag-amber" style="padding:6px 12px">Send</span></div>
            <div class="mk-note accent-pink" style="margin-top:2px"><div class="nl">Maya · waiting on you</div><div class="nt">Nothing goes live until you say so. Approve what's right, send the rest back with a note.</div></div>
          </div>
        </div>
      </div>`,

    /* content calendar */
    calendar: () => `
      <div class="mk-bar"><div class="mk-traffic"><i></i><i></i><i></i></div><div class="mk-url">agent7even.com/calendar</div></div>
      <div class="mk-body" style="height:392px">
        ${rail([['cal', true], ['mega', false], ['grid', false]])}
        <div class="mk-main">
          <div class="mk-main-hd"><div><div class="ttl">Content calendar</div><div class="sub">Ember Coffee · this week</div></div><span class="tag tag-green">6 scheduled</span></div>
          <div class="mk-pad" style="gap:10px">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
              <div style="background:#F4F8FF;border:1px solid #DCE9FF;border-radius:11px;padding:11px 13px"><div style="font-family:var(--mono);font-size:10px;font-weight:500;color:var(--blue);margin-bottom:4px">MON</div><div style="font-size:12.5px;color:var(--ink-2)">Instagram — new roast drop</div></div>
              <div style="background:#E9FBF3;border:1px solid #BFEFDB;border-radius:11px;padding:11px 13px"><div style="font-family:var(--mono);font-size:10px;font-weight:500;color:var(--green);margin-bottom:4px">WED</div><div style="font-size:12.5px;color:var(--ink-2)">Email — loyalty members</div></div>
              <div style="background:#FFF3E2;border:1px solid #FBDFB4;border-radius:11px;padding:11px 13px"><div style="font-family:var(--mono);font-size:10px;font-weight:500;color:#B26B00;margin-bottom:4px">FRI</div><div style="font-size:12.5px;color:var(--ink-2)">Story — slow-day promo</div></div>
              <div style="background:#F4F4F6;border:1px solid var(--line);border-radius:11px;padding:11px 13px;display:flex;align-items:center;justify-content:center;color:var(--faint);font-size:12.5px">+ 3 more queued</div>
            </div>
            <div class="mk-note accent-pink"><div class="nl">Maya suggestion</div><div class="nt">Tuesday looks quiet. Want a behind-the-scenes post of the morning bake? I can have it ready in your voice.</div></div>
          </div>
        </div>
      </div>`,

    /* competitor watch */
    competitor: () => `
      <div class="mk-bar"><div class="mk-traffic"><i></i><i></i><i></i></div><div class="mk-url">agent7even.com/watch</div></div>
      <div class="mk-body" style="height:392px">
        ${rail([['eye', true], ['mega', false], ['cal', false]])}
        <div class="mk-main">
          <div class="mk-main-hd"><div><div class="ttl">Competitor watch</div><div class="sub">Last scan 2 hours ago</div></div><span class="pill" style="font-size:11px;padding:5px 11px"><span class="live-dot"></span>Monitoring 4</span></div>
          <div class="mk-pad">
            <div class="mk-note accent-red"><div class="nl">Maya flagged</div><div style="font-size:13.5px;font-weight:600;color:var(--ink);margin:1px 0 3px">Rival Coffee Co. launched a 15% off promo</div><div class="nt">Running on Instagram since yesterday. Want a counter-offer drafted before the weekend?</div></div>
            <div class="mk-row"><span class="dot" style="background:var(--amber)"></span><div class="grow"><div class="rt">The Press Bar — new Instagram ad</div><div class="rs">Spotted 2 days ago</div></div><span class="tag tag-ghost">Watching</span></div>
            <div class="mk-row"><span class="dot" style="background:var(--blue)"></span><div class="grow"><div class="rt">Grounds Market — email campaign</div><div class="rs">Spotted 3 days ago</div></div><span class="tag tag-ghost">Watching</span></div>
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
