// "Bhimas Gada Challenge", the accessible cut: one rule (catch what the card asks for), one soft
// hazard (a chilli knocks a dish off). Round 1 is an untimed practice round; the finale can't be lost.
// Classic script on purpose (file:// screenshots can't load modules). The simulation is pure and
// DOM-free (self.FeastSim) so tests and tuning can drive it; the DOM/canvas layer boots after it.
(function (G) {
  'use strict';

  // ---------------------------------------------------------------- tuning: every number lives here
  const CONFIG = {
    step: 1 / 120,            // fixed simulation step (s)
    leafLag: 0.08,            // s, ease time constant of the leaf toward the finger / mouse / tap
    keySpeed: 1.25,           // stage widths per second for arrow / A D keys
    catchHalf: 0.6,           // catch half-width, as a fraction of the leaf width
    magnet: { margin: 0.15, window: 0.10, pull: 9 },  // aim assist: dishes within +margin (leaf widths) of the
                                                      // catch edge are drawn in over the last 10% of their fall
    chilliGrace: 1,           // s after a chilli knock with no further chilli effect
    reducedSlow: 1.2,         // throws 20% slower under prefers-reduced-motion
    needClear: 1.1,           // a needed dish lands at least this far (x the full catch reach) from where the leaf rests
    dupShare: 0.3,            // chance a throw is a card dish you already have (it just bounces off)
    points: { catch: 100, timeBonusPerSec: 20, finaleHit: 500 },
    clearBeat: 0.9,           // s the full thali is shown before the next title
    titleTime: 1.2,           // s, cinema title card (skippable)
    tutor: { T: 3.2, offset: 0.32, again: 0.5 },      // round 1 opener: one sambar dropping slowly beside the leaf
    // per round: time limit (null = untimed), flight time T (s, start -> end of the round), spawn gap
    // (s, start -> end), most items in the air, chilli chance / cap, chance a chilli flies beside a
    // dish (offset in catch half-widths, delay in s), crossing pair chance.
    rounds: [
      { title: 'Lunch Buffet', card: ['rice', 'dal', 'sambar'], time: null,
        T: [2.9, 2.5], gap: [2.2, 1.9], maxAir: 2, chilli: 0, maxChilli: 0, pair: 0, cross: 0 },
      { title: 'Weekend Specials', card: ['dosa', 'idli', 'ragi'], time: 45,
        T: [2.5, 2.1], gap: [2.0, 1.7], maxAir: 3, chilli: 0.16, maxChilli: 1, pair: 0.25,
        pairDx: [1.15, 1.6], pairDt: [0.25, 0.5], cross: 0.15 },
      { title: 'Only in Bhimas', card: ['biryani', 'rasam', 'sweets', 'pachadi'], time: 45,
        T: [2.3, 1.9], gap: [1.9, 1.6], maxAir: 4, chilli: 0.18, maxChilli: 2, pair: 0.3,
        pairDx: [1.15, 1.6], pairDt: [0.2, 0.45], cross: 0.2 },
    ],
    // finale: misses never drop the gada and there is no tap limit
    finale: { hits: 3, zone: 0.30, period: 1.8, widenAfter: 3, widenBy: 0.06, zoneMax: 0.6, zoneRange: [0.35, 0.65] },
  };

  const DISHES = {
    rice: 'Rice', dal: 'Dal', sambar: 'Sambar', rasam: 'Rasam', pachadi: 'Pachadi', sweets: 'Sweets',
    biryani: 'Hyderabadi Biryani', ragi: 'Ragi Mudda', dosa: 'Dosa', idli: 'Idli / Vada',
  };
  const ALL = Object.keys(DISHES);

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  // ---------------------------------------------------------------- simulation
  function createSim(seed, opts = {}) {
    const S = {
      seed: seed >>> 0, cfg: CONFIG, slow: opts.reduced ? CONFIG.reducedSlow : 1,
      // geometry (px); the DOM layer measures and sets it
      W: 390, H: 844, fieldTop: 190, leafY: 760, leafW: 156, leafH: 70, item: 76,
      state: 'start', round: 0, next: null, t: 0, timeLeft: null, stateT: 0,
      items: [], stack: [], slots: [], score: 0, roundScore: 0, attempt: 0, grace: 0,
      tutor: false, tutorWait: 0, tutorSide: 1,
      leafX: 195, leafTarget: 195, keyDir: 0, lostReason: null, events: [], nextSpawn: 0, uid: 0,
      finale: null,
      rand: mulberry32(seed),
    };

    S.setGeometry = g => {
      const sx = g.W / S.W;
      for (const it of S.items) { it.x *= sx; it.vx *= sx; }
      S.leafX *= sx; S.leafTarget *= sx;
      Object.assign(S, g);
      S.leafX = clamp(S.leafX, S.leafW * 0.4, S.W - S.leafW * 0.4);
      S.leafTarget = clamp(S.leafTarget, S.leafW * 0.4, S.W - S.leafW * 0.4);
    };
    S.catchHalf = () => S.leafW * CONFIG.catchHalf;
    S.assist = () => S.leafW * CONFIG.magnet.margin;
    // the catch line rises a little as the thali heaps up
    S.catchY = () => S.leafY - S.leafH * 0.2 - Math.min(S.stack.length, 5) * S.leafH * 0.12;
    S.setTarget = x => { S.leafTarget = clamp(x, S.leafW * 0.4, S.W - S.leafW * 0.4); };
    const emit = e => S.events.push(e);

    const rc = () => CONFIG.rounds[S.round];
    const span = () => rc().time || 30;               // round 1 ramps over 30 s although it has no clock
    const progress = () => clamp(S.t / span(), 0, 1);
    const open = () => S.slots.filter(s => !s.filled).map(s => s.key);
    const live = () => S.items.filter(i => !i.done);
    const chilliCount = () => live().filter(i => i.key === 'chilli').length;

    function newFinale() {
      return { lift: 0, taps: 0, misses: 0, phase: 0, needle: 0, zone: [0.5, CONFIG.finale.zone] };
    }
    function startRound(i) {
      const c = CONFIG.rounds[i];
      S.round = i; S.state = 'play'; S.t = 0; S.stateT = 0; S.timeLeft = c.time;
      S.items = []; S.stack = []; S.grace = 0; S.lostReason = null;
      S.slots = c.card.map(key => ({ key, filled: false }));
      S.roundScore = S.score;
      S.rand = mulberry32((S.seed * 7919 + i * 104729 + S.attempt * 1299709) >>> 0);
      S.nextSpawn = 0.6;
      // round 1 opens with the lesson: one sambar, dropping slowly beside the leaf
      S.tutor = i === 0; S.tutorWait = 0.4; S.tutorSide = S.rand() < 0.5 ? -1 : 1;
      emit({ type: 'round', round: i });
    }
    function startFinale() {
      S.state = 'finale'; S.round = 3; S.stateT = 0; S.items = []; S.lostReason = null;
      S.rand = mulberry32((S.seed * 7919 + 3 * 104729 + S.attempt * 1299709) >>> 0);
      S.finale = newFinale();
      S.roundScore = S.score;
      emit({ type: 'finale' });
    }
    function title(next) {
      if (next === 'finale') S.finale = newFinale();
      S.state = 'title'; S.next = next; S.stateT = 0; emit({ type: 'title', next });
    }

    // one throw: an arc from the left, right or top edge to a landing x on the catch line
    function launch(key, o = {}) {
      const c = rc(), p = progress(), r = S.rand;
      const F = S.leafY - S.fieldTop;
      const s = S.item;
      const m = Math.max(S.leafW * 0.45, S.W * 0.08);
      let tx = o.tx != null ? clamp(o.tx, m * 0.6, S.W - m * 0.6) : lerp(m, S.W - m, r());
      // a dish the card still needs never lands on a resting leaf: one move is always part of a catch
      if (key !== 'chilli' && !o.tutor && open().includes(key)) {
        const keep = (S.catchHalf() + S.assist()) * CONFIG.needClear;
        if (Math.abs(tx - S.leafX) < keep) {
          const side = tx >= S.leafX ? 1 : -1;
          tx = S.leafX + side * keep;
          if (tx < m * 0.6 || tx > S.W - m * 0.6) tx = S.leafX - side * keep;
          tx = clamp(tx, m * 0.6, S.W - m * 0.6);
        }
      }
      const T = (o.T || lerp(c.T[0], c.T[1], p) * (0.92 + 0.16 * r())) * (o.T ? 1 : S.slow);
      let edge = o.edge;
      if (!edge) {
        const e = r();
        edge = e < 0.38 ? 'left' : e < 0.76 ? 'right' : 'top';
        // don't throw from the side the dish lands on: a short lob reads as a drop
        if (edge === 'left' && tx < S.W * 0.22) edge = 'right';
        else if (edge === 'right' && tx > S.W * 0.78) edge = 'left';
      }
      let x0, y0, apex;
      if (edge === 'left') { x0 = -s * 0.5; y0 = S.fieldTop + F * lerp(0.08, 0.38, r()); apex = F * lerp(0.12, 0.3, r()); }
      else if (edge === 'right') { x0 = S.W + s * 0.5; y0 = S.fieldTop + F * lerp(0.08, 0.38, r()); apex = F * lerp(0.12, 0.3, r()); }
      else if (edge === 'drop') { x0 = tx; y0 = S.fieldTop - s * 0.2; apex = 1; }
      else { x0 = clamp(tx + (r() - 0.5) * S.W * 0.7, s * 0.5, S.W - s * 0.5); y0 = S.fieldTop - s * 0.2; apex = F * lerp(0.02, 0.08, r()); }
      apex = Math.max(1, Math.min(apex, y0 - (S.fieldTop - s * 0.35)));
      const yc = S.catchY();
      const d = yc - y0;
      const u = (Math.sqrt(2 * apex) + Math.sqrt(2 * apex + 2 * d)) / T;
      const g = u * u;
      const it = {
        id: ++S.uid, key, x: x0, y: y0, px: x0, py: y0, vx: (tx - x0) / T, vy: -Math.sqrt(2 * g * apex), g, T,
        rot: edge === 'drop' ? 0 : r() * Math.PI * 2, spin: edge === 'drop' ? 0.4 : (r() < 0.5 ? -1 : 1) * lerp(0.6, 1.6, r()),
        age: 0, done: false, edge, tutor: !!o.tutor,
      };
      S.items.push(it);
      return it;
    }

    // every dish that flies is on the card: mostly one still needed, sometimes one already on the leaf
    function pickDish() {
      const card = rc().card, o = open();
      if (!o.length || S.rand() < CONFIG.dupShare) return card[Math.floor(S.rand() * card.length)];
      const fresh = o.filter(k => !live().some(i => i.key === k));
      const pool = fresh.length ? fresh : o;
      return pool[Math.floor(S.rand() * pool.length)];
    }
    function flightT(it) {
      const yc = S.catchY();
      const a = 0.5 * it.g, b = it.vy, cc = it.y - yc;
      const disc = b * b - 4 * a * cc;
      return disc < 0 ? 1 : (-b + Math.sqrt(disc)) / (2 * a);
    }
    function besideChilli(dish) {
      // a chilli flying right beside a dish you need: dodgeable, it lands outside the catch with a delay
      const c = rc(), r = S.rand;
      const h = S.catchHalf();
      const side = r() < 0.5 ? -1 : 1;
      const ft = flightT(dish);
      const land = dish.x + dish.vx * ft;
      launch('chilli', { tx: land + side * h * lerp(c.pairDx[0], c.pairDx[1], r()), edge: dish.edge, T: ft + lerp(c.pairDt[0], c.pairDt[1], r()) });
    }

    function spawn() {
      const c = rc(), r = S.rand;
      const room = c.maxAir - live().length;
      if (room <= 0) return -1;            // the air is full: look again shortly
      const chilliOk = c.maxChilli > 0 && chilliCount() < c.maxChilli;
      if (c.cross && room >= 2 && r() < c.cross) {
        // crossing arcs: one dish from each side, each landing on the far half
        const a = launch(pickDish(), { edge: 'left', tx: S.W * lerp(0.55, 0.88, r()) });
        launch(pickDish(), { edge: 'right', tx: S.W * lerp(0.12, 0.45, r()), T: flightT(a) * lerp(1.15, 1.35, r()) });
        return 1.4;
      }
      if (chilliOk && r() < c.chilli) { launch('chilli'); return 0.8; }
      const it = launch(pickDish());
      if (chilliOk && room >= 2 && r() < c.pair && open().includes(it.key)) besideChilli(it);
      return 1;
    }

    function stepTutor(dt) {
      // keep one slow sambar dropping beside the leaf until it is caught
      if (live().some(i => i.tutor)) return;
      S.tutorWait -= dt;
      if (S.tutorWait > 0) return;
      const off = S.W * CONFIG.tutor.offset;
      let x = S.leafX + S.tutorSide * off;
      if (x < S.leafW * 0.5 || x > S.W - S.leafW * 0.5) { S.tutorSide *= -1; x = S.leafX + S.tutorSide * off; }
      launch('sambar', { edge: 'drop', tx: x, T: CONFIG.tutor.T * S.slow, tutor: true });
      S.tutorSide *= -1;
      S.tutorWait = CONFIG.tutor.again;
      emit({ type: 'tutor', x });
    }

    function knockOff() {
      if (!S.stack.length) return null;
      const key = S.stack.pop();
      const slot = S.slots.find(s => s.key === key && s.filled);
      if (slot) slot.filled = false;
      return key;
    }

    function resolveCatch(it, x) {
      it.done = true;
      if (it.key === 'chilli') {
        if (S.grace > 0) { emit({ type: 'chilliGrace', x }); return; }
        const knocked = knockOff();
        S.grace = CONFIG.chilliGrace;
        emit({ type: 'chilli', x, knocked });
        return;
      }
      if (it.tutor) { S.tutor = false; S.nextSpawn = 0.9; }
      const slot = S.slots.find(s => s.key === it.key && !s.filled);
      if (!slot) { emit({ type: 'dup', key: it.key, x }); return; }   // already on the leaf: a soft bounce
      slot.filled = true; S.stack.push(it.key);
      S.score += CONFIG.points.catch;
      emit({ type: 'catch', key: it.key, x, pts: CONFIG.points.catch, rot: it.rot });
      if (S.slots.every(s => s.filled)) {
        const bonus = rc().time ? Math.ceil(S.timeLeft) * CONFIG.points.timeBonusPerSec : 0;
        S.score += bonus; S.state = 'clear'; S.stateT = 0;
        emit({ type: 'clear', bonus, round: S.round });
      }
    }

    function stepPlay(dt) {
      S.t += dt;
      if (rc().time) S.timeLeft = Math.max(0, rc().time - S.t);
      S.grace = Math.max(0, S.grace - dt);
      if (S.tutor) stepTutor(dt);
      else {
        S.nextSpawn -= dt;
        if (S.nextSpawn <= 0) {
          const c = rc();
          const k = spawn();
          S.nextSpawn = k < 0 ? 0.3 : lerp(c.gap[0], c.gap[1], progress()) * k * (0.85 + 0.3 * S.rand()) * S.slow;
        }
      }
      const yc = S.catchY(), h = S.catchHalf(), m = S.assist(), mg = CONFIG.magnet;
      for (const it of S.items) {
        if (it.done) continue;
        it.age += dt;
        it.px = it.x; it.py = it.y;
        it.vy += it.g * dt;
        it.x += it.vx * dt; it.y += it.vy * dt;
        it.rot += it.spin * dt;
        const dish = it.key !== 'chilli';
        // aim assist: over the last 10% of a dish's fall, a near miss is drawn onto the leaf
        if (dish && it.vy > 0 && it.y < yc && it.age >= it.T * (1 - mg.window)) {
          const left = Math.max(0.0001, it.T - it.age);
          const land = it.x + it.vx * left;
          if (Math.abs(land - S.leafX) <= h + m) {
            const want = clamp(it.x, S.leafX - h * 0.8, S.leafX + h * 0.8);
            it.x += (want - it.x) * Math.min(1, dt * mg.pull);
          }
        }
        if (it.vy > 0 && it.py < yc && it.y >= yc) {
          const f = (yc - it.py) / (it.y - it.py);
          const xi = it.px + (it.x - it.px) * f;
          if (Math.abs(xi - S.leafX) <= h + (dish ? m : 0)) { resolveCatch(it, xi); if (S.state !== 'play') break; }
        }
        if (it.y > S.H + S.item || it.x < -S.item * 2 || it.x > S.W + S.item * 2) it.done = true;
      }
      S.items = S.items.filter(i => !i.done);
      if (S.state === 'play' && rc().time && S.timeLeft <= 0) {
        S.state = 'lost'; S.lostReason = 'time'; S.stateT = 0; emit({ type: 'timeout' });
      }
    }

    function stepLeaf(dt) {
      if (S.keyDir) S.setTarget(S.leafTarget + S.keyDir * CONFIG.keySpeed * S.W * dt);
      S.leafX += (S.leafTarget - S.leafX) * (1 - Math.exp(-dt / CONFIG.leafLag));
    }

    function stepFinale(dt) {
      const f = S.finale;
      f.phase += dt / (CONFIG.finale.period * S.slow);
      const ph = f.phase % 2;
      f.needle = ph < 1 ? ph : 2 - ph;           // ping-pong sweep 0..1
    }

    S.update = dt => {
      S.stateT += dt;
      if (S.state === 'play') { stepLeaf(dt); stepPlay(dt); }
      else if (S.state === 'clear') {
        stepLeaf(dt);
        if (S.stateT >= CONFIG.clearBeat) title(S.round < 2 ? S.round + 1 : 'finale');
      } else if (S.state === 'title') {
        if (S.stateT >= CONFIG.titleTime) S.skip();
      } else if (S.state === 'finale') stepFinale(dt);
      else if (S.state === 'lost') {
        for (const it of S.items) { it.vy += it.g * dt; it.x += it.vx * dt; it.y += it.vy * dt; it.rot += it.spin * dt; }
      }
    };

    S.skip = () => {
      if (S.state !== 'title') return;
      if (S.next === 'finale') startFinale(); else startRound(S.next);
    };
    S.begin = () => { S.score = 0; S.attempt = 0; title(0); };
    S.start = r => {           // test/debug: jump straight into a round (1..3) or the finale (4)
      if (r === 4 || r === 'finale') startFinale(); else startRound(clamp((r | 0) - 1, 0, 2));
    };
    S.retry = () => {
      if (S.state !== 'lost') return;
      S.attempt++; S.score = S.roundScore; startRound(S.round);
    };
    S.tap = () => {
      if (S.state !== 'finale') return null;
      const f = S.finale, cf = CONFIG.finale;
      f.taps++;
      const hit = Math.abs(f.needle - f.zone[0]) <= f.zone[1] / 2;
      if (hit) {
        f.lift++; f.misses = 0; S.score += CONFIG.points.finaleHit;
        f.zone = [lerp(cf.zoneRange[0], cf.zoneRange[1], S.rand()), cf.zone];
      } else {
        // a miss never drops the gada; after a few in a row the gold zone opens up a little each time
        f.misses++;
        const extra = Math.max(0, f.misses - cf.widenAfter + 1) * cf.widenBy;
        f.zone = [f.zone[0], Math.min(cf.zoneMax, cf.zone + extra)];
      }
      emit({ type: hit ? 'lift' : 'miss', lift: f.lift, needle: f.needle });
      if (f.lift >= cf.hits) { S.state = 'won'; S.stateT = 0; emit({ type: 'won' }); }
      return hit;
    };
    S.snapshot = () => ({
      t: S.t, state: S.state, leafX: S.leafX, catchY: S.catchY(), catchHalf: S.catchHalf(), W: S.W,
      open: open(), card: S.state === 'play' ? rc().card.slice() : [],
      items: live().map(i => ({ id: i.id, key: i.key, x: i.x, y: i.y, vx: i.vx, vy: i.vy, g: i.g, age: i.age })),
    });
    return S;
  }

  G.FeastSim = { CONFIG, DISHES, createSim, mulberry32 };
  if (typeof document === 'undefined') return;

  // ================================================================ DOM + canvas
  const root = document.documentElement;
  const q = new URLSearchParams(location.search);
  const anim = root.classList.contains('anim');
  const reduced = root.classList.contains('reduced');
  const seed = q.has('seed') ? (parseInt(q.get('seed'), 10) || 0) : (Date.now() % 100000);
  const sim = createSim(seed, { reduced });
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const game = $('#game');
  const cv = $('#stage');
  const ctx = cv.getContext('2d');
  const BEST_KEY = 'bhimas-feast-best';
  let best = 0;
  // EN · FR · DE: the site's choice (assets/js/i18n.js). Their slogans and dish names stay English.
  const T = (k, v, fb) => (G.BH && G.BH.t(k, v)) || fb;
  const dname = k => T('dish.' + k, null, DISHES[k]);
  const LOCALES = { en: 'en-US', fr: 'fr-FR', de: 'de-DE' };
  const num = n => n.toLocaleString(LOCALES[G.BH && G.BH.lang] || 'en-US');
  const ROUND_KEYS = ['lunch', 'weekend', null];
  try { best = parseInt(localStorage.getItem(BEST_KEY), 10) || 0; } catch (e) { best = 0; }

  // ---- assets
  const A = 'assets/img/sprites/';
  const img = {};
  const load = (k, src) => new Promise(res => { const i = new Image(); i.onload = () => res(); i.onerror = () => res(); i.src = src; img[k] = i; });
  const loads = [...ALL, 'chilli', 'leaf'].map(k => load(k, A + k + '.webp'));
  loads.push(load('foodM', 'assets/img/banner-banquet-m.jpg'), load('foodD', 'assets/img/banner-banquet-d.jpg'),
    load('plateM', 'assets/img/game-gada-plate-m.jpg'), load('plateD', 'assets/img/game-gada-plate-d.jpg'),
    load('gadaM', A + 'gada-cut-m.webp'), load('gadaD', A + 'gada-cut-d.webp'));
  // the cut gada's place inside its banner (source px): origin, painted ground line
  const GADA = { M: { x: 301, y: 494, ground: 1792 }, D: { x: 1380, y: 0, ground: 975 } };
  const shadows = {}, keyed = {};
  const KEY = 7;   // keyline width in source px (a 256 px sprite shows at ~80 px: about 2 px)
  function makeShadow(k) {
    // a soft painted ground shadow for each sprite (drawn off-canvas, shadow pulled back in)
    const i = img[k]; if (!i || !i.naturalWidth) return;
    const pad = 24, w = i.naturalWidth + pad * 2, h = i.naturalHeight + pad * 2;
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d');
    x.shadowColor = 'rgba(29,20,13,0.55)'; x.shadowBlur = 14; x.shadowOffsetX = w * 2;
    x.drawImage(i, pad - w * 2, pad);
    shadows[k] = c;
    // an ink keyline, like the banner lettering: it lifts the painted sprite off the busy banner
    const o = document.createElement('canvas'); o.width = i.naturalWidth + KEY * 2; o.height = i.naturalHeight + KEY * 2;
    const ox = o.getContext('2d');
    const sil = document.createElement('canvas'); sil.width = o.width; sil.height = o.height;
    const sx = sil.getContext('2d');
    sx.drawImage(i, KEY, KEY); sx.globalCompositeOperation = 'source-in'; sx.fillStyle = '#1d140d'; sx.fillRect(0, 0, sil.width, sil.height);
    for (let a = 0; a < 16; a++) ox.drawImage(sil, Math.cos(a / 16 * Math.PI * 2) * KEY, Math.sin(a / 16 * Math.PI * 2) * KEY);
    ox.drawImage(i, KEY, KEY);
    keyed[k] = o;
  }

  // ---- layout
  let W = 0, H = 0, dpr = 1, portrait = true, bandH = 60;
  const ui = {
    order: $('.order'), slots: $('.order__slots'), timer: $('.timer i'),
    pop: $('.combo'), title: $('.js-title'), edge: $('.edge'), snd: $('.tool--snd'), help: $('.tool--help'),
    pause: $('.tool--pause'), resume: $('.js-resume'), live: $('.js-live'),
    needle: $('.gauge__needle'), zone: $('.gauge__zone'), liftPips: $$('.pips__lift i'),
  };
  function measure() {
    W = game.clientWidth; H = game.clientHeight;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    portrait = H >= W * 0.9;
    bandH = W < 820 ? 58 : 64;
    const leafW = clamp(W * 0.4, 140, 230);
    const leafH = leafW * 232 / 512;
    const ob = ui.order.getBoundingClientRect();
    const fieldTop = (ob.height ? ob.bottom : 190) + 10;
    sim.setGeometry({ W, H, fieldTop, leafW, leafH, leafY: H - bandH - leafH * 0.18, item: clamp(W * 0.2, 66, 112) });
  }

  // ---- screen readers: one polite live region
  let liveT = 0;
  function say(text) {
    clearTimeout(liveT);
    ui.live.textContent = '';
    liveT = setTimeout(() => { ui.live.textContent = text; }, 40);
  }

  // ---- sound: simple WebAudio blips, off by default
  let audio = null, soundOn = false;
  function blip(type, n) {
    if (!soundOn) return;
    if (!audio) { try { audio = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; } }
    const a = audio, t0 = a.currentTime;
    const tone = (f0, f1, dur, wave, vol) => {
      const o = a.createOscillator(), g = a.createGain();
      o.type = wave; o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
      g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g).connect(a.destination); o.start(t0); o.stop(t0 + dur + 0.02);
    };
    const noise = (dur, vol, hp) => {
      const b = a.createBuffer(1, Math.floor(a.sampleRate * dur), a.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
      const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
      f.type = 'highpass'; f.frequency.value = hp; g.gain.value = vol;
      s.buffer = b; s.connect(f).connect(g).connect(a.destination); s.start(t0);
    };
    if (type === 'catch') { const f = 520 * Math.pow(1.12, (n || 1) - 1); tone(f, f * 1.5, 0.12, 'triangle', 0.18); }
    else if (type === 'dup') tone(420, 380, 0.08, 'sine', 0.08);
    else if (type === 'chilli') { noise(0.25, 0.16, 2500); tone(160, 80, 0.2, 'sine', 0.2); }
    else if (type === 'clear') [0, 1, 2].forEach(i => setTimeout(() => blip('catch', 2 + i * 2), i * 90));
    else if (type === 'lift') { tone(330, 330, 0.5, 'sine', 0.2); tone(495, 495, 0.45, 'sine', 0.12); }
    else if (type === 'miss') tone(240, 200, 0.12, 'sine', 0.08);
    else if (type === 'time') tone(180, 90, 0.3, 'square', 0.08);
  }
  ui.snd.addEventListener('click', () => {
    soundOn = !soundOn; ui.snd.setAttribute('aria-pressed', String(soundOn));
    if (soundOn) blip('catch', 1);
  });

  // ---- HUD
  function setState(s) { game.dataset.state = s; }
  function buildCard() {
    const c = CONFIG.rounds[sim.round];
    ui.slots.innerHTML = '';
    ui.order.dataset.n = c.card.length;
    ui.order.classList.toggle('untimed', !c.time);
    for (const key of c.card) {
      const li = document.createElement('li');
      li.className = 'slot'; li.dataset.key = key;
      const pic = document.createElement('span'); pic.className = 'slot__pic';
      const im = document.createElement('img'); im.src = `${A}${key}.webp`; im.alt = '';
      const tick = document.createElement('b'); tick.className = 'tick'; tick.setAttribute('aria-hidden', 'true');
      tick.innerHTML = '<svg viewBox="0 0 16 16"><path d="M3 8.5l3.2 3L13 4.5"/></svg>';
      const name = document.createElement('span'); name.className = 'slot__name'; name.textContent = dname(key);
      pic.append(im, tick); li.append(pic, name);
      ui.slots.appendChild(li);
    }
    measure();
  }
  function syncSlots(emptied) {
    const lis = ui.slots.children;
    sim.slots.forEach((s, i) => {
      const li = lis[i]; if (!li) return;
      li.classList.toggle('done', s.filled);
      li.setAttribute('aria-label', s.filled ? T('g.slotCaught', { d: dname(s.key) }, dname(s.key) + ', caught') : dname(s.key));
      if (emptied && s.key === emptied) restartAnim(li, 'emptied');
    });
  }
  function setScore() {
    for (const b of $$('.js-score')) b.textContent = num(sim.score);
    for (const b of $$('.js-best')) b.textContent = num(best);
    $('.best-line').hidden = !best;
  }
  function saveBest() {
    if (sim.score > best) { best = sim.score; try { localStorage.setItem(BEST_KEY, String(best)); } catch (e) { /* private mode */ } }
    setScore();
  }
  function restartAnim(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }
  function pop(text, x, y) {
    const el = ui.pop;
    el.textContent = text;
    el.style.left = x + 'px'; el.style.top = y + 'px';
    restartAnim(el, 'pop');
  }

  // ---- effects (canvas): sparks, tumbling dishes, flame lick, shake, edge glow
  const fx = { parts: [], tumbles: [], squash: 0, bounce: [], shake: 0, flare: 0, petals: [], burn: 0, gadaLift: 0, gv: 0 };
  const fxLog = [];          // what actually fired, for the reduced-motion test
  const vis = Math.random;   // visual-only randomness, never the game's RNG
  function sparks(x, y, n, colors, speed) {
    for (let i = 0; i < n; i++) {
      const a = vis() * Math.PI * 2, v = speed * (0.4 + vis() * 0.8);
      fx.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - speed * 0.3, life: 0.5 + vis() * 0.4, t: 0, c: colors[i % colors.length], s: 2 + vis() * 3 });
    }
  }
  function tumble(key, x, y, dir, rot) {
    fx.tumbles.push({ key, x, y, vx: dir * (120 + vis() * 120), vy: -260 - vis() * 120, rot: rot || 0, spin: dir * (5 + vis() * 4), t: 0 });
  }
  function shake(a) { if (reduced) return; fx.shake = Math.max(fx.shake, a); fxLog.push('shake'); }
  // a short warm glow around the screen edge (replaces r17's full-screen flash); at most one per second
  let lastEdge = -9;
  function edge() {
    if (reduced) return;
    const now = performance.now() / 1000;
    if (now - lastEdge < 1) return;
    lastEdge = now; fxLog.push('edge'); restartAnim(ui.edge, 'on');
  }

  const log = [];
  function handleEvents() {
    for (const e of sim.events) {
      log.push({ type: e.type, stack: sim.stack.length, open: sim.slots.filter(s => !s.filled).map(s => s.key), knocked: e.knocked || null });
      if (log.length > 400) log.shift();
      const stackTop = sim.leafY - sim.leafH * 0.4 - sim.stack.length * sim.leafH * 0.2;
      if (e.type === 'catch') {
        fx.squash = 1; fx.bounce.push({ i: sim.stack.length - 1, t: 0 });
        sparks(e.x, sim.catchY(), 18, ['#f2b83a', '#ffe08a', '#fff3c4'], 320);
        pop('+' + e.pts, sim.leafX, stackTop - 26);
        blip('catch', sim.stack.length); syncSlots(); setScore();
        if (sim.state === 'play') say(T('g.caught', { d: dname(e.key) }, dname(e.key) + ' caught'));
      } else if (e.type === 'dup') {
        // already on the leaf: a soft cream puff and a bounce, no penalty
        sparks(e.x, sim.catchY(), 10, ['#f8efd9', '#e9dcc0'], 160);
        tumble(e.key, e.x, sim.catchY(), e.x < sim.leafX ? -1 : 1, 0);
        blip('dup'); say(T('g.dup', { d: dname(e.key) }, 'Already have ' + dname(e.key)));
      } else if (e.type === 'chilli') {
        fx.squash = 0.5; fx.burn = 1; shake(6); edge();
        sparks(e.x, sim.catchY(), 16, ['#ff7a1a', '#ffb02e', '#e8361f'], 260);
        if (e.knocked) tumble(e.knocked, sim.leafX, stackTop + sim.leafH * 0.3, e.x < sim.leafX ? 1 : -1, 0);
        syncSlots(e.knocked); blip('chilli');
        say(e.knocked ? T('g.chilliKnock', { d: dname(e.knocked) }, 'Chilli! ' + dname(e.knocked) + ' knocked off') : T('g.chilli', null, 'Chilli!'));
      } else if (e.type === 'chilliGrace') {
        sparks(e.x, sim.catchY(), 8, ['#ff7a1a', '#ffb02e'], 140);
      } else if (e.type === 'timeout') {
        blip('time'); say(T('g.time', null, 'Time is up')); setTimeout(() => setState('lost'), 300);
      } else if (e.type === 'clear') {
        blip('clear'); syncSlots(); setScore();
        sparks(sim.leafX, stackTop, 40, ['#f2b83a', '#ffe08a', '#fff3c4'], 420);
        if (e.bonus) pop('+' + e.bonus, sim.leafX, stackTop - 30);
        say(T('g.cleared', null, 'Round cleared'));
      } else if (e.type === 'title') {
        const rk = e.next === 'finale' ? null : ROUND_KEYS[e.next];
        const t = e.next === 'finale' ? 'Lift the Gada.' : (rk ? T(rk, null, CONFIG.rounds[e.next].title) : CONFIG.rounds[e.next].title);
        ui.title.textContent = t; say(t);
        if (e.next === 'finale') { fx.gadaLift = 0; fx.gv = 0; }
        fx.parts = []; fx.tumbles = []; fx.shake = 0; fx.burn = 0;
        setState('title'); restartAnim($('.card--title'), 'in');
      } else if (e.type === 'round') {
        buildCard(); syncSlots(); setScore(); fx.tumbles = []; fx.parts = []; fx.bounce = []; fx.burn = 0;
        setState('play');
      } else if (e.type === 'finale') {
        fx.gadaLift = 0; fx.flare = 0; fx.petals = []; setScore(); syncFinale(); setState('finale');
      } else if (e.type === 'lift') {
        blip('lift'); syncFinale(); setScore(); say(T('g.lift', { n: e.lift }, 'Gada lifted, ' + e.lift + ' of 3'));
      } else if (e.type === 'miss') {
        blip('miss'); syncFinale(); say(T('g.missed', null, 'Missed'));
      } else if (e.type === 'won') {
        saveBest(); fx.flare = 1; blip('clear'); syncFinale();
        if (!reduced) for (let i = 0; i < 70; i++) fx.petals.push({ x: W * vis(), y: H * (0.2 + vis() * 0.6), vx: (vis() - 0.5) * 300, vy: -200 - vis() * 300, rot: vis() * 6, spin: (vis() - 0.5) * 8, t: 0, c: ['#f7a21b', '#ffcf3a', '#e8541f'][i % 3] });
        setTimeout(() => { setState('won'); restartAnim($('.card--won'), 'in'); }, 650);
        say('Challenge Accepted. Strength Proven. ' + T('g.wonScore', { s: num(sim.score) }, 'Score ' + num(sim.score)));
      }
    }
    sim.events.length = 0;
  }

  function syncFinale() {
    const f = sim.finale; if (!f) return;
    ui.liftPips.forEach((p, i) => p.classList.toggle('on', i < f.lift));
  }
  // gauge: needle 0..1 maps to 180..0 degrees; zone drawn as an arc segment
  function arcPath(a0, a1) {
    const P = a => [120 - 100 * Math.cos(a * Math.PI), 120 - 100 * Math.sin(a * Math.PI)];
    const [x0, y0] = P(a0), [x1, y1] = P(a1);
    return `M${x0.toFixed(1)} ${y0.toFixed(1)} A100 100 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
  }
  let zoneKey = '';
  function drawGauge() {
    const f = sim.finale; if (!f) return;
    ui.needle.setAttribute('transform', `rotate(${(f.needle * 180 - 90).toFixed(2)} 120 120)`);
    const k = f.zone.join();
    if (k !== zoneKey) { zoneKey = k; ui.zone.setAttribute('d', arcPath(clamp(f.zone[0] - f.zone[1] / 2, 0, 1), clamp(f.zone[0] + f.zone[1] / 2, 0, 1))); }
    ui.zone.classList.toggle('live', Math.abs(f.needle - f.zone[0]) <= f.zone[1] / 2);
  }

  // ---- drawing
  function cover(i, push, ox, oy) {
    if (!i || !i.naturalWidth) return null;
    const s = Math.max(W / i.naturalWidth, H / i.naturalHeight) * push;
    const w = i.naturalWidth * s, h = i.naturalHeight * s;
    const x = (W - w) * (ox == null ? 0.5 : ox), y = (H - h) * (oy == null ? 0 : oy);
    ctx.drawImage(i, x, y, w, h);
    return { x, y, s };
  }
  function sprite(k, x, y, size, rot, sx, sy, shadow) {
    const i = img[k]; if (!i || !i.naturalWidth) return;
    const sc = size / Math.max(i.naturalWidth, i.naturalHeight);
    const w = i.naturalWidth * sc, h = i.naturalHeight * sc;
    if (shadow && shadows[k]) {
      const sh = shadows[k], pad = 24 * sc;
      ctx.save(); ctx.translate(x + size * 0.05, y + size * 0.09); ctx.rotate(rot || 0); ctx.scale(sx || 1, sy || 1);
      ctx.globalAlpha *= 0.8;
      ctx.drawImage(sh, -w / 2 - pad, -h / 2 - pad, w + pad * 2, h + pad * 2);
      ctx.restore();
    }
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot || 0); ctx.scale(sx || 1, sy || 1);
    const kd = keyed[k];
    if (kd) { const kp = KEY * sc; ctx.drawImage(kd, -w / 2 - kp, -h / 2 - kp, w + kp * 2, h + kp * 2); }
    else ctx.drawImage(i, -w / 2, -h / 2, w, h);
    ctx.restore();
  }
  // where each caught dish sits on the leaf: hand-piled, slightly offset
  const PILE = [[0, 0, -0.04], [-0.27, 0.05, -0.12], [0.27, 0.04, 0.1], [-0.12, -0.3, 0.06], [0.15, -0.34, -0.08]];
  function drawLeaf(x, stack, burn, alpha, sq) {
    const lw = sim.leafW, lh = sim.leafH, ly = sim.leafY;
    ctx.save(); ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(12,8,5,0.45)';
    ctx.beginPath(); ctx.ellipse(x + 4, ly + lh * 0.32, lw * 0.5, lh * 0.2, 0, 0, Math.PI * 2); ctx.fill();
    const sx = 1 + 0.12 * sq, sy = 1 - 0.18 * sq;
    sprite('leaf', x, ly, lw * sx, 0, 1, sy / sx, false);
    if (stack.length) {
      const g = ctx.createRadialGradient(x, ly - lh * 0.02, 0, x, ly - lh * 0.02, lw * 0.42);
      g.addColorStop(0, 'rgba(29,20,13,0.5)'); g.addColorStop(1, 'rgba(29,20,13,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(x, ly - lh * 0.02, lw * 0.42, lh * 0.28, 0, 0, Math.PI * 2); ctx.fill();
    }
    const ds = lw * 0.44;
    stack.forEach((k, i) => {
      const p = PILE[Math.min(i, PILE.length - 1)];
      const b = fx.bounce.find(o => o.i === i);
      const bs = b ? 1 + 0.22 * Math.sin(Math.min(1, b.t / 0.28) * Math.PI) * (1 - b.t) : 1;
      sprite(k, x + p[0] * lw, ly - lh * 0.32 + p[1] * lw * 0.5 - (1 - sy) * lh * 0.3, ds * bs, p[2], 1, 1, true);
    });
    if (burn > 0.02) flames(x, ly, lw, lh, burn);
    ctx.restore();
  }
  let flameT = 0;
  function flames(x, y, lw, lh, k) {
    // a quick flame lick along the leaf's edge after a chilli
    const n = 10;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1) - 0.5;
      const fx0 = x + u * lw * 0.9;
      const ed = Math.cos(u * Math.PI) * lh * 0.32;
      const fy = y - ed * 0.2 + lh * 0.1;
      const fl = (10 + 30 * k) * (0.6 + 0.4 * Math.sin(flameT * 11 + i * 2.1)) * (1 - Math.abs(u) * 0.6);
      const fw = 6 + 6 * k;
      for (const [c, s] of [['rgba(232,54,31,0.75)', 1], ['rgba(255,140,30,0.8)', 0.7], ['rgba(255,226,120,0.85)', 0.4]]) {
        ctx.fillStyle = c; ctx.globalAlpha = Math.min(1, k * 1.4);
        ctx.beginPath();
        ctx.moveTo(fx0 - fw * s, fy);
        ctx.quadraticCurveTo(fx0 - fw * s * 0.6, fy - fl * s * 0.6, fx0 + Math.sin(flameT * 9 + i) * 3, fy - fl * s);
        ctx.quadraticCurveTo(fx0 + fw * s * 0.6, fy - fl * s * 0.6, fx0 + fw * s, fy);
        ctx.closePath(); ctx.fill();
      }
    }
    ctx.restore();
  }
  function drawBand() {
    const y = H - bandH;
    ctx.fillStyle = '#1d140d'; ctx.fillRect(-30, y, W + 60, bandH + 30);
    ctx.fillStyle = '#f2b83a'; ctx.fillRect(-30, y, W + 60, 3);
  }
  function drawArrow(x0, x1, y, alpha) {
    // the drag, drawn: a cream arrow with an ink keyline
    if (Math.abs(x1 - x0) < 4) return;
    const dir = Math.sign(x1 - x0);
    ctx.save(); ctx.globalAlpha = alpha; ctx.lineCap = 'butt'; ctx.lineJoin = 'miter';
    for (const [c, w] of [['#1d140d', 9], ['#f8efd9', 4]]) {
      ctx.strokeStyle = c; ctx.lineWidth = w;
      ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y);
      ctx.moveTo(x1 - dir * 14, y - 11); ctx.lineTo(x1, y); ctx.lineTo(x1 - dir * 14, y + 11);
      ctx.stroke();
    }
    ctx.restore();
  }
  function drawTick(x, y, s, alpha) {
    ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y);
    ctx.fillStyle = '#1d140d'; ctx.fillRect(-s / 2 + 3, -s / 2 + 3, s, s);
    ctx.fillStyle = '#f2b83a'; ctx.fillRect(-s / 2, -s / 2, s, s);
    ctx.strokeStyle = '#1d140d'; ctx.lineWidth = s * 0.14; ctx.lineJoin = 'miter';
    ctx.beginPath(); ctx.moveTo(-s * 0.3, 0); ctx.lineTo(-s * 0.08, s * 0.22); ctx.lineTo(s * 0.3, -s * 0.24); ctx.stroke();
    ctx.restore();
  }
  // round 1's lesson: the drag arrow under the leaf points at the slow sambar, pulsing gently (~1 Hz, no strobe)
  function drawTutor() {
    const it = sim.items.find(i => i.tutor && !i.done);
    if (!it) return;
    const dir = Math.sign(it.x - sim.leafX) || 1;
    const far = Math.abs(it.x - sim.leafX) > sim.catchHalf() * 0.5;
    if (!far) return;
    const a = reduced ? 0.95 : 0.6 + 0.35 * (0.5 + 0.5 * Math.sin(flameT * Math.PI * 2 * 0.9));
    // just above the leaf, from the leaf toward the falling dish
    const ay = sim.leafY - sim.leafH * 0.85;
    const x0 = sim.leafX + dir * sim.leafW * 0.15, x1 = clamp(it.x - dir * sim.item * 0.15, 20, W - 20);
    drawArrow(x0, x1, ay, a);
  }

  // the 3 s demo behind the start card: a ghost leaf slides under a sambar (gold tick), then away from a chilli
  const DEMO_LEN = 3;
  let demoT = 0;
  function drawDemo(t) {
    const cx = portrait ? W * 0.5 : W * 0.7;
    const span = Math.min(W * 0.26, 210);
    const A0 = cx - span * 0.55, B0 = cx + span * 0.35, C0 = cx - span * 0.75;
    const ease = u => u < 0 ? 0 : u > 1 ? 1 : u * u * (3 - 2 * u);
    let lx;
    if (t < 1.4) lx = lerp(A0, B0, ease((t - 0.15) / 0.8));
    else if (t < 2.5) lx = lerp(B0, C0, ease((t - 1.55) / 0.6));
    else lx = lerp(C0, A0, ease((t - 2.5) / 0.5));
    const ly = sim.leafY, lw = sim.leafW;
    const yc = ly - sim.leafH * 0.25;
    const caught = t >= 1.2;
    const stack = caught && t < 2.9 ? ['sambar'] : [];
    ctx.save(); ctx.globalAlpha = 0.85;
    if (!caught) {
      const u = clamp(t / 1.2, 0, 1);
      const x = lerp(-sim.item, B0, u), y = yc - Math.sin(u * Math.PI * 0.9) * (ly - sim.fieldTop) * 0.35 - (1 - u) * 60;
      sprite('sambar', x, y, sim.item, u * 2.5, 1, 1, true);
    }
    if (t > 1.0) {
      const u = (t - 1.0) / 1.2;
      const x = lerp(W + sim.item, B0 + lw * 0.1, Math.min(u, 1)) - Math.max(0, u - 1) * 40;
      const y = yc - Math.sin(clamp(u, 0, 1) * Math.PI * 0.85) * (ly - sim.fieldTop) * 0.3 + Math.max(0, u - 1) * 500;
      if (y < H) sprite('chilli', x, y, sim.item * 0.95, -u * 3, 1, 1, true);
    }
    ctx.restore();
    drawLeaf(lx, stack, 0, 0.85, caught && t < 1.45 ? 1 - (t - 1.2) / 0.25 : 0);
    if (caught && t < 2.2) drawTick(lx + lw * 0.42, ly - sim.leafH * 1.25, 30, Math.min(1, (t - 1.2) * 6) * 0.9);
    const moving = (t > 0.15 && t < 0.95) ? [A0, B0] : (t > 1.55 && t < 2.15) ? [B0, C0] : null;
    if (moving) {
      const ay = H - bandH * 0.5;
      drawArrow(lx - Math.sign(moving[1] - moving[0]) * lw * 0.35, lx + Math.sign(moving[1] - moving[0]) * lw * 0.45, ay, 0.95);
    }
  }

  function drawGada(dt) {
    const k = portrait ? 'M' : 'D';
    const plate = img['plate' + k], cut = img['gada' + k], gd = GADA[k];
    const push = anim && !reduced ? 1 + 0.03 * Math.min(1, sim.stateT / 20) : 1;
    const r = cover(plate, push, portrait ? 0.5 : 0.62, 0);
    if (!r || !cut || !cut.naturalWidth) return;
    const f = sim.finale || { lift: 0 };
    const target = sim.state === 'won' ? 3 : f.lift;
    // spring toward the target lift (overshoot on a hit), integrated in small steps
    for (let left = Math.min(dt, 1); left > 0; left -= 1 / 120) {
      const h = Math.min(left, 1 / 120);
      fx.gv += ((target - fx.gadaLift) * 90 - fx.gv * 11) * h;
      fx.gadaLift += fx.gv * h;
    }
    if (!anim || reduced || !isFinite(fx.gadaLift)) { fx.gadaLift = target; fx.gv = 0; }
    const sink = (cut.naturalHeight * 0.42) * (1 - fx.gadaLift / 3);
    const groundY = r.y + gd.ground * r.s;
    const gx = r.x + gd.x * r.s, gy = r.y + (gd.y + sink) * r.s;
    const cxr = gx + cut.naturalWidth * r.s / 2, cyr = r.y + (gd.y + cut.naturalHeight * 0.26) * r.s;
    // a slow shimmer over the painted rays, as on the r16 hero: faint, fading out from the gada
    const glow = 0.08 + 0.04 * fx.gadaLift + 0.22 * fx.flare;
    const R = Math.max(W, H) * 0.75;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.min(0.4, glow);
    ctx.translate(cxr, cyr); ctx.rotate((anim && !reduced ? sim.stateT * 0.08 : 0));
    const rg = ctx.createRadialGradient(0, 0, R * 0.05, 0, 0, R);
    rg.addColorStop(0, 'rgba(255,246,200,1)'); rg.addColorStop(1, 'rgba(255,246,200,0)');
    ctx.fillStyle = rg;
    for (let i = 0; i < 28; i++) {
      const a = i / 28 * Math.PI * 2;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * R, Math.sin(a) * R); ctx.lineTo(Math.cos(a + 0.07) * R, Math.sin(a + 0.07) * R); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, W, groundY); ctx.clip();
    ctx.drawImage(cut, gx, gy, cut.naturalWidth * r.s, cut.naturalHeight * r.s);
    ctx.restore();
    fx.flare = Math.max(sim.state === 'won' ? 0.6 : 0, fx.flare - dt * 0.6);
  }

  let pushT = 0;
  function render(dt) {
    flameT += dt;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#1d140d'; ctx.fillRect(0, 0, W, H);
    let sx = 0, sy = 0;
    if (fx.shake > 0.2 && !reduced) { sx = (vis() - 0.5) * fx.shake * 2; sy = (vis() - 0.5) * fx.shake * 2; }
    fx.shake *= Math.pow(0.002, dt);
    ctx.translate(sx, sy);
    const st = sim.state;
    if (st === 'finale' || st === 'won' || (st === 'title' && sim.next === 'finale')) {
      drawGada(dt);
    } else {
      // the banquet banner, pushing in slowly through a round (not under reduced motion)
      if (anim && !reduced && st === 'play') pushT = Math.min(1, sim.t / (CONFIG.rounds[sim.round].time || 30));
      if (reduced) pushT = 0;
      cover(portrait ? img.foodM : img.foodD, 1.02 + 0.06 * pushT, 0.5, portrait ? 0.62 : 0.5);
      drawBand();
      if (st === 'start') {
        drawDemo(demoT);
      } else if (st !== 'title') {
        for (const it of sim.items) if (!it.done) sprite(it.key, it.x, it.y, sim.item * (it.key === 'chilli' ? 0.95 : 1), it.rot, 1, 1, true);
        drawLeaf(sim.leafX, sim.stack, fx.burn, 1, fx.squash);
        if (st === 'play' && sim.tutor) drawTutor();
      }
    }
    for (const t of fx.tumbles) {
      t.t += dt; t.vy += 1400 * dt; t.x += t.vx * dt; t.y += t.vy * dt; t.rot += t.spin * dt;
      ctx.save(); ctx.globalAlpha = Math.max(0, 1 - t.t * 0.8);
      sprite(t.key, t.x, t.y, sim.leafW * 0.44, t.rot, 1, 1, false);
      ctx.restore();
    }
    fx.tumbles = fx.tumbles.filter(t => t.y < H + 100 && t.t < 1.6);
    for (const p of fx.parts) {
      p.t += dt; p.vy += 500 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      ctx.globalAlpha = Math.max(0, 1 - p.t / p.life); ctx.fillStyle = p.c;
      ctx.fillRect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s);
    }
    fx.parts = fx.parts.filter(p => p.t < p.life);
    for (const p of fx.petals) {
      p.t += dt; p.vy += 380 * dt; p.vx *= 0.99; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.spin * dt;
      ctx.save(); ctx.globalAlpha = Math.max(0, 1 - p.t / 3); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.c;
      ctx.beginPath(); ctx.ellipse(0, 0, 9, 4, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    fx.petals = fx.petals.filter(p => p.t < 3 && p.y < H + 40);
    ctx.globalAlpha = 1;
    fx.squash = Math.max(0, fx.squash - dt * 5);
    fx.burn = Math.max(0, fx.burn - dt * 1.25);
    for (const b of fx.bounce) b.t += dt * 2.5;
    fx.bounce = fx.bounce.filter(b => b.t < 1);
    if ((st === 'play' || st === 'clear' || st === 'lost') && sim.timeLeft != null) {
      ui.timer.style.transform = `scaleX(${(sim.timeLeft / CONFIG.rounds[sim.round].time).toFixed(4)})`;
    }
    if (st === 'finale' || st === 'won') drawGauge();
  }

  // ---- loop: fixed-step simulation, rAF-driven unless a test steps it by hand
  let manual = false, paused = false, helpMode = false, last = 0, acc = 0;
  function tick(dt) {
    acc += dt;
    while (acc >= CONFIG.step) { sim.update(CONFIG.step); acc -= CONFIG.step; if (sim.events.length) handleEvents(); }
  }
  function frame(now) {
    const dt = Math.min(0.1, (now - (last || now)) / 1000);
    last = now;
    if (!manual && !paused) {
      if (sim.state === 'start') { if (anim) demoT = (demoT + dt) % DEMO_LEN; }
      else tick(dt);
      render(dt);
    }
    requestAnimationFrame(frame);
  }

  // ---- pause: the button (top right), Esc / P, and whenever the tab is hidden
  const pausable = () => ['play', 'clear', 'title', 'finale'].includes(sim.state);
  function setPaused(on, quiet) {
    if (on && !pausable()) return;
    paused = on; last = 0;
    game.classList.toggle('is-paused', on);
    ui.pause.setAttribute('aria-pressed', String(on));
    held.clear(); sim.keyDir = 0;
    if (!quiet) say(on ? T('g.pausedSay', null, 'Paused') : T('g.resumed', null, 'Resumed'));
    if (on) ui.resume.focus({ preventScroll: true });
  }
  ui.pause.addEventListener('click', () => setPaused(!paused));
  ui.resume.addEventListener('click', () => setPaused(false));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { if (pausable() && !paused) setPaused(true, true); }
    else last = 0;
  });

  // ---- input: drag anywhere, or tap to glide the leaf there; keys ← → / A D
  function localX(e) { const r = game.getBoundingClientRect(); return e.clientX - r.left; }
  game.addEventListener('pointerdown', e => {
    if (e.target.closest('button, a') || paused) return;
    if (sim.state === 'title') { sim.skip(); handleEvents(); return; }
    if (sim.state === 'finale') { sim.tap(); handleEvents(); return; }
    if (sim.state === 'play' || sim.state === 'clear') sim.setTarget(localX(e));
  });
  game.addEventListener('pointermove', e => {
    if (paused) return;
    if ((sim.state === 'play' || sim.state === 'clear') && (e.pointerType === 'mouse' || e.buttons || e.pressure > 0)) sim.setTarget(localX(e));
  });
  const keys = { ArrowLeft: -1, KeyA: -1, ArrowRight: 1, KeyD: 1 };
  const held = new Set();
  addEventListener('keydown', e => {
    if (e.code === 'Escape' || e.code === 'KeyP') { if (paused || pausable()) { setPaused(!paused); e.preventDefault(); } return; }
    if (paused) return;
    if (keys[e.code]) { held.add(e.code); e.preventDefault(); }
    else if (e.code === 'Space' || e.code === 'Enter') {
      if (e.target.closest && e.target.closest('button, a')) return;
      if (sim.state === 'finale' && e.code === 'Space' && !e.repeat) { sim.tap(); handleEvents(); e.preventDefault(); }
      else if (sim.state === 'title') { sim.skip(); handleEvents(); e.preventDefault(); }
    }
    sim.keyDir = [...held].reduce((s, c) => s + keys[c], 0);
  });
  addEventListener('keyup', e => { held.delete(e.code); sim.keyDir = [...held].reduce((s, c) => s + keys[c], 0); });

  for (const b of $$('.js-start')) b.addEventListener('click', () => {
    if (helpMode) { helpMode = false; paused = false; last = 0; setState(sim.state === 'clear' ? 'play' : sim.state); return; }
    sim.begin(); handleEvents();
  });
  for (const b of $$('.js-retry')) b.addEventListener('click', () => { sim.retry(); handleEvents(); });
  ui.help.addEventListener('click', () => {
    demoT = anim ? 0 : 1.05;
    if (sim.state === 'play' || sim.state === 'clear') { helpMode = true; paused = true; setState('start'); drawHelp(); }
  });
  // while a round is paused for help, the demo still plays over the banner
  function drawHelp() {
    const loop = now => {
      if (!helpMode) return;
      const dt = Math.min(0.1, (now - (loop.l || now)) / 1000); loop.l = now;
      if (anim) demoT = (demoT + dt) % DEMO_LEN;
      const s = sim.state; sim.state = 'start'; render(dt); sim.state = s;
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  addEventListener('resize', () => { measure(); render(0); });

  // ---- test surface
  G.__feast = {
    get state() { return sim.state; },
    get round() { return sim.round + 1; },
    get stack() { return sim.stack.slice(); },
    get open() { return sim.slots.filter(s => !s.filled).map(s => s.key); },
    get score() { return sim.score; },
    get finale() { return JSON.parse(JSON.stringify(sim.finale)); },
    get timeLeft() { return sim.timeLeft; },
    get paused() { return paused; },
    sim, CONFIG, fxLog, reduced,
    start(r) { manual = true; sim.start(r); handleEvents(); render(0); },
    jump(r) { manual = false; sim.start(r); handleEvents(); },   // same, but keeps real-time play (recordings)
    setLeafX(x) { sim.setTarget(x); },
    step(ms) { manual = true; tick(ms / 1000); render(ms / 1000); return sim.state; },
    retry() { sim.retry(); handleEvents(); },
    tap() { const h = sim.tap(); handleEvents(); return h; },
    skip() { sim.skip(); handleEvents(); },
    pause(on) { setPaused(on); },
    snapshot: () => sim.snapshot(),
    log,
  };

  // ---- boot
  Promise.all(loads).then(() => {
    [...ALL, 'chilli', 'leaf'].forEach(makeShadow);
    measure();
    if (!anim) demoT = 1.05;   // screenshot mode: a frozen mid-demo frame (leaf moving under the sambar)
    setScore();
    render(0);
    if (document.fonts) document.fonts.ready.then(() => { measure(); render(0); });
    requestAnimationFrame(frame);
  });
  measure();
})(typeof self !== 'undefined' ? self : globalThis);
