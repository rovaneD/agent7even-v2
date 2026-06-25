/* ============================================================
   AGENT7EVEN · Maya — AGENTS PAGE bespoke mockups
   Each agent gets its OWN screen. Reuses the shared .mk chrome
   (mk, mk-bar, mk-rail, mk-main…) from site.css, with bespoke
   interiors built per-agent. Injected into [data-am="<name>"].
   ============================================================ */
(function () {
  function ic(name) {
    const p = {
      grid:  '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
      chart: '<path d="M3 21h18M6 21v-6M11 21V8M16 21v-4M21 21V5"/>',
      mega:  '<path d="M3 11v2a1 1 0 0 0 1 1h2l4 4V6L6 10H4a1 1 0 0 0-1 1Z"/><path d="M14 8a4 4 0 0 1 0 8"/>',
      cal:   '<rect x="3.5" y="4.5" width="17" height="16" rx="2"/><path d="M3.5 9h17M8 3v3M16 3v3"/>',
      eye:   '<path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z"/><circle cx="12" cy="12" r="2.6"/>',
      shield:'<path d="M12 3l7 3v5c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9V6l7-3Z"/><path d="M9 12l2 2 4-4"/>',
      mail:  '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 7 8.5 6 8.5-6"/>',
      search:'<circle cx="11" cy="11" r="6.5"/><path d="m21 21-4.3-4.3"/>',
      user:  '<circle cx="12" cy="8.5" r="3.3"/><path d="M5.5 19a6.5 6.5 0 0 1 13 0"/>',
    }[name] || '';
    return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
  }
  const rail = (icons) => `
    <div class="mk-rail">
      <div class="mk-rail-logo"><img src="/agent7even_mark.svg" alt="" /></div>
      ${icons.map(([i, on]) => `<div class="mk-ic ${on ? 'on' : ''}">${ic(i)}</div>`).join('')}
      <div class="mk-ic mt-auto">${ic('user')}</div>
    </div>`;

  const chev  = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>';
  const check = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l4.5 4.5L19 7"/></svg>';
  const up    = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M7 14l5-5 5 5"/></svg>';
  const down  = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M7 10l5 5 5-5"/></svg>';
  const arrowR= '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

  // delta pill for stat cards
  const delta = (txt, dir) => `<span style="font-size:11px;font-weight:600;color:${dir==='down'?'var(--orange)':'var(--green)'};display:inline-flex;align-items:center;gap:1px;vertical-align:middle">${dir==='down'?down:up}${txt}</span>`;
  // channel bar
  const bar = (label, pct, color, val) => `
    <div style="display:flex;align-items:center;gap:10px">
      <div style="width:64px;font-size:11.5px;color:var(--ink-2);flex-shrink:0">${label}</div>
      <div style="flex:1;height:8px;border-radius:6px;background:#F1F1F3;overflow:hidden"><div style="width:${pct}%;height:100%;border-radius:6px;background:${color}"></div></div>
      <div style="width:40px;text-align:right;font-family:var(--mono);font-size:10.5px;color:var(--faint);flex-shrink:0">${val}</div>
    </div>`;

  const A = {

    /* ===== ANALYTICS — performance overview (NET-NEW, not the chat dashboard) ===== */
    analytics: () => `
      <div class="mk-bar"><div class="mk-traffic"><i></i><i></i><i></i></div><div class="mk-url">agent7even.ai/analytics</div></div>
      <div class="mk-body" style="height:430px">
        ${rail([['grid', false], ['chart', true], ['mega', false], ['cal', false]])}
        <div class="mk-main">
          <div class="mk-main-hd">
            <div><div class="ttl">Performance</div><div class="sub">Last 30 days · all channels</div></div>
            <div style="display:flex;gap:5px">
              <span class="tag tag-ghost" style="padding:5px 9px">7D</span>
              <span class="tag tag-blue" style="padding:5px 9px">30D</span>
              <span class="tag tag-ghost" style="padding:5px 9px">90D</span>
            </div>
          </div>
          <div class="mk-pad" style="gap:13px">
            <div class="mk-stats">
              <div class="mk-stat"><div class="n">48.2k ${delta('18%')}</div><div class="l">Reach</div></div>
              <div class="mk-stat"><div class="n">6.1% ${delta('0.9pt')}</div><div class="l">Engagement</div></div>
              <div class="mk-stat"><div class="n">2.4k ${delta('14%')}</div><div class="l">Followers gained</div></div>
            </div>
            <div style="border:1px solid var(--line-2);border-radius:12px;padding:13px 15px;background:#FCFCFD">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:9px">
                <div style="font-size:12.5px;font-weight:600">Reach this month</div>
                <div style="font-family:var(--mono);font-size:10px;color:var(--green);display:inline-flex;align-items:center;gap:3px">${up}trending up</div>
              </div>
              <svg viewBox="0 0 320 92" style="width:100%;height:78px;display:block">
                <defs><linearGradient id="am-area" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stop-color="var(--blue)" stop-opacity=".20"/>
                  <stop offset="1" stop-color="var(--blue)" stop-opacity="0"/>
                </linearGradient></defs>
                <path d="M0,70 L46,64 L91,68 L137,50 L183,44 L229,30 L274,24 L320,12 L320,92 L0,92 Z" fill="url(#am-area)"/>
                <path d="M0,70 L46,64 L91,68 L137,50 L183,44 L229,30 L274,24 L320,12" fill="none" stroke="var(--blue)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
                <circle cx="320" cy="12" r="3.4" fill="var(--blue)"/>
              </svg>
              <div style="display:flex;justify-content:space-between;font-family:var(--mono);font-size:9px;color:var(--faint);margin-top:6px"><span>Wk 1</span><span>Wk 2</span><span>Wk 3</span><span>Wk 4</span></div>
            </div>
            <div style="border:1px solid var(--line-2);border-radius:12px;padding:13px 15px;background:#fff">
              <div style="font-size:12.5px;font-weight:600;margin-bottom:11px">Where it came from</div>
              <div style="display:flex;flex-direction:column;gap:9px">
                ${bar('Instagram', 42, 'var(--brand)', '42%')}
                ${bar('Email', 28, 'var(--blue)', '28%')}
                ${bar('Google', 18, 'var(--green)', '18%')}
                ${bar('Paid ads', 12, 'var(--amber)', '12%')}
              </div>
            </div>
          </div>
        </div>
      </div>`,

    /* ===== ANALYTICS — Maya reads the numbers (Performance Digest output) ===== */
    digest: () => `
      <div class="mk-bar"><div class="mk-traffic"><i></i><i></i><i></i></div><div class="mk-url">agent7even.ai/digest</div></div>
      <div class="mk-body" style="height:430px">
        ${rail([['grid', false], ['chart', true], ['mega', false], ['cal', false]])}
        <div class="mk-main">
          <div class="mk-main-hd">
            <div><div class="ttl">Weekly digest</div><div class="sub">Performance Digest · Mon 7:00am</div></div>
            <span class="tag tag-green" style="display:inline-flex;align-items:center;gap:4px"><span class="live-dot"></span>Auto</span>
          </div>
          <div class="mk-pad" style="gap:11px">
            <div class="mk-note accent-blue">
              <div class="nl">Maya · the read on your week</div>
              <div class="nt">Reach is up <b style="color:var(--ink)">18%</b> week-over-week — your Friday promo drove most of it. Email is your strongest channel right now; Instagram saves dipped a little. Here's what I'd do next.</div>
            </div>
            <div style="font-family:var(--mono);font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--faint);margin:2px 0 -2px">What's working</div>
            <div class="mk-row"><span style="width:20px;height:20px;border-radius:6px;background:#E3F9F0;color:var(--green);display:flex;align-items:center;justify-content:center;flex-shrink:0">${up}</span><div class="grow"><div class="rt">Friday promo drove 22% more reach</div><div class="rs">Best single push this month</div></div><span class="tag tag-green">+18%</span></div>
            <div class="mk-row"><span style="width:20px;height:20px;border-radius:6px;background:#E3F9F0;color:var(--green);display:flex;align-items:center;justify-content:center;flex-shrink:0">${up}</span><div class="grow"><div class="rt">Email open rate climbed to 41%</div><div class="rs">Up 6 points since the subject-line change</div></div><span class="tag tag-green">+6pt</span></div>
            <div style="font-family:var(--mono);font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--faint);margin:4px 0 -2px">Worth a look</div>
            <div class="mk-row"><span style="width:20px;height:20px;border-radius:6px;background:#FFF3DF;color:#9A6400;display:flex;align-items:center;justify-content:center;flex-shrink:0">${down}</span><div class="grow"><div class="rt">Instagram saves down 12%</div><div class="rs">Captions are running long this week</div></div><span class="tag tag-amber">−12%</span></div>
            <div class="mk-note accent-pink"><div class="nl">Maya suggests</div><div class="nt">Want me to tighten this week's captions and run the Friday slot again? I can have both drafted by this afternoon.</div></div>
          </div>
        </div>
      </div>`,

    /* ===== CAMPAIGN BUILDER — one sentence → full multi-day push (NET-NEW) ===== */
    campaignBuilder: () => `
      <div class="mk-bar"><div class="mk-traffic"><i></i><i></i><i></i></div><div class="mk-url">agent7even.ai/agents/campaign-builder</div></div>
      <div class="mk-body" style="height:430px">
        ${rail([['grid', false], ['mega', true], ['cal', false]])}
        <div class="mk-main">
          <div class="mk-main-hd"><div><div class="ttl">Campaign Builder</div><div class="sub">New campaign · Friday slow-day promo</div></div><span class="tag tag-amber">Drafting</span></div>
          <div class="mk-pad" style="gap:11px">
            <div style="border:1px solid var(--line);border-radius:12px;padding:12px 14px;background:#fff">
              <div style="font-family:var(--mono);font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--faint);margin-bottom:6px">Your request</div>
              <div style="font-size:13.5px;color:var(--ink);line-height:1.5">"Promote our Friday slow day with 20% off all drinks."</div>
            </div>
            <div style="display:flex;align-items:center;gap:9px;font-size:12px;color:var(--muted)">
              <span style="font-family:var(--mono);font-size:10px;color:var(--blue)">${arrowR}</span>
              Maya built a 5-day push — <b style="color:var(--ink-2)">6 assets, every channel</b>
            </div>
            <div style="display:flex;flex-direction:column;gap:7px">
              <div class="mk-row" style="padding:9px 12px"><span style="font-family:var(--mono);font-size:10px;color:var(--faint);width:30px;flex-shrink:0">MON</span><span class="tag tag-ghost">Email</span><div class="grow"><div class="rt" style="font-weight:500">Promo announcement</div></div><span style="font-size:11px;color:var(--green);font-weight:500;display:inline-flex;gap:3px;align-items:center">${check}Drafted</span></div>
              <div class="mk-row" style="padding:9px 12px"><span style="font-family:var(--mono);font-size:10px;color:var(--faint);width:30px;flex-shrink:0">TUE</span><span class="tag tag-blue">IG</span><div class="grow"><div class="rt" style="font-weight:500">Lead visual + caption</div></div><span style="font-size:11px;color:var(--green);font-weight:500;display:inline-flex;gap:3px;align-items:center">${check}Drafted</span></div>
              <div class="mk-row" style="padding:9px 12px"><span style="font-family:var(--mono);font-size:10px;color:var(--faint);width:30px;flex-shrink:0">THU</span><span class="tag tag-pink">Story</span><div class="grow"><div class="rt" style="font-weight:500">Reminder + countdown</div></div><span style="font-size:11px;color:var(--green);font-weight:500;display:inline-flex;gap:3px;align-items:center">${check}Drafted</span></div>
              <div class="mk-row" style="padding:9px 12px;border-color:#DCE9FF;background:#F8FBFF"><span style="font-family:var(--mono);font-size:10px;color:var(--blue);width:30px;flex-shrink:0">FRI</span><span class="tag tag-ghost">Email</span><div class="grow"><div class="rt" style="font-weight:500">Last-call draft</div></div><span style="font-size:11px;color:var(--blue);font-weight:500;display:inline-flex;gap:2px;align-items:center">Writing…</span></div>
            </div>
            <div style="display:flex;align-items:center;justify-content:space-between;border-top:1px solid var(--line-2);padding-top:11px;margin-top:1px">
              <div style="font-size:12px;color:var(--faint)"><b style="color:var(--ink-2)">6 assets</b> · awaiting your approval</div>
              <span class="btn-blue" style="font-size:12px;padding:7px 14px;border-radius:8px;color:#fff;font-weight:500">Review &amp; approve</span>
            </div>
          </div>
        </div>
      </div>`,

    /* ===== WEEKLY CONTENT — 7-day plan, drafted in your voice (NET-NEW) ===== */
    contentPlanner: () => `
      <div class="mk-bar"><div class="mk-traffic"><i></i><i></i><i></i></div><div class="mk-url">agent7even.ai/agents/weekly-content</div></div>
      <div class="mk-body" style="height:430px">
        ${rail([['grid', false], ['cal', true], ['mega', false]])}
        <div class="mk-main">
          <div class="mk-main-hd"><div><div class="ttl">Content plan</div><div class="sub">Week of Jun 8 · written in your voice</div></div><span class="tag tag-green">5 drafted</span></div>
          <div class="mk-pad" style="gap:12px">
            <div style="display:grid;grid-template-columns:repeat(7,minmax(56px,1fr));gap:6px;overflow-x:auto">
              ${[['MON','IG','var(--brand)','New roast drop'],['TUE','','',''],['WED','Email','var(--blue)','Loyalty offer'],['THU','IG','var(--brand)','Behind the bake'],['FRI','Story','var(--amber)','Slow-day promo'],['SAT','IG','var(--brand)','Weekend hours'],['SUN','','','']].map(([d,ch,c,t]) => `
                <div style="border:1px solid var(--line-2);border-radius:9px;min-height:96px;padding:7px 6px;background:${ch?'#fff':'#FCFCFD'};display:flex;flex-direction:column;gap:5px">
                  <div style="font-family:var(--mono);font-size:8.5px;color:var(--faint);text-align:center">${d}</div>
                  ${ch ? `<div style="background:${c};opacity:.12;border-radius:6px;height:4px;margin:0 1px"></div><div style="font-size:8.5px;font-weight:600;color:${c}">${ch}</div><div style="font-size:9px;color:var(--ink-2);line-height:1.3">${t}</div>` : `<div style="flex:1;display:flex;align-items:center;justify-content:center;color:#D5D7DC;font-size:14px">+</div>`}
                </div>`).join('')}
            </div>
            <div class="mk-note accent-pink"><div class="nl">Maya · filling the gaps</div><div class="nt">Tuesday and Sunday are quiet. Want a behind-the-scenes reel and a customer-spotlight post to round out the week?</div></div>
            <div class="mk-row"><span class="dot" style="background:var(--green)"></span><div class="grow"><div class="rt">Draft queue · 5 posts ready</div><div class="rs">One approval session covers the whole week</div></div><span style="font-size:12px;color:var(--blue);font-weight:500;display:inline-flex;gap:2px;align-items:center">Review all ${chev}</span></div>
          </div>
        </div>
      </div>`,

    /* ===== APPROVAL QUEUE — drafts awaiting sign-off ===== */
    approvalQueue: () => `
      <div class="mk-bar"><div class="mk-traffic"><i></i><i></i><i></i></div><div class="mk-url">agent7even.ai/approvals</div></div>
      <div class="mk-body" style="height:430px">
        ${rail([['grid', false], ['mail', true], ['mega', false]])}
        <div class="mk-main">
          <div class="mk-main-hd"><div><div class="ttl">Approval queue</div><div class="sub">3 drafts waiting</div></div><span class="pill" style="font-size:11px;padding:5px 11px">3 waiting</span></div>
          <div class="mk-pad" style="gap:10px">
            <div class="mk-row" style="border-color:#DCE9FF;background:#F8FBFF;align-items:flex-start"><span class="dot" style="background:var(--blue);margin-top:5px"></span><div class="grow"><div class="rt">Friday promo email</div><div class="rs">Draft · paste into ESP after approval</div></div>
              <div style="display:flex;gap:6px"><span class="btn-blue" style="font-size:12px;padding:6px 13px;border-radius:8px;color:#fff;font-weight:500">Approve</span><span class="tag tag-ghost" style="padding:6px 11px">Edit</span></div></div>
            <div class="mk-row" style="align-items:flex-start"><span class="dot" style="background:var(--green);margin-top:5px"></span><div class="grow"><div class="rt">Instagram post + caption</div><div class="rs">Image generated · on-brand</div></div><span class="tag tag-green" style="padding:6px 12px">Approve</span></div>
            <div class="mk-row" style="align-items:flex-start"><span class="dot" style="background:var(--amber);margin-top:5px"></span><div class="grow"><div class="rt">Weekly content plan</div><div class="rs">5 posts · one session</div></div><span class="tag tag-amber" style="padding:6px 12px">Review</span></div>
            <div class="mk-note accent-pink" style="margin-top:2px"><div class="nl">Maya · waiting on you</div><div class="nt">Nothing goes live until you say so. Approve what&rsquo;s right, then publish when you&rsquo;re ready.</div></div>
          </div>
        </div>
      </div>`,

    reputationQueue: () => A.approvalQueue(),

    /* ===== COMPETITOR WATCHER — weekly board of rival moves (NET-NEW) ===== */
    competitorBoard: () => `
      <div class="mk-bar"><div class="mk-traffic"><i></i><i></i><i></i></div><div class="mk-url">agent7even.ai/agents/competitor-watcher</div></div>
      <div class="mk-body" style="height:430px">
        ${rail([['grid', false], ['eye', true], ['mega', false]])}
        <div class="mk-main">
          <div class="mk-main-hd"><div><div class="ttl">Competitor watch</div><div class="sub">Weekly report from your Foundation · updated Mon</div></div><span class="pill" style="font-size:11px;padding:5px 11px"><span class="live-dot"></span>Auto</span></div>
          <div class="mk-pad" style="gap:10px">
            <div class="mk-note accent-red"><div class="nl">Maya flagged · this needs a response</div><div style="font-size:13.5px;font-weight:600;color:var(--ink);margin:1px 0 3px">Rival Coffee Co. launched 15% off</div><div class="nt">Running on Instagram since Monday. A counter-offer is drafted and waiting in your queue.</div></div>
            <div style="font-family:var(--mono);font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--faint);margin:2px 0 -2px">This week's moves</div>
            <div class="mk-row" style="padding:10px 12px"><span class="dot" style="background:var(--orange)"></span><div class="grow"><div class="rt">Rival Coffee Co. — 15% off promo</div><div class="rs">Instagram · Mon</div></div><span class="tag tag-pink">Offer</span></div>
            <div class="mk-row" style="padding:10px 12px"><span class="dot" style="background:var(--amber)"></span><div class="grow"><div class="rt">The Press Bar — new paid ad</div><div class="rs">Instagram · Tue</div></div><span class="tag tag-amber">Ad</span></div>
            <div class="mk-row" style="padding:10px 12px"><span class="dot" style="background:var(--blue)"></span><div class="grow"><div class="rt">Grounds Market — email campaign</div><div class="rs">Newsletter · Wed</div></div><span class="tag tag-blue">Content</span></div>
            <div class="mk-row" style="padding:10px 12px"><span class="dot" style="background:var(--faint)"></span><div class="grow"><div class="rt">Daily Grind — raised prices 8%</div><div class="rs">Menu · Thu</div></div><span class="tag tag-ghost">Pricing</span></div>
            <div style="font-size:11.5px;color:var(--faint);text-align:center;padding-top:2px">Full report lands every Monday, 8:00am</div>
          </div>
        </div>
      </div>`,
  };

  function boot() {
    document.querySelectorAll('[data-am]').forEach((el) => {
      const name = el.getAttribute('data-am');
      if (A[name]) { el.classList.add('mk'); el.innerHTML = A[name](); }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  window.__initAgentMockups = boot;
})();
