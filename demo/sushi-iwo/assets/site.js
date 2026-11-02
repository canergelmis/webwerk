/* iwo · shared page script: language switch (FR in the markup, DE/EN from window.I18N),
   today's hours row, header state, the two-frame pop, and the menu family bar. */
(() => {
  const root = document.documentElement;
  const DICT = window.I18N || { de: {}, en: {} };
  const LANGS = ['fr', 'de', 'en'];
  const KEY = 'iwo-lang';
  const WOLT = l => `https://wolt.com/${l}/lux/mersch/restaurant/restaurant-iwo-ettelbruck`;

  /* today's row in the hours table (Luxembourg time); inserted before FR is captured */
  const row = (() => {
    try {
      const wd = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'Europe/Luxembourg' }).format(new Date());
      return document.querySelector(`[data-day="${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(wd)}"]`);
    } catch (e) { return null; }
  })();
  if (row) {
    row.classList.add('today');
    const tag = document.createElement('span');
    tag.className = 'vh'; /* today is shown by bold + a dot; the word is for screen readers */
    tag.dataset.t = 'today';
    tag.textContent = ' (aujourd’hui)';
    row.querySelector('th').append(tag);
  }

  /* capture the French strings from the markup */
  const FR = {};
  const meta = document.querySelector('meta[name="description"]');
  document.querySelectorAll('[data-t]').forEach(e => { FR[e.dataset.t] = e.textContent; });
  document.querySelectorAll('[data-th]').forEach(e => { FR[e.dataset.th] = e.innerHTML; });
  document.querySelectorAll('[data-ta]').forEach(e => e.dataset.ta.split(';').forEach(p => { const [a, k] = p.split(':'); FR[k] = e.getAttribute(a); }));
  FR.title = document.title;
  FR.desc = meta ? meta.content : '';

  const pick = (l, k) => (l === 'fr' || DICT[l] == null || DICT[l][k] == null) ? FR[k] : DICT[l][k];

  function setLang(l) {
    if (!LANGS.includes(l)) l = 'fr';
    root.lang = l;
    document.querySelectorAll('[data-t]').forEach(e => { e.textContent = pick(l, e.dataset.t); });
    document.querySelectorAll('[data-th]').forEach(e => { e.innerHTML = pick(l, e.dataset.th); });
    document.querySelectorAll('[data-ta]').forEach(e => e.dataset.ta.split(';').forEach(p => { const [a, k] = p.split(':'); e.setAttribute(a, pick(l, k)); }));
    document.title = pick(l, 'title');
    if (meta) meta.content = pick(l, 'desc');
    document.querySelectorAll('[data-wolt]').forEach(a => { a.href = WOLT(l); });
    document.querySelectorAll('a[data-keep]').forEach(a => {
      if (!a.dataset.base) a.dataset.base = a.getAttribute('href');
      const [path, hash] = a.dataset.base.split('#');
      a.href = path + (l === 'fr' ? '' : `?lang=${l}`) + (hash ? `#${hash}` : '');
    });
    document.querySelectorAll('.langs button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.l === l)));
    try { localStorage.setItem(KEY, l); } catch (e) { /* storage blocked: the ?lang= links still carry it */ }
    const q = new URLSearchParams(location.search);
    if (q.has('lang')) { q.set('lang', l); history.replaceState(null, '', `${location.pathname}?${q}${location.hash}`); }
  }

  document.querySelectorAll('.langs button').forEach(b => b.addEventListener('click', () => setLang(b.dataset.l)));
  let start = new URLSearchParams(location.search).get('lang');
  try { start = start || localStorage.getItem(KEY); } catch (e) { /* ignore */ }
  setLang(start || 'fr');

  /* for the headless parity check: keys used on the page with no DE/EN entry */
  window.__i18nParity = () => {
    const keys = new Set(['title', 'desc']);
    document.querySelectorAll('[data-t]').forEach(e => keys.add(e.dataset.t));
    document.querySelectorAll('[data-th]').forEach(e => keys.add(e.dataset.th));
    document.querySelectorAll('[data-ta]').forEach(e => e.dataset.ta.split(';').forEach(p => keys.add(p.split(':')[1])));
    const out = { keys: keys.size };
    for (const l of ['de', 'en']) out[l] = [...keys].filter(k => DICT[l][k] == null || DICT[l][k] === '');
    return out;
  };

  /* header: transparent over the home hero, solid once scrolled */
  const bar = document.querySelector('.bar');
  const always = document.body.classList.contains('menu');
  const solid = () => bar && bar.classList.toggle('solid', always || scrollY > 8);
  addEventListener('scroll', solid, { passive: true });
  solid();

  /* the header (and the menu's family bar) takes the ground colour of the band under it */
  const famBar = document.querySelector('.fam');
  let tintQueued = false, lastTint = '';
  const tint = () => {
    tintQueued = false;
    if (!bar) return;
    const edge = (famBar || bar).getBoundingClientRect().bottom + 2;
    let col = '';
    for (const el of document.elementsFromPoint(innerWidth / 2, Math.min(edge, innerHeight - 1))) {
      if (el.closest('.bar, .fam')) continue;
      for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
        if (!e.matches('section, footer, li.scene, .fam-head, .cats, .family, body')) continue; /* bands only, never a pill or a plaque */
        const c = getComputedStyle(e).backgroundColor;
        const m = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
        if (m && (m[4] === undefined || +m[4] > .5)) { col = `rgba(${m[1]}, ${m[2]}, ${m[3]}, .92)`; break; }
      }
      if (col) break;
    }
    if (!col) col = 'rgba(238, 177, 199, .92)';
    if (col !== lastTint) { lastTint = col; root.style.setProperty('--bar-bg', col); }
  };
  const queueTint = () => { if (!tintQueued) { tintQueued = true; requestAnimationFrame(tint); } };
  addEventListener('scroll', queueTint, { passive: true });
  addEventListener('resize', queueTint);
  tint();

  /* menu: family bar, active pill follows the scroll */
  const fam = document.querySelector('.fam');
  if (fam) {
    const links = [...fam.querySelectorAll('a')];
    const secs = links.map(a => document.getElementById(a.getAttribute('href').slice(1)));
    let ticking = false, last = null;
    const update = () => {
      ticking = false;
      const line = fam.getBoundingClientRect().bottom + 24;
      let i = 0;
      secs.forEach((s, j) => { if (s && s.getBoundingClientRect().top <= line) i = j; });
      if (i === last) return;
      last = i;
      links.forEach((a, j) => { if (j === i) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
      const a = links[i];
      const left = a.offsetLeft - (fam.clientWidth - a.offsetWidth) / 2;
      fam.scrollTo({ left: Math.max(0, left), behavior: 'auto' });
    };
    addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    addEventListener('resize', update);
    update();
  }

  const still = !('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* stop-motion clips. <img data-loop="assets/name"> becomes a muted looping video (name.webm, then name.mp4)
     that plays only while in view. <img data-once="assets/name"> plays once when 40% of it is in view,
     then rests on its last frame. data-poster sets the first frame (else the image is the poster).
     Nothing loads until it is needed; on error the image comes back. Reduced motion keeps the image. */
  if (!still) {
    const make = (img, base, loop) => {
      const v = document.createElement('video');
      Object.assign(v, { muted: true, defaultMuted: true, loop, playsInline: true, preload: 'none', poster: img.dataset.poster || img.getAttribute('src') });
      v.setAttribute('muted', ''); v.setAttribute('playsinline', ''); if (loop) v.setAttribute('loop', '');
      v.width = 720; v.height = 896;
      v.className = img.className;
      v.setAttribute('role', 'img');
      if (img.dataset.ta) v.dataset.ta = img.dataset.ta.replace(/^alt:/, 'aria-label:');
      v.setAttribute('aria-label', img.alt);
      v.innerHTML = `<source src="${base}.webm" type="video/webm"><source src="${base}.mp4" type="video/mp4">`;
      return v;
    };
    const play = v => { const p = v.play(); if (p && p.catch) p.catch(() => {}); };
    const swap = (img, v, io) => {
      v.lastElementChild.addEventListener('error', () => { io.unobserve(v); img.alt = v.getAttribute('aria-label'); v.replaceWith(img); });
      img.replaceWith(v);
      io.observe(v);
    };
    const loopIO = new IntersectionObserver(entries => {
      for (const e of entries) if (e.isIntersecting) play(e.target); else e.target.pause();
    }, { threshold: 0.25 });
    const onceIO = new IntersectionObserver(entries => {
      for (const e of entries) {
        const v = e.target;
        if (v.ended) { onceIO.unobserve(v); continue; }
        if (e.intersectionRatio >= 0.4) play(v); else if (!v.paused) v.pause();
      }
    }, { threshold: [0, 0.4] });
    document.querySelectorAll('img[data-loop]').forEach(img => swap(img, make(img, img.dataset.loop, true), loopIO));
    document.querySelectorAll('img[data-once]').forEach(img => {
      const v = make(img, img.dataset.once, false);
      v.addEventListener('ended', () => { v.dataset.done = '1'; onceIO.unobserve(v); }, { once: true });
      swap(img, v, onceIO);
    });
  }

  /* the two-frame pop on viewport entry; reduced motion shows the final state */
  const els = document.querySelectorAll('.pop');
  if (still) return;
  root.classList.add('js');
  const io = new IntersectionObserver(entries => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
  }, { rootMargin: '0px 0px -12% 0px' });
  els.forEach(el => io.observe(el));
})();
