/* ============================================================
   Use-case mockups — relatable, per-segment product scenes.
   Injected into [data-uc="<name>"]. Reuses the shared .mk-* chrome
   from site.css. Each scene shows Maya doing THAT segment's real work,
   so the page reads as concrete, not abstract.
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
      <div class="mk-rail-logo"><img src="/agent7even_mark.svg" alt="" /></div>
      ${icons.map(([i, on]) => `<div class="mk-ic ${on ? 'on' : ''}">${ic(i)}</div>`).join('')}
      <div class="mk-ic mt-auto">${ic('user')}</div>
    </div>`;

  const chat = (brand, role, msgs, compose) => `
    <div class="mk-chat">
      <div class="mk-chat-hd">${mayaOrbAvatar(24, true)}<div><div class="nm">Maya</div><div class="rl">${role}</div></div></div>
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
            <div class="mk-row" style="padding:9px 12px"><span class="tag tag-ghost">Fri</span><div class="grow"><div class="rt" style="font-weight:500">Drop post + product image</div><div class="rs">On-brand image + caption draft</div></div><span style="font-size:11px;color:var(--green);font-weight:500;display:inline-flex;gap:3px;align-items:center;white-space:nowrap">${check}Drafted</span></div>
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
       Fill the slow week, competitive reports, approval-first workflow. */
    local: () => `
      <div class="mk-bar"><div class="mk-traffic"><i></i><i></i><i></i></div><div class="mk-url">agent7even.ai/approvals</div></div>
      <div class="mk-body" style="height:430px">
        ${rail([['grid', false], ['inbox', true], ['star', false], ['eye', false]])}
        ${chat('Your business', 'Marketing for your business', `
          <div class="bub bub-u">Next week's looking slow. Fill it.</div>
          <div class="bub bub-m">On it. A midweek offer plus two posts to push it — booked-by-Friday angle, in your voice. Ready to approve.<span class="lnk">View the promo ${arrowUp}</span></div>
          <div class="bub bub-m">Also: this week's competitive report is ready — a rival posted a spring offer. Want a counter-draft?</div>
        `, 'Tell Maya the gap…')}
        <div class="mk-main">
          <div class="mk-main-hd"><div><div class="ttl">Ready for you</div><div class="sub">3 items waiting</div></div><span class="pill" style="font-size:11px;padding:5px 11px">3 waiting</span></div>
          <div class="mk-pad" style="gap:9px">
            <div class="mk-row" style="border-color:#BFEFDB;background:#F4FCF8;align-items:flex-start"><span class="dot" style="background:var(--green);margin-top:5px"></span><div class="grow"><div class="rt">Midweek promo — "Book by Friday"</div><div class="rs">Offer + 2 posts · fills Tue–Thu</div></div>
              <div style="display:flex;gap:6px"><span style="font-size:12px;padding:6px 13px;border-radius:8px;background:var(--green);color:#fff;font-weight:500">Approve</span><span class="tag tag-ghost" style="padding:6px 11px">Edit</span></div></div>
            <div class="mk-row" style="align-items:flex-start"><span class="dot" style="background:var(--blue);margin-top:5px"></span><div class="grow"><div class="rt">Competitive report — weekly</div><div class="rs">Rival spring offer flagged · counter-draft ready</div></div><span class="tag tag-blue" style="padding:6px 12px">Review</span></div>
            <div class="mk-row" style="align-items:flex-start"><span class="dot" style="background:var(--amber);margin-top:5px"></span><div class="grow"><div class="rt">SEO scan notes</div><div class="rs">3 quick wins flagged from your site</div></div><span class="tag tag-amber" style="padding:6px 12px">View</span></div>
            <div class="mk-note accent-red"><div class="nl">Maya · from your Foundation</div><div class="nt">Competitive reports use what you&rsquo;ve told us — not live feeds. Drafts wait in your queue until you approve.</div></div>
          </div>
        </div>
      </div>`,

    /* ---------------- CREATORS / SOLO ---------------- *
       "Lena Ray" coach — launch drafted while she delivers, in her voice. */
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
            <div class="mk-row" style="padding:9px 12px;border-color:#FBD9EC"><span class="tag tag-ghost">Post</span><div class="grow"><div class="rt" style="font-weight:500">Carousel — "Who it's for"</div><div class="rs">Caption + on-brand image draft</div></div><span style="font-size:11px;color:var(--green);font-weight:500;display:inline-flex;gap:3px;align-items:center;white-space:nowrap">${check}Drafted</span></div>
            <div class="mk-row" style="padding:9px 12px"><span class="tag tag-ghost">Video</span><div class="grow"><div class="rt" style="font-weight:500">Short reel — cohort teaser</div><div class="rs">10s draft · queued for approval</div></div><span style="font-size:12px;color:var(--blue);font-weight:500;display:inline-flex;gap:2px;align-items:center;white-space:nowrap">Review ${chev}</span></div>
            <div class="mk-row" style="padding:9px 12px"><span class="tag tag-ghost">Email</span><div class="grow"><div class="rt" style="font-weight:500">Last-call — closes Friday</div></div><span style="font-size:12px;color:var(--blue);font-weight:500;display:inline-flex;gap:2px;align-items:center;white-space:nowrap">Review ${chev}</span></div>
            <div class="mk-stats" style="margin-top:2px">
              <div class="mk-stat"><div class="n">5</div><div class="l">Emails ready</div></div>
              <div class="mk-stat"><div class="n">7</div><div class="l">Drafts queued</div></div>
              <div class="mk-stat"><div class="n" style="color:var(--brand)">0</div><div class="l">Hours from you</div></div>
            </div>
          </div>
        </div>
      </div>`,

    /* ---------------- STARTUPS ---------------- *
       Early-stage GTM — launch plan drafted before the first marketing hire. */
    startups: () => `
      <div class="mk-bar"><div class="mk-traffic"><i></i><i></i><i></i></div><div class="mk-url">agent7even.ai/campaigns</div></div>
      <div class="mk-body" style="height:430px">
        ${rail([['grid', false], ['mega', true], ['cal', false], ['spark', true]])}
        ${chat('Northline', 'Marketing for Northline', `
          <div class="bub bub-u">We ship v1 next week. No marketer on the team yet.</div>
          <div class="bub bub-m">Then I&rsquo;ll draft the launch — waitlist email, three posts, and ad variations to test. All from your Foundation, queued for approval.<span class="lnk">Open launch plan ${arrowUp}</span></div>
          <div class="bub bub-m">Want Idea Analysis on two positioning angles before you pick one?</div>
        `, 'Brief Maya on the launch…')}
        <div class="mk-main">
          <div class="mk-main-hd"><div><div class="ttl">v1 launch plan</div><div class="sub">Northline · ships Tue</div></div><span class="tag tag-blue">Draft · ready to review</span></div>
          <div class="mk-pad" style="gap:9px">
            <div class="mk-note accent-blue"><div class="nl">GTM from Foundation</div><div class="nt">One company profile — not multi-client agency workspaces. You approve before anything goes live.</div></div>
            <div class="mk-row" style="padding:9px 12px"><span class="tag tag-ghost">Email</span><div class="grow"><div class="rt" style="font-weight:500">Waitlist → launch</div></div><span style="font-size:11px;color:var(--green);font-weight:500;display:inline-flex;gap:3px;align-items:center;white-space:nowrap">${check}Drafted</span></div>
            <div class="mk-row" style="padding:9px 12px"><span class="tag tag-ghost">Post</span><div class="grow"><div class="rt" style="font-weight:500">Launch thread — problem → wedge</div></div><span style="font-size:11px;color:var(--green);font-weight:500;display:inline-flex;gap:3px;align-items:center;white-space:nowrap">${check}Drafted</span></div>
            <div class="mk-row" style="padding:9px 12px"><span class="tag tag-ghost">Ads</span><div class="grow"><div class="rt" style="font-weight:500">3 variations to test</div></div><span style="font-size:12px;color:var(--blue);font-weight:500;display:inline-flex;gap:2px;align-items:center;white-space:nowrap">Review ${chev}</span></div>
            <div class="mk-stats" style="margin-top:2px">
              <div class="mk-stat"><div class="n">6</div><div class="l">Launch assets</div></div>
              <div class="mk-stat"><div class="n">0</div><div class="l">Marketing hires</div></div>
              <div class="mk-stat"><div class="n">1</div><div class="l">Foundation</div></div>
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
