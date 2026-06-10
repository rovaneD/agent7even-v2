/* ============================================================
   Use-case mockups — relatable, per-segment product scenes.
   Injected into [data-uc="<name>"]. Reuses the shared .mk-* chrome
   from site.css. Each scene shows Maya doing THAT segment's real work,
   so the page reads as concrete, not abstract.
   ============================================================ */
(function () {
  function ic(name) {
    const p = {
      grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
      mega: '<path d="M3 11v2a1 1 0 0 0 1 1h2l4 4V6L6 10H4a1 1 0 0 0-1 1Z"/><path d="M14 8a4 4 0 0 1 0 8"/>',
      cal: '<rect x="3.5" y="4.5" width="17" height="16" rx="2"/><path d="M3.5 9h17M8 3v3M16 3v3"/>',
      eye: '<path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z"/><circle cx="12" cy="12" r="2.6"/>',
      inbox: '<path d="M4 13h4l1.5 2.5h5L16 13h4M4 13 6 5h12l2 8v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1Z"/>',
      cart: '<circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2.5 3h2l2.2 12.2a1.5 1.5 0 0 0 1.5 1.3h8.3a1.5 1.5 0 0 0 1.5-1.2L21 7H5.5"/>',
      star: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 17l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9Z"/>',
      spark: '<path d="M12 3v6M12 15v6M3 12h6M15 12h6"/><circle cx="12" cy="12" r="2.4"/>',
      layers: '<path d="M12 3 3 8l9 5 9-5-9-5Z"/><path d="M3 13l9 5 9-5"/>',
      user: '<circle cx="12" cy="8.5" r="3.3"/><path d="M5.5 19a6.5 6.5 0 0 1 13 0"/>',
    }[name] || '';
    return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
  }
  const arrowUp = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M9 7h8v8"/></svg>';
  const chev = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>';
  const check = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l4.5 4.5L19 7"/></svg>';

  const rail = (icons) => `
    <div class="mk-rail">
      <div class="mk-rail-logo">7</div>
      ${icons.map(([i, on]) => `<div class="mk-ic ${on ? 'on' : ''}">${ic(i)}</div>`).join('')}
      <div class="mk-ic mt-auto">${ic('user')}</div>
    </div>`;

  const chat = (brand, role, msgs, compose) => `
    <div class="mk-chat">
      <div class="mk-chat-hd"><div class="mk-ava">M</div><div><div class="nm">Maya</div><div class="rl">${role}</div></div></div>
      <div class="mk-msgs">${msgs}</div>
      <div class="mk-compose"><div class="field"><span>${compose}</span><b>${arrowUp}</b></div></div>
    </div>`;

  const U = {
    /* ---------------- E-COMMERCE ---------------- *
       "Maker & Co." — a drop becomes a full launch sequence in an afternoon. */
    ecommerce: () => `
      <div class="mk-bar"><div class="mk-traffic"><i></i><i></i><i></i></div><div class="mk-url">agent7even.ai/campaigns</div></div>
      <div class="mk-body" style="height:430px">
        ${rail([['grid', false], ['mega', true], ['cart', false], ['cal', false]])}
        ${chat('Maker &amp; Co.', 'Marketing for Maker &amp; Co.', `
          <div class="bub bub-u">The Autumn Ember candle drops Friday.</div>
          <div class="bub bub-m">Love it. Here's the full launch — a teaser, the drop email, three posts and an abandoned-cart catch. All in your voice, queued for approval.<span class="lnk">Open launch sequence ${arrowUp}</span></div>
          <div class="bub bub-m">Heads up: a competing brand is running 15% off this week. Want me to hold our price and lean on the story instead?</div>
        `, 'Message Maya…')}
        <div class="mk-main">
          <div class="mk-main-hd"><div><div class="ttl">Autumn Ember — launch</div><div class="sub">Maker &amp; Co. · drops Fri</div></div><span class="tag tag-amber">Draft · ready to review</span></div>
          <div class="mk-pad" style="gap:9px">
            <div class="mk-note accent-red"><div class="nl">Strategy</div><div class="nt">Build anticipation Wed–Thu, sell Fri–Sun. Tease the scent story, then convert with the list and recover carts Sunday night.</div></div>
            <div class="mk-row" style="padding:9px 12px"><span class="tag tag-ghost">Wed</span><div class="grow"><div class="rt" style="font-weight:500">Teaser post — "something's coming"</div></div><span style="font-size:11px;color:var(--green);font-weight:500;display:inline-flex;gap:3px;align-items:center;white-space:nowrap">${check}Drafted</span></div>
            <div class="mk-row" style="padding:9px 12px;border-color:#FBD9D2"><span class="tag tag-ghost">Fri</span><div class="grow"><div class="rt" style="font-weight:500">Drop email — "It's here"</div></div><span style="font-size:11px;color:var(--green);font-weight:500;display:inline-flex;gap:3px;align-items:center;white-space:nowrap">${check}Drafted</span></div>
            <div class="mk-row" style="padding:9px 12px"><span class="tag tag-ghost">Sun</span><div class="grow"><div class="rt" style="font-weight:500">Abandoned-cart catch</div></div><span style="font-size:12px;color:var(--blue);font-weight:500;display:inline-flex;gap:2px;align-items:center;white-space:nowrap">Review ${chev}</span></div>
            <div class="mk-stats" style="margin-top:2px">
              <div class="mk-stat"><div class="n">5</div><div class="l">Assets drafted</div></div>
              <div class="mk-stat"><div class="n" style="color:var(--green)">1</div><div class="l">Cart recovery</div></div>
              <div class="mk-stat"><div class="n">~6h</div><div class="l">Saved this week</div></div>
            </div>
          </div>
        </div>
      </div>`,

    /* ---------------- LOCAL SERVICE ---------------- *
       "Cedar Lane" — fill the slow week, answer every review, watch the street. */
    local: () => `
      <div class="mk-bar"><div class="mk-traffic"><i></i><i></i><i></i></div><div class="mk-url">agent7even.ai/approvals</div></div>
      <div class="mk-body" style="height:430px">
        ${rail([['grid', false], ['inbox', true], ['star', false], ['eye', false]])}
        ${chat('Cedar Lane', 'Marketing for Cedar Lane', `
          <div class="bub bub-u">Next week's looking slow. Fill it.</div>
          <div class="bub bub-m">On it. A midweek offer plus two posts to push it — booked-by-Friday angle, in your voice. Ready to approve.<span class="lnk">View the promo ${arrowUp}</span></div>
          <div class="bub bub-m">Also: a new 5★ review came in this morning. I drafted a reply — want to send it?</div>
        `, 'Tell Maya the gap…')}
        <div class="mk-main">
          <div class="mk-main-hd"><div><div class="ttl">Ready for you</div><div class="sub">Cedar Lane · 3 items waiting</div></div><span class="pill" style="font-size:11px;padding:5px 11px">3 waiting</span></div>
          <div class="mk-pad" style="gap:9px">
            <div class="mk-row" style="border-color:#BFEFDB;background:#F4FCF8;align-items:flex-start"><span class="dot" style="background:var(--green);margin-top:5px"></span><div class="grow"><div class="rt">Midweek promo — "Book by Friday"</div><div class="rs">Offer + 2 posts · fills Tue–Thu</div></div>
              <div style="display:flex;gap:6px"><span style="font-size:12px;padding:6px 13px;border-radius:8px;background:var(--green);color:#fff;font-weight:500">Approve</span><span class="tag tag-ghost" style="padding:6px 11px">Edit</span></div></div>
            <div class="mk-row" style="align-items:flex-start"><span class="dot" style="background:var(--amber);margin-top:5px"></span><div class="grow"><div class="rt">New 5★ review — Google</div><div class="rs">"Best in town." · reply drafted</div></div><span class="tag tag-green" style="padding:6px 12px">Reply</span></div>
            <div class="mk-row" style="align-items:flex-start"><span class="dot" style="background:var(--orange);margin-top:5px"></span><div class="grow"><div class="rt">Lead gone quiet — Dana R.</div><div class="rs">Quoted 11 days ago · follow-up ready</div></div><span class="tag tag-amber" style="padding:6px 12px">Send</span></div>
            <div class="mk-note accent-red"><div class="nl">Maya · watching the street</div><div class="nt">A competitor down the road just posted a spring offer. Want me to draft something that beats it?</div></div>
          </div>
        </div>
      </div>`,

    /* ---------------- CREATORS / SOLO ---------------- *
       "Lena Ray" coach — a launch runs itself, in your voice, while you deliver. */
    creators: () => `
      <div class="mk-bar"><div class="mk-traffic"><i></i><i></i><i></i></div><div class="mk-url">agent7even.ai/campaigns</div></div>
      <div class="mk-body" style="height:430px">
        ${rail([['grid', false], ['mega', true], ['cal', false], ['spark', false]])}
        ${chat('Lena Ray', 'Marketing for Lena Ray', `
          <div class="bub bub-u">Cohort opens Monday. I'm slammed with clients all week.</div>
          <div class="bub bub-m">Then I'll run the launch. Five emails, the waitlist note and a week of posts — all sounding like you, queued for approval.<span class="lnk">Open the launch ${arrowUp}</span></div>
          <div class="bub bub-m">A topic in your niche is trending today. Want a quick post while it's hot?</div>
        `, 'Message Maya…')}
        <div class="mk-main">
          <div class="mk-main-hd"><div><div class="ttl">Cohort 4 — launch</div><div class="sub">Lena Ray · opens Mon</div></div><span class="tag tag-pink">Draft · in your voice</span></div>
          <div class="mk-pad" style="gap:9px">
            <div class="mk-note accent-pink"><div class="nl">Voice match</div><div class="nt">Warm, direct, no hype — matched to your last three newsletters. <b style="color:var(--brand)">98% on-voice.</b></div></div>
            <div class="mk-row" style="padding:9px 12px"><span class="tag tag-ghost">Email</span><div class="grow"><div class="rt" style="font-weight:500">Waitlist — "Doors open Monday"</div></div><span style="font-size:11px;color:var(--green);font-weight:500;display:inline-flex;gap:3px;align-items:center;white-space:nowrap">${check}Drafted</span></div>
            <div class="mk-row" style="padding:9px 12px;border-color:#FBD9EC"><span class="tag tag-ghost">Post</span><div class="grow"><div class="rt" style="font-weight:500">Carousel — "Who it's for"</div></div><span style="font-size:11px;color:var(--green);font-weight:500;display:inline-flex;gap:3px;align-items:center;white-space:nowrap">${check}Drafted</span></div>
            <div class="mk-row" style="padding:9px 12px"><span class="tag tag-ghost">Email</span><div class="grow"><div class="rt" style="font-weight:500">Last-call — closes Friday</div></div><span style="font-size:12px;color:var(--blue);font-weight:500;display:inline-flex;gap:2px;align-items:center;white-space:nowrap">Review ${chev}</span></div>
            <div class="mk-stats" style="margin-top:2px">
              <div class="mk-stat"><div class="n">5</div><div class="l">Emails ready</div></div>
              <div class="mk-stat"><div class="n">7</div><div class="l">Posts queued</div></div>
              <div class="mk-stat"><div class="n" style="color:var(--brand)">0</div><div class="l">Hours from you</div></div>
            </div>
          </div>
        </div>
      </div>`,

    /* ---------------- AGENCIES ---------------- *
       The production layer, per client, in each client's voice, routed to the team. */
    agencies: () => `
      <div class="mk-bar"><div class="mk-traffic"><i></i><i></i><i></i></div><div class="mk-url">agent7even.ai/studio</div></div>
      <div class="mk-body" style="height:430px">
        ${rail([['layers', true], ['mega', false], ['grid', false], ['eye', false]])}
        <div class="mk-side" style="width:172px;flex-shrink:0;border-right:1px solid var(--line-2);background:#fff">
          <div style="padding:11px 14px;font-family:var(--mono);font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--faint);border-bottom:1px solid var(--line-2)">Client workspaces</div>
          <div style="padding:11px 14px;background:#F4F8FF;border-left:2px solid var(--blue)"><div style="display:flex;align-items:center;gap:8px"><span style="width:18px;height:18px;border-radius:6px;background:var(--orange);flex-shrink:0"></span><div><div style="font-size:12.5px;font-weight:600">Vela Skincare</div><div style="font-size:10.5px;color:var(--faint)">3 drafts to review</div></div></div></div>
          <div style="padding:11px 14px;border-bottom:1px solid var(--line-2)"><div style="display:flex;align-items:center;gap:8px"><span style="width:18px;height:18px;border-radius:6px;background:var(--green);flex-shrink:0"></span><div><div style="font-size:12.5px;font-weight:500">Northwind Gear</div><div style="font-size:10.5px;color:var(--faint)">Live · week 3</div></div></div></div>
          <div style="padding:11px 14px"><div style="display:flex;align-items:center;gap:8px"><span style="width:18px;height:18px;border-radius:6px;background:var(--brand);flex-shrink:0"></span><div><div style="font-size:12.5px;font-weight:500">Juno Studio</div><div style="font-size:10.5px;color:var(--faint)">2 drafts to review</div></div></div></div>
        </div>
        <div class="mk-main">
          <div class="mk-main-hd"><div><div class="ttl">Vela Skincare</div><div class="sub">Drafted by Maya · awaiting your team</div></div><span class="tag tag-blue">In each client's voice</span></div>
          <div class="mk-pad" style="gap:9px">
            <div class="mk-note accent-blue"><div class="nl">Routed to review</div><div class="nt">Maya built this week's run for Vela in their voice. Nothing reaches the client until your team signs off.</div></div>
            <div class="mk-row" style="padding:9px 12px"><span class="tag tag-ghost">Email</span><div class="grow"><div class="rt" style="font-weight:500">Restock announcement</div><div class="rs">Vela voice · senior review</div></div><span style="font-size:12px;color:var(--blue);font-weight:500;display:inline-flex;gap:2px;align-items:center;white-space:nowrap">Review ${chev}</span></div>
            <div class="mk-row" style="padding:9px 12px"><span class="tag tag-ghost">Social</span><div class="grow"><div class="rt" style="font-weight:500">3 posts — ingredient story</div><div class="rs">Vela voice · ready</div></div><span style="font-size:11px;color:var(--green);font-weight:500;display:inline-flex;gap:3px;align-items:center;white-space:nowrap">${check}Drafted</span></div>
            <div class="mk-row" style="padding:9px 12px"><span class="tag tag-ghost">Report</span><div class="grow"><div class="rt" style="font-weight:500">Monthly performance recap</div><div class="rs">Auto-compiled · client-ready</div></div><span style="font-size:11px;color:var(--green);font-weight:500;display:inline-flex;gap:3px;align-items:center;white-space:nowrap">${check}Drafted</span></div>
            <div class="mk-stats" style="margin-top:2px">
              <div class="mk-stat"><div class="n">3</div><div class="l">Accounts running</div></div>
              <div class="mk-stat"><div class="n" style="color:var(--green)">31</div><div class="l">Assets this week</div></div>
              <div class="mk-stat"><div class="n">100%</div><div class="l">Team-approved</div></div>
            </div>
          </div>
        </div>
      </div>`,
  };

  function boot() {
    document.querySelectorAll('[data-uc]').forEach((el) => {
      const name = el.getAttribute('data-uc');
      if (U[name]) { el.classList.add('mk'); el.innerHTML = U[name](); }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  window.__initUseCaseMockups = boot;
})();
