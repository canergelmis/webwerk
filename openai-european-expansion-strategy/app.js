// Europe growth cockpit. Plain ES module, no build step.
// Data: data/markets.json (World Bank WDI + EF EPI + manual fields), data/signals.json
// (Eurostat, DSIT, Global Findex, StatCounter, App Store) and data/appstore_history.json
// (daily App Store snapshots from a scheduled job). Every value carries its source.

const $ = (id) => document.getElementById(id);

const WEIGHTS = [
  { key: "online", label: "Online population", value: 30, help: "Population × internet users %" },
  { key: "gap", label: "Adoption gap", value: 25, help: "People online not yet using generative AI (Eurostat; DSIT for the UK)" },
  { key: "wealth", label: "Purchasing power", value: 20, help: "GDP per capita, PPP" },
  { key: "payments", label: "Payment readiness", value: 15, help: "Adults with a debit card (Findex)" },
  { key: "priceLevel", label: "Price level", value: 10, help: "Revenue per subscriber after localisation" },
];

// Business track. Seats = staff in firms with 10+ employees that don't yet use generative AI.
const WEIGHTS_B2B = [
  { key: "seats", label: "Seat pool", value: 40, help: "Staff in firms (10+) not yet using generative AI (Eurostat; ONS/DBT for the UK)" },
  { key: "bgap", label: "Generative-AI gap", value: 25, help: "Firms (10+) not using AI to generate text or code" },
  { key: "latent", label: "Stated intent", value: 15, help: "Firms that considered AI but don't use it" },
  { key: "bwealth", label: "Purchasing power", value: 20, help: "GDP per capita, PPP" },
];

const FUNNEL_B2B = [
  { key: "reachB", label: "Firms reached, % of seat pool", value: 30 },
  { key: "adoptB", label: "Adopt a paid plan, % of reached", value: 15 },
  { key: "seatsB", label: "Seats bought, % of staff in adopting firms", value: 25 },
];

const SIZES = [
  { key: "small", label: "Small firms (10–49)", short: "small firms (10–49 staff)" },
  { key: "mid", label: "Mid-sized firms (50–249)", short: "mid-sized firms (50–249 staff)" },
  { key: "large", label: "Large firms (250+)", short: "large firms (250+ staff)" },
];

// Business plays: the sales motion follows the barrier firms cite most (Eurostat, 2025).
const B2B_PLAYS = {
  trust: { label: "Trust-led", barriers: ["legal", "privacy"] },
  enable: { label: "Enablement-led", barriers: ["expertise"] },
  integrate: { label: "Integration-led", barriers: ["compat", "data"] },
  selfserve: { label: "Self-serve", barriers: ["cost"] },
  open: { label: "Motion open", barriers: [] },
};
const BARRIER_SHORT = { expertise: "Expertise", legal: "Legal clarity", privacy: "Data protection", compat: "Compatibility", data: "Data quality", cost: "Cost" };
const BARRIER_LABELS = {
  expertise: "Lack of expertise", legal: "Unclear legal consequences", privacy: "Data protection and privacy",
  compat: "Incompatible with existing systems", data: "Data availability or quality", cost: "Costs seem too high",
  ethics: "Ethical considerations", not_useful: "Not useful for the business",
};
const PURPOSE_LABELS = {
  sales_marketing: "Marketing or sales", admin: "Business administration", finance: "Accounting and finance",
  rnd: "R&D and innovation", security: "IT security", production: "Production processes",
};

// Focus markets: the five largest by population.
const FOCUS_COUNT = 5;

const FUNNEL = [
  { key: "reach", label: "Use generative AI today, % of online", value: 30 },
  { key: "active", label: "Become weekly active, % of users", value: 50 },
  { key: "retained", label: "Still active at month 3, %", value: 40 },
  { key: "paid", label: "Convert to paid, % of retained", value: 5 },
];

const SCENARIOS = [
  { key: "down", label: "Downside", factor: 0.7 },
  { key: "base", label: "Base", factor: 1 },
  { key: "up", label: "Upside", factor: 1.3 },
];

// Growth levers. `reason` ties a lever group to the reason for not using generative AI it answers.
const CHECKLIST = [
  { area: "Awareness", reason: "unaware", items: ["Campaign aimed at people online who don't use AI yet", "Local creators and media showing everyday use", "Placement where non-users already are (search, telco, device setup)"] },
  { area: "Skills", reason: "no_skills", items: ["Free local-language how-to programme", "First-run onboarding with local examples", "Training through libraries, schools or employers"] },
  { area: "Relevance", reason: "no_need", items: ["Use cases built around local daily tasks", "Local services and data sources connected", "Output quality checked by native speakers"] },
  { area: "Trust", reason: "trust", items: ["Privacy and safety explained in the local language", "Regular dialogue with the data-protection regulator", "Visible local presence and spokesperson"] },
  { area: "Payments and price", reason: null, items: ["Local payment methods and wallets", "Price point set in local currency", "Student or entry tier"] },
  { area: "Partnerships", reason: null, items: ["Telco or device bundle", "Education partnership", "Public-sector or SME programme"] },
];

const REASON_LABELS = {
  no_need: "No need",
  unaware: "Did not know the tools existed",
  no_skills: "Did not know how to use them",
  trust: "Privacy, security or safety concerns",
};
// The UK (DSIT) reasons carry their own wording in signals.json; their trust and no_skills keys are
// the closest match to the Eurostat reasons, so the same lever groups answer them.
// Reasons that describe preference rather than a barrier a lever can remove.
const NOT_FIXABLE = new Set(["no_need", "prefer_without"]);

// Tile map: one square per market at an approximate (column, row) position.
const TILES = {
  NOR: [3, 0], SWE: [4, 0], FIN: [5, 0],
  IRL: [0, 1], GBR: [1, 1], DNK: [3, 1],
  NLD: [2, 2], DEU: [3, 2], POL: [4, 2],
  FRA: [1, 3], BEL: [2, 3], CZE: [3, 3],
  PRT: [0, 4], ESP: [1, 4], CHE: [2, 4], AUT: [3, 4], HUN: [4, 4], ROU: [5, 4],
  ITA: [2, 5], GRC: [4, 5],
};

const QUARTERS = [1, 2, 3, 4];

// Recommended play per market. Rules run in this order:
// 1. Localise first: English proficiency below EF's "High" band (EF EPI 2025: 550-599 High, 500-549 Moderate).
// 2. Monetise: today's use at or above the median of the 20 markets, and the full-price tier applies.
// 3. Price for reach: use at or above the median, but a discount or entry tier applies.
// 4. Activate: use below the median; the lead lever is the market's biggest fixable barrier.
const EF_HIGH = 550;
const PLAYS = {
  localise: { label: "Localise first", lever: "Relevance" },
  monetise: { label: "Monetise", lever: "Payments and price" },
  reach: { label: "Price for reach", lever: "Payments and price" },
  activate: { label: "Activate", lever: null },
};

// The plan a first-time visitor sees. null = the "Fill from ranking" starting point.
// Format: { GBR: { q: 1, lever: "Payments and price" }, ... }
const DEFAULT_PLAN = null;

const ROBUST_DRAWS = 5000;

// Your own memo per market, shown above the rule draft. Put final text here so a bare link shows it.
// Format: { DEU: "First paragraph.\n\n- A bullet\n- Another" }
const DEFAULT_NOTES = {};
const OWN_APP = "ChatGPT";

const state = {
  markets: [],
  history: [],
  weights: Object.fromEntries(WEIGHTS.map((w) => [w.key, w.value])),
  weightsB2B: Object.fromEntries(WEIGHTS_B2B.map((w) => [w.key, w.value])),
  funnelB2B: Object.fromEntries(FUNNEL_B2B.map((f) => [f.key, f.value])),
  track: "b2c",
  notes: {},
  editing: false,
  focus: [],
  funnel: Object.fromEntries(FUNNEL.map((f) => [f.key, f.value])),
  reach: {}, // per-market override of "Use generative AI today"
  selected: "GBR",
  metricBy: { b2c: "score", b2b: "score" },
  scenario: "base",
  sort: { key: "score", dir: -1 },
  plan: {},
};

const fmtInt = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 });
const fmtCompact = new Intl.NumberFormat("en-GB", { notation: "compact", maximumFractionDigits: 1 });
const fmtPct = (x, d = 1) => `${(x * 100).toFixed(d)}%`;
const pct0 = (v) => `${Math.round(v)}%`;

function money(value, currency) {
  const digits = value >= 1000 ? 0 : 2;
  try {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency, maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value);
  } catch {
    return `${value.toFixed(digits)} ${currency}`;
  }
}
const usdM = (v) => (v >= 1e9 ? `$${(v / 1e9).toFixed(2)}bn` : `$${(v / 1e6).toFixed(v >= 1e8 ? 0 : 1)}M`);

function store(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable: lasts for this visit only */ }
}
function load(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}

/* ---------- model ---------- */

function derive(m) {
  const pop = m.population.value;
  const online = pop * (m.internet_pct.value / 100);
  const priceLevel = m.ppp_factor.value / m.fx_rate.value;
  const langs = m.languages.value;
  return {
    ...m,
    online,
    priceLevel,
    english: m.ef_epi.value ?? null,
    needsLocalisation: !langs.includes("English"),
    sig: m.sig ?? {},
    // GDP per capita PPP × price level ≈ nominal USD per capita; /12 for a monthly income proxy.
    monthlyIncomeUsd: (m.gdp_pc_ppp.value * priceLevel) / 12,
  };
}

const byIso = (iso) => state.markets.find((x) => x.iso3 === iso);
const nonUsers = (m) => (m.sig.genai_any_online ? m.online * (1 - m.sig.genai_any_online.value / 100) : null);
const basePrice = () => Number($("base-price").value) || 0;
// Firms with 10+ staff that don't use any AI technology yet (Eurostat counts × Eurostat AI use).
const firmsNotUsing = (m) => (m.sig.firms_10plus && m.sig.enterprise_ai ? m.sig.firms_10plus.value * (1 - m.sig.enterprise_ai.value / 100) : null);

const b2bOf = (m) => m.sig.b2b?.value ?? null;
const seatPrice = () => Number($("seat-price")?.value) || 0;
// Generative-AI use by size class; the UK publishes only the 10+ figure, applied to every class.
const genaiFor = (m, size) => b2bOf(m)?.sizes[size]?.genai ?? b2bOf(m)?.all10.genai ?? null;
function seatsBySize(m) {
  const b = b2bOf(m);
  if (!b) return null;
  return SIZES.map((z) => {
    const x = b.sizes[z.key], g = genaiFor(m, z.key);
    return { ...z, firms: x.firms, emp: x.emp, ai: x.ai, genai: g, considered: x.considered, seats: x.emp !== null && g !== null ? x.emp * (1 - g / 100) : null };
  });
}
function seatPool(m) {
  const xs = seatsBySize(m);
  return xs && xs.every((x) => x.seats !== null) ? xs.reduce((a, x) => a + x.seats, 0) : null;
}
// The barrier that weighs most in this country's mix compared with the EU-27 mix. Lack of expertise
// is the most cited barrier almost everywhere, so the absolute top barrier doesn't tell markets apart.
const MIX_KEYS = ["expertise", "legal", "privacy", "compat", "data", "cost"];
function distinctiveBarrier(m) {
  const b = b2bOf(m)?.barriers ?? {}, eu = b2bOf(m)?.eu_barriers ?? {};
  if (!MIX_KEYS.every((k) => b[k] != null && eu[k] != null)) return null;
  const t = MIX_KEYS.reduce((a, k) => a + b[k], 0), te = MIX_KEYS.reduce((a, k) => a + eu[k], 0);
  const idx = MIX_KEYS.map((k) => ({ key: k, pct: b[k], index: (b[k] / t) / (eu[k] / te) })).sort((x, y) => y.index - x.index);
  return idx[0];
}
function topBarrier(m) {
  const b = b2bOf(m)?.barriers ?? {};
  const xs = Object.entries(b).filter(([k]) => !["ethics", "not_useful"].includes(k)).sort((a, z) => z[1] - a[1]);
  return xs.length ? { key: xs[0][0], pct: xs[0][1] } : null;
}

function sectorSeats(m) {
  const rows = m.sig.sector_seats?.value;
  if (!rows) return null;
  return rows.map((r) => ({ ...r, seats: r.emp * (1 - r.genai / 100) })).sort((a, b) => b.seats - a.seats);
}
function sectorCall(m) {
  const xs = sectorSeats(m);
  if (!xs) return null;
  const largest = xs[0];
  const ref = [...xs].sort((a, b) => b.genai - a.genai)[0];
  return { largest, ref };
}

function b2bPlayFor(m) {
  const xs = seatsBySize(m);
  if (!xs) return { key: "open", seg: null, why: `No official figures on firms' AI use for ${m.name}.` };
  const seg = [...xs].sort((a, z) => (z.seats ?? 0) - (a.seats ?? 0))[0];
  const tb = topBarrier(m), db = distinctiveBarrier(m);
  const override = b2bOf(m).play_override;
  const key = override ?? (db ? Object.keys(B2B_PLAYS).find((k) => B2B_PLAYS[k].barriers.includes(db.key)) : "open");
  const g = b2bOf(m).all10.genai;
  const segLine = `Most seats not yet using generative AI are in ${seg.short}: ${fmtCompact.format(seg.seats)} staff.`;
  const why = override
    ? `${pct0(g)} of firms with 10+ staff use large language models (ONS). ${b2bOf(m).barrier_note} ${segLine}`
    : db
    ? `${pct0(g)} of firms with 10+ staff use AI to generate text or code. The barrier cited most is "${BARRIER_LABELS[tb.key].toLowerCase()}" (${pct0(tb.pct)} of firms)${db.key !== tb.key ? `, as almost everywhere; what stands out against the EU is "${BARRIER_LABELS[db.key].toLowerCase()}" (${pct0(db.pct)}, ${db.index.toFixed(2)}× its weight in the EU mix)` : `, and it weighs more here than in the EU mix (${db.index.toFixed(2)}×)`}. ${segLine}`
    : `${pct0(g)} of firms with 10+ staff use ${b2bOf(m).survey === "ons" ? "large language models (ONS)" : "AI to generate text or code"}. Barriers are not published, so the motion is set in the deep dive. ${segLine}`;
  return { key, seg, why };
}
const b2bChip = (key) => `<span class="play b2b-${key}">${B2B_PLAYS[key].label}</span>`;

function funnelB2BFor(m, factor) {
  const pool = seatPool(m);
  if (pool === null) return { seats: 0, arrUsd: 0, steps: [] };
  let n = pool;
  const steps = [{ label: "Seat pool", n }];
  for (const f of FUNNEL_B2B) {
    const rate = Math.min(1, (state.funnelB2B[f.key] / 100) * factor);
    n *= rate;
    steps.push({ label: f.label.split(",")[0], n, rate });
  }
  return { seats: n, arrUsd: n * seatPrice() * 12, steps };
}

function normalise(values, { log = false } = {}) {
  const xs = values.map((v) => (log ? Math.log(v) : v));
  const lo = Math.min(...xs);
  const hi = Math.max(...xs);
  return xs.map((x) => (hi === lo ? 1 : (x - lo) / (hi - lo)));
}

// Normalise where data exists; markets without a value get the midpoint (0.5) so a missing
// survey neither rewards nor punishes them. The table marks those markets.
function normaliseSparse(values) {
  const known = values.filter((v) => v !== null && v !== undefined);
  const lo = Math.min(...known);
  const hi = Math.max(...known);
  return values.map((v) => (v === null || v === undefined ? 0.5 : hi === lo ? 1 : (v - lo) / (hi - lo)));
}

const logOrNull = (v) => (v === null || v === undefined || v <= 0 ? null : Math.log(v));
const weightDefs = (track = state.track) => (track === "b2b" ? WEIGHTS_B2B : WEIGHTS);
const weightsNow = (track = state.track) => (track === "b2b" ? state.weightsB2B : state.weights);

function rankColumns(track = state.track) {
  const ms = state.markets;
  if (track === "b2b") {
    return {
      seats: normaliseSparse(ms.map((m) => logOrNull(seatPool(m)))),
      bgap: normaliseSparse(ms.map((m) => (b2bOf(m)?.all10.genai != null ? 100 - b2bOf(m).all10.genai : null))),
      latent: normaliseSparse(ms.map((m) => b2bOf(m)?.all10.considered ?? null)),
      bwealth: normalise(ms.map((m) => m.gdp_pc_ppp.value), { log: true }),
    };
  }
  return {
    online: normalise(ms.map((m) => m.online), { log: true }),
    gap: normaliseSparse(ms.map((m) => (m.sig.genai_any_online ? 100 - m.sig.genai_any_online.value : null))),
    wealth: normalise(ms.map((m) => m.gdp_pc_ppp.value), { log: true }),
    payments: normaliseSparse(ms.map((m) => m.sig.debit_card?.value ?? null)),
    priceLevel: normalise(ms.map((m) => m.priceLevel)),
  };
}

function rank() {
  const ms = state.markets;
  const cols = rankColumns();
  const w = weightsNow();
  const total = Object.values(w).reduce((a, b) => a + b, 0) || 1;
  ms.forEach((m, i) => {
    m.score = (100 * Object.keys(cols).reduce((s, k) => s + w[k] * cols[k][i], 0)) / total;
  });
  const ranked = [...ms].sort((a, b) => b.score - a.score);
  ranked.forEach((m, i) => { m.pos = i + 1; });
  return ranked;
}

// Seeded so the result is the same on every visit.
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// How much the ranking depends on the weights: rank every market under many random weightings
// (uniform over all ways to split 100%), then record how often each lands in the top 5.
function robustness() {
  for (const track of ["b2c", "b2b"]) robustnessFor(track);
}
const robustOf = (m) => m.robust[state.track];

function robustnessFor(track) {
  const ms = state.markets;
  const cols = rankColumns(track);
  const keys = Object.keys(cols);
  const rnd = mulberry32(20261001);
  const top5 = new Array(ms.length).fill(0);
  const ranks = ms.map(() => []);
  for (let d = 0; d < ROBUST_DRAWS; d++) {
    const w = keys.map(() => -Math.log(1 - rnd()));
    const scores = ms.map((_, i) => keys.reduce((acc, k, j) => acc + w[j] * cols[k][i], 0));
    const order = scores.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]);
    order.forEach(([, i], r) => {
      ranks[i].push(r + 1);
      if (r < 5) top5[i]++;
    });
  }
  ms.forEach((m, i) => {
    const sorted = ranks[i].sort((a, b) => a - b);
    m.robust ??= {};
    m.robust[track] = { top5: top5[i] / ROBUST_DRAWS, median: sorted[Math.floor(sorted.length / 2)], best: sorted[0], worst: sorted.at(-1) };
  });
}

function tierFor(m) {
  const hi = Number($("cut-high").value);
  const mid = Number($("cut-mid").value);
  if (m.priceLevel >= hi) return { name: "Full price", share: 1 };
  if (m.priceLevel >= mid) return { name: "Discount tier", share: Number($("mult-mid").value) };
  return { name: "Entry tier", share: Number($("mult-low").value) };
}

function priceFor(m) {
  const base = basePrice();
  const tier = tierFor(m);
  const tierUsd = base * tier.share;
  return {
    tier,
    pppUsd: base * m.priceLevel,
    tierUsd,
    tierLocal: tierUsd * m.fx_rate.value,
    affordability: tierUsd / m.monthlyIncomeUsd,
  };
}

// "Use generative AI today" for a market: your override, else its survey figure, else the placeholder.
function reachFor(m) {
  if (state.reach[m.iso3] !== undefined) return state.reach[m.iso3];
  const v = m.sig.genai_any_online?.value;
  return v !== undefined ? Math.round(v) : FUNNEL[0].value;
}

function funnelFor(m, factor) {
  let n = m.online;
  const steps = [{ label: "Online", n }];
  for (const f of FUNNEL) {
    const r = f.key === "reach" ? reachFor(m) : state.funnel[f.key];
    const rate = Math.min(1, (r / 100) * factor);
    n *= rate;
    steps.push({ label: f.label.split(",")[0], n, rate });
  }
  return { steps, paid: n, arrUsd: n * priceFor(m).tierUsd * 12 };
}

const scenarioFactor = () => SCENARIOS.find((s) => s.key === state.scenario).factor;

function topReasonOf(m) {
  return m.sig.nonuse
    ? Object.entries(m.sig.nonuse.value).filter(([k]) => !NOT_FIXABLE.has(k)).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
    : null;
}
const barrierLever = (m) => CHECKLIST.find((g) => g.reason && g.reason === topReasonOf(m))?.area ?? CHECKLIST[0].area;
const defaultLever = (m) => PLAYS[playFor(m).key].lever ?? barrierLever(m);

function adoptionMedian() {
  const xs = state.markets.map((m) => m.sig.genai_any_online?.value).filter((v) => v !== undefined).sort((a, b) => a - b);
  const n = xs.length;
  return n % 2 ? xs[(n - 1) / 2] : (xs[n / 2 - 1] + xs[n / 2]) / 2;
}

const AGE_LABEL = { Y16_24: "16-24", Y25_34: "25-34", Y35_44: "35-44", Y45_54: "45-54", Y55_64: "55-64", Y65_74: "65-74" };
function nonUsersByAge(m) {
  const seg = m.sig.segments?.value.age, pop = m.sig.pop_age?.value;
  if (!seg || !pop) return null;
  return seg.map((v) => ({ code: v.code, label: v.label.replace("-", "–"), pct: v.pct, pop: pop[v.code], non: pop[v.code] * (1 - v.pct / 100) }));
}

function playFor(m) {
  const a = m.sig.genai_any_online?.value;
  const med = state.median;
  const lang = m.languages.value.find((l) => l !== "English") ?? m.languages.value[0];
  if (m.english !== null && m.english < EF_HIGH) {
    return { key: "localise", why: `English proficiency is in EF's moderate band (${m.english}), so product, content and support in ${lang} come first.${a !== undefined ? ` ${pct0(a)} of people online already use generative AI.` : ""}` };
  }
  if (a !== undefined && a >= med) {
    const tier = tierFor(m);
    if (tier.share === 1) {
      const habit = m.sig.paid_subs ? ` ${pct0(m.sig.paid_subs.value.video)} already pay for a video-streaming subscription.` : "";
      return { key: "monetise", why: `${pct0(a)} of people online already use generative AI (median ${pct0(med)}) and the full-price tier applies, so growth comes from turning users into subscribers.${habit}` };
    }
    return { key: "reach", why: `${pct0(a)} of people online already use generative AI (median ${pct0(med)}), but a price level of ${m.priceLevel.toFixed(2)} puts it in the ${tier.name.toLowerCase()}, so an affordable tier and local payment methods turn use into revenue.` };
  }
  const r = topReasonOf(m);
  const label = r ? (m.sig.nonuse.labels?.[r] ?? REASON_LABELS[r]).toLowerCase() : null;
  const head = a !== undefined
    ? `${pct0(a)} of people online use generative AI, below the ${pct0(med)} median, leaving ${fmtCompact.format(nonUsers(m))} who don't.`
    : `No survey of generative-AI use for ${m.name}.`;
  const ages = nonUsersByAge(m);
  // Among people of working age (25-64), where most reachable non-users sit.
  const big = ages ? ages.filter((x) => ["Y25_34", "Y35_44", "Y45_54", "Y55_64"].includes(x.code)).sort((x, y) => y.non - x.non)[0] : null;
  const who = big ? ` The largest working-age group not using it is people aged ${big.label} (${fmtCompact.format(big.non)}; ${pct0(big.pct)} use it).` : "";
  return { key: "activate", why: `${head}${r ? ` The biggest fixable barrier is "${label}" (${pct0(m.sig.nonuse.value[r])} of non-users).` : ""}${who}` };
}
const playChip = (key) => `<span class="play play-${key}">${PLAYS[key].label}</span>`;

/* ---------- App Store history ---------- */

const snapshots = () => state.history;
function rankIn(snap, iso, app) {
  return snap?.markets[iso]?.find((a) => a.app === app)?.rank ?? null;
}
function leaderIn(snap, iso) {
  return snap?.markets[iso]?.[0] ?? null; // apps are stored in chart order
}
function latestRank(iso, app = OWN_APP) { return rankIn(snapshots().at(-1), iso, app); }
// Positive = moved up the chart since the previous snapshot.
function rankDelta(iso, app = OWN_APP) {
  const s = snapshots();
  if (s.length < 2) return null;
  const a = rankIn(s.at(-2), iso, app);
  const b = rankIn(s.at(-1), iso, app);
  return a === null || b === null ? null : a - b;
}

/* ---------- metrics for the map and table ---------- */

const metricsNow = () => (state.track === "b2b" ? METRICS_B2B : METRICS);
const METRICS = {
  score: { label: "Headroom score", value: (m) => m.score, fmt: (v) => v.toFixed(0) },
  adoption: { label: "Use generative AI today, % of online", value: (m) => m.sig.genai_any_online?.value ?? null, fmt: pct0 },
  nonusers: { label: "People online not using it", value: nonUsers, fmt: (v) => fmtCompact.format(v) },
  price: { label: "Parity price, USD a month", value: (m) => basePrice() * m.priceLevel, fmt: (v) => money(v, "USD") },
  chatgpt: { label: "ChatGPT App Store rank", value: (m) => latestRank(m.iso3), fmt: (v) => `#${v}`, invert: true },
  subs: { label: "Pay for video streaming, %", value: (m) => m.sig.paid_subs?.value.video ?? null, fmt: pct0 },
  firms: { label: "Firms (10+ staff) not using AI", value: firmsNotUsing, fmt: (v) => fmtCompact.format(v) },
  skills: { label: "At least basic digital skills, %", value: (m) => m.sig.digital_skills?.value.basic_plus ?? null, fmt: pct0 },
  claude: { label: "Claude.ai use per head (Anthropic index)", value: (m) => m.sig.aei?.value.per_capita_index ?? null, fmt: (v) => `${v.toFixed(1)}×` },
  robust: { label: "Top 5 under random weights", value: (m) => robustOf(m).top5 * 100, fmt: pct0 },
  play: { label: "Recommended play", value: (m) => playFor(m).key, fmt: (k) => PLAYS[k].label, categorical: true, palette: "play", keys: Object.keys(PLAYS), chip: (k) => playChip(k),
    short: (k) => ({ localise: "Localise", monetise: "Monetise", reach: "Reach", activate: "Activate" })[k] },
};

// 0..1 intensity per market for the active metric; null where there is no value.
const METRICS_B2B = {
  score: { label: "Business headroom score", value: (m) => m.score, fmt: (v) => v.toFixed(0) },
  seats: { label: "Seats not yet using generative AI", value: seatPool, fmt: (v) => fmtCompact.format(v) },
  bgenai: { label: "Firms (10+) using AI to generate text or code, %", value: (m) => b2bOf(m)?.all10.genai ?? null, fmt: pct0 },
  latent: { label: "Firms that considered AI but don't use it, %", value: (m) => b2bOf(m)?.all10.considered ?? null, fmt: pct0 },
  robust: { label: "Top 5 under random weights", value: (m) => robustOf(m).top5 * 100, fmt: pct0 },
  play: { label: "Business play", value: (m) => b2bPlayFor(m).key, fmt: (k) => B2B_PLAYS[k].label, categorical: true, palette: "b2b", keys: Object.keys(B2B_PLAYS), chip: (k) => b2bChip(k),
    short: (k) => ({ trust: "Trust", enable: "Enable", integrate: "Integrate", selfserve: "Self-serve", open: "Open" })[k] },
};

function intensities(key) {
  const mt = metricsNow()[key];
  if (mt.categorical) return new Map(state.markets.map((m) => [m.iso3, null]));
  const vals = state.markets.map((m) => mt.value(m));
  const known = vals.filter((v) => v !== null);
  const lo = Math.min(...known), hi = Math.max(...known);
  return new Map(state.markets.map((m, i) => {
    const v = vals[i];
    if (v === null) return [m.iso3, null];
    let t = hi === lo ? 1 : (v - lo) / (hi - lo);
    if (mt.invert) t = 1 - t;
    return [m.iso3, t];
  }));
}
const heat = (t, max = 88) => `color-mix(in oklab, var(--atlas) ${Math.round(10 + t * (max - 10))}%, var(--sheet))`;

/* ---------- rendering: overview ---------- */

function renderGlobals() {
  $("metric").innerHTML = Object.entries(metricsNow()).map(([k, mt]) => `<option value="${k}">${mt.label}</option>`).join("");
  $("metric").value = state.metricBy[state.track];
  renderScenarioSeg();
  renderTrackSeg();
}
function renderTrackSeg() {
  $("track").innerHTML = [["b2c", "Consumer"], ["b2b", "Business"]].map(([k, l]) => `<button type="button" role="radio" aria-checked="${k === state.track}" data-track="${k}">${l}</button>`).join("");
}
function renderScenarioSeg() {
  $("scenario").innerHTML = SCENARIOS.map((s) => `<button type="button" role="radio" aria-checked="${s.key === state.scenario}" data-scenario="${s.key}">${s.label}</button>`).join("");
}

function renderWeights() {
  const now = weightsNow();
  $("weights").innerHTML = weightDefs().map((w) => `
    <label class="weight">
      <span class="weight-name">${w.label} <output id="w-${w.key}-out">${now[w.key]}</output></span>
      <input type="range" min="0" max="100" step="5" value="${now[w.key]}" data-weight="${w.key}" aria-describedby="w-${w.key}-help">
      <span class="weight-help" id="w-${w.key}-help">${w.help}</span>
    </label>`).join("");
}

function surveyMark(m) {
  if (state.track === "b2b") {
    if (!b2bOf(m)) return '<sup class="nosurvey" title="No official figures on firms\' AI use; business scores set to neutral">†</sup>';
    if (b2bOf(m).survey === "ons") return '<sup class="nosurvey" title="ONS and DBT figures, not Eurostat; close but not identical method">‡</sup>';
    return "";
  }
  if (!m.sig.genai_any_online) return '<sup class="nosurvey" title="No official AI-use survey; adoption gap set to neutral">†</sup>';
  if (m.sig.genai_any_online.survey === "dsit") return '<sup class="nosurvey" title="UK government survey, not Eurostat; close but not identical method">‡</sup>';
  return "";
}

function renderMap() {
  const T = 64, G = 6, W = 6 * (T + G), H = 6 * (T + G);
  const its = intensities(state.metricBy[state.track]);
  const mt = metricsNow()[state.metricBy[state.track]];
  const svg = $("map");
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.innerHTML = state.markets.map((m) => {
    const [c, r] = TILES[m.iso3];
    const x = c * (T + G), y = r * (T + G);
    const t = its.get(m.iso3);
    const v = mt.value(m);
    const dark = mt.categorical || (t !== null && t > 0.55);
    const q = state.plan[m.iso3]?.q;
    const sel = m.iso3 === state.selected;
    return `<g class="tile${sel ? " is-sel" : ""}${dark ? " on-dark" : ""}" data-iso="${m.iso3}" tabindex="0" role="button" aria-pressed="${sel}"
        aria-label="${m.name}: ${v === null ? "no data" : mt.fmt(v)}${q ? `, live in Q${q}` : ""}">
      <title>${m.name}: ${v === null ? "no data" : mt.fmt(v)}</title>
      <rect x="${x}" y="${y}" width="${T}" height="${T}" rx="4" style="fill:${mt.categorical ? `var(--${mt.palette}-${v})` : t === null ? "var(--track)" : heat(t)}"/>
      <text x="${x + 8}" y="${y + 20}" class="t-iso">${m.iso2}</text>
      <text x="${x + 8}" y="${y + T - 10}" class="t-val${mt.categorical ? " t-cat" : ""}">${v === null ? "n/a" : mt.categorical ? mt.short(v) : mt.fmt(v)}</text>
      ${q ? `<text x="${x + T - 7}" y="${y + 20}" text-anchor="end" class="t-q">Q${q}</text>` : ""}
    </g>`;
  }).join("");
  const lowLabel = mt.invert ? "lower rank" : "low";
  const highLabel = mt.invert ? "#1" : "high";
  $("map-legend").innerHTML = mt.categorical
    ? `${mt.keys.map(mt.chip).join("")}<span>Q = go-live quarter in your plan.</span>`
    : `<span>${mt.label}</span>
    <span class="ramp"><span>${lowLabel}</span><span class="ramp-bar"></span><span>${highLabel}</span></span>
    <span>Q = go-live quarter in your plan.</span>`;
}

const isFocus = (m) => state.focus.includes(m.iso3);
const focusBadge = (m) => (isFocus(m) ? ' <span class="focus-badge" title="One of the five largest markets by population">Focus</span>' : "");

const COLUMNS_B2B = [
  { key: "pos", label: "#", sort: (m) => -m.pos },
  { key: "name", label: "Market" },
  { key: "score", label: "Headroom", sort: (m) => m.score, metric: "score" },
  { key: "seats", label: "Seat pool", sort: seatPool, metric: "seats" },
  { key: "bgenai", label: "Gen AI use", sort: (m) => b2bOf(m)?.all10.genai ?? null, metric: "bgenai" },
  { key: "latent", label: "Considered", sort: (m) => b2bOf(m)?.all10.considered ?? null, metric: "latent" },
  { key: "barrier", label: "Stands out" },
  { key: "robust", label: "Top 5 in", sort: (m) => robustOf(m).top5, metric: "robust" },
  { key: "play", label: "Play" },
  { key: "plan", label: "Plan" },
];
const columnsNow = () => (state.track === "b2b" ? COLUMNS_B2B : COLUMNS);

const COLUMNS = [
  { key: "pos", label: "#", sort: (m) => -m.pos },
  { key: "name", label: "Market" },
  { key: "score", label: "Headroom", sort: (m) => m.score, metric: "score" },
  { key: "adoption", label: "Use AI today", sort: (m) => m.sig.genai_any_online?.value ?? null, metric: "adoption" },
  { key: "nonusers", label: "Online, not using", sort: nonUsers, metric: "nonusers" },
  { key: "price", label: "Price a month", sort: (m) => basePrice() * m.priceLevel, metric: "price" },
  { key: "chatgpt", label: "ChatGPT rank", sort: (m) => { const r = latestRank(m.iso3); return r === null ? null : -r; }, metric: "chatgpt" },
  { key: "robust", label: "Top 5 in", sort: (m) => robustOf(m).top5, metric: "robust" },
  { key: "play", label: "Play" },
  { key: "plan", label: "Plan" },
];

function renderTable() {
  const tbl = $("markets");
  const before = new Map([...tbl.querySelectorAll("tbody tr")].map((tr) => [tr.dataset.iso, tr.getBoundingClientRect().top]));
  const its = intensities(state.metricBy[state.track]);
  const COLS = columnsNow();
  if (!COLS.some((c) => c.key === state.sort.key && c.sort)) state.sort = { key: "score", dir: -1 };
  const col = COLS.find((c) => c.key === state.sort.key);
  const rows = [...state.markets].sort((a, b) => {
    const va = col.sort(a), vb = col.sort(b);
    if (va === null) return 1;
    if (vb === null) return -1;
    return state.sort.dir * (va - vb) || a.pos - b.pos;
  });
  const deltaHtml = (d) => (d === null ? "" : d === 0 ? '<span class="d d0">0</span>' : `<span class="d ${d > 0 ? "up" : "down"}">${d > 0 ? "+" : "−"}${Math.abs(d)}</span>`);
  tbl.innerHTML = `<thead><tr>${COLS.map((c) => {
    const sorted = c.key === state.sort.key;
    const aria = sorted ? ` aria-sort="${state.sort.dir < 0 ? "descending" : "ascending"}"` : "";
    return c.sort
      ? `<th scope="col" class="c-${c.key}"${aria}><button type="button" data-sort="${c.key}">${c.label}${sorted ? `<span class="caret">${state.sort.dir < 0 ? "▾" : "▴"}</span>` : ""}</button></th>`
      : `<th scope="col" class="c-${c.key}">${c.label}</th>`;
  }).join("")}</tr></thead>
  <tbody>${rows.map((m) => {
    const p = priceFor(m);
    const r = latestRank(m.iso3);
    const q = state.plan[m.iso3]?.q;
    const t = its.get(m.iso3);
    const tint = (k) => (COLS.find((c) => c.key === k).metric === state.metricBy[state.track] && t !== null ? ` style="background:${heat(t, 42)}"` : "");
    const nu = nonUsers(m);
    const planCell = `<td class="c-plan">${q ? `<span class="qbadge">Q${q}</span>` : '<span class="muted">—</span>'}</td>`;
    const robustCell = `<td class="num"${tint("robust")} title="Median rank ${robustOf(m).median}, range ${robustOf(m).best} to ${robustOf(m).worst} across ${fmtInt.format(ROBUST_DRAWS)} random weightings">${pct0(robustOf(m).top5 * 100)}</td>`;
    if (state.track === "b2b") {
      const b = b2bOf(m), db = distinctiveBarrier(m), pool = seatPool(m);
      return `<tr data-iso="${m.iso3}" class="${m.iso3 === state.selected ? "is-selected" : ""}" tabindex="0" aria-selected="${m.iso3 === state.selected}">
      <td class="c-pos">${m.pos}</td>
      <th scope="row" class="c-name">${m.name}${surveyMark(m)}${focusBadge(m)}</th>
      <td class="c-score"${tint("score")}><span class="score-cell"><span class="bar"><span style="width:${m.score.toFixed(1)}%"></span></span><span class="num">${m.score.toFixed(0)}</span></span></td>
      <td class="num"${tint("seats")}>${pool === null ? "n/a" : fmtCompact.format(pool)}</td>
      <td class="num"${tint("bgenai")}>${b?.all10.genai != null ? pct0(b.all10.genai) : "n/a"}</td>
      <td class="num"${tint("latent")}>${b?.all10.considered != null ? pct0(b.all10.considered) : "n/a"}</td>
      <td class="c-barrier">${db ? BARRIER_SHORT[db.key] : '<span class="muted">Not published</span>'}</td>
      ${robustCell}
      <td class="c-play">${b2bChip(b2bPlayFor(m).key)}</td>
      ${planCell}
    </tr>`;
    }
    return `<tr data-iso="${m.iso3}" class="${m.iso3 === state.selected ? "is-selected" : ""}" tabindex="0" aria-selected="${m.iso3 === state.selected}">
      <td class="c-pos">${m.pos}</td>
      <th scope="row" class="c-name">${m.name}${surveyMark(m)}${focusBadge(m)}</th>
      <td class="c-score"${tint("score")}><span class="score-cell"><span class="bar"><span style="width:${m.score.toFixed(1)}%"></span></span><span class="num">${m.score.toFixed(0)}</span></span></td>
      <td class="num"${tint("adoption")}>${m.sig.genai_any_online ? pct0(m.sig.genai_any_online.value) : "n/a"}</td>
      <td class="num"${tint("nonusers")}>${nu === null ? "n/a" : fmtCompact.format(nu)}</td>
      <td class="num"${tint("price")}>${money(p.tierLocal, m.currency.value)}</td>
      <td class="num"${tint("chatgpt")}>${r === null ? "Not in top 100" : `#${r}`} ${deltaHtml(rankDelta(m.iso3))}</td>
      <td class="num"${tint("robust")} title="Median rank ${robustOf(m).median}, range ${robustOf(m).best} to ${robustOf(m).worst} across ${fmtInt.format(ROBUST_DRAWS)} random weightings">${pct0(robustOf(m).top5 * 100)}</td>
      <td class="c-play">${playChip(playFor(m).key)}</td>
      <td class="c-plan">${q ? `<span class="qbadge">Q${q}</span>` : '<span class="muted">—</span>'}</td>
    </tr>`;
  }).join("")}</tbody>`;
  if (before.size && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    tbl.querySelectorAll("tbody tr").forEach((tr) => {
      const prev = before.get(tr.dataset.iso);
      if (prev === undefined) return;
      const dy = prev - tr.getBoundingClientRect().top;
      if (Math.abs(dy) < 1) return;
      tr.animate([{ transform: `translateY(${dy}px)` }, { transform: "translateY(0)" }], { duration: 420, easing: "cubic-bezier(.2,.7,.2,1)" });
    });
  }
}

/* ---------- rendering: plan and roll-up ---------- */

function focusPlan() {
  // The five focus markets, two per quarter in order of your current ranking.
  const plan = {};
  state.markets.filter(isFocus).sort((a, b) => a.pos - b.pos).forEach((m, i) => {
    plan[m.iso3] = { q: Math.floor(i / 2) + 1, lever: defaultLever(m) };
  });
  return plan;
}

function suggestPlan() {
  // Starting point only: top 12 by your weights, three per quarter, lead lever from the market's play.
  const plan = {};
  [...state.markets].sort((a, b) => a.pos - b.pos).slice(0, 12).forEach((m, i) => {
    plan[m.iso3] = { q: Math.floor(i / 3) + 1, lever: defaultLever(m) };
  });
  return plan;
}

function renderPlan() {
  const rows = [...state.markets].sort((a, b) => a.pos - b.pos);
  $("plan").innerHTML = `<div class="plan-row plan-headrow" aria-hidden="true"><span>Market</span><span>Go live</span><span>Lead lever</span></div>` +
    rows.map((m) => {
      const e = state.plan[m.iso3];
      const q = e?.q ?? 0;
      return `<div class="plan-row${e ? " is-planned" : ""}${m.iso3 === state.selected ? " is-selected" : ""}" data-iso="${m.iso3}">
        <span class="plan-name" id="pl-${m.iso3}"><span class="pos">${m.pos}</span>${state.track === "b2b" ? `<span class="pdot b2b-${b2bPlayFor(m).key}" title="${B2B_PLAYS[b2bPlayFor(m).key].label}"></span>` : `<span class="pdot play-${playFor(m).key}" title="${PLAYS[playFor(m).key].label}"></span>`}${m.name}${focusBadge(m)}</span>
        <span class="seg" role="radiogroup" aria-labelledby="pl-${m.iso3}">
          ${[0, ...QUARTERS].map((n) => `<button type="button" role="radio" aria-checked="${q === n}" data-plan="${m.iso3}" data-q="${n}" aria-label="${n ? `Quarter ${n}` : "Not planned"}">${n ? `Q${n}` : "—"}</button>`).join("")}
        </span>
        <select data-lever="${m.iso3}" aria-label="Lead lever for ${m.name}" ${e ? "" : "disabled"}>
          ${CHECKLIST.map((g) => `<option${(e?.lever ?? defaultLever(m)) === g.area ? " selected" : ""}>${g.area}</option>`).join("")}
        </select>
      </div>`;
    }).join("");
}

function renderRollup() {
  const sc = SCENARIOS.find((s) => s.key === state.scenario);
  const planned = state.markets.filter((m) => state.plan[m.iso3])
    .map((m) => {
      const c = funnelFor(m, sc.factor), b = funnelB2BFor(m, sc.factor);
      return { m, q: state.plan[m.iso3].q, lever: state.plan[m.iso3].lever, c, b, f: { arrUsd: c.arrUsd + b.arrUsd, paid: c.paid } };
    })
    .sort((a, b) => a.q - b.q || b.f.arrUsd - a.f.arrUsd);
  const hint = $("rollup-hint");
  hint.textContent = `${sc.label} scenario. Each market runs two funnels: consumer (its survey figure for today's use, your rates, its tier price) and business (its seat pool, your rates, your seat price). Rates are set in the market brief.`;
  if (!planned.length) {
    $("rollup-kpis").innerHTML = "";
    $("rollup-b2b").innerHTML = "";
    $("qchart").innerHTML = "";
    $("contrib").innerHTML = `<li class="empty">No markets in the plan yet. Set a go-live quarter on the left, or use "Fill from ranking".</li>`;
    return;
  }
  const sum = (xs, f) => xs.reduce((s, x) => s + f(x), 0);
  const subs = sum(planned, (p) => p.c.paid);
  const seats = sum(planned, (p) => p.b.seats);
  const arrC = sum(planned, (p) => p.c.arrUsd), arrB = sum(planned, (p) => p.b.arrUsd);
  const arr = arrC + arrB;
  $("rollup-kpis").innerHTML = `
    <div class="kpi"><span class="kpi-v">${planned.length}</span><span class="kpi-l">markets in the plan</span></div>
    <div class="kpi"><span class="kpi-v">${fmtCompact.format(subs)}</span><span class="kpi-l">consumer subscribers once all are live</span></div>
    <div class="kpi"><span class="kpi-v">${fmtCompact.format(seats)}</span><span class="kpi-l">business seats once all are live</span></div>
    <div class="kpi"><span class="kpi-v">${usdM(arr)}</span><span class="kpi-l">annual run-rate at Q4: ${arr ? pct0((100 * arrC) / arr) : "0%"} consumer, ${arr ? pct0((100 * arrB) / arr) : "0%"} business</span></div>`;
  const noB2B = planned.filter((x) => seatPool(x.m) === null).map((x) => x.m.name);
  $("rollup-b2b").innerHTML = noB2B.length ? `No business figures for ${noB2B.join(" and ")}, so business revenue there is zero.` : "";

  // Stacked bars: cumulative run-rate by quarter.
  const W = 560, H = 220, padL = 8, padR = 8, top = 26, bottom = 30;
  const bw = (W - padL - padR) / QUARTERS.length;
  const y = (v) => top + (H - top - bottom) * (1 - v / arr);
  let bars = "";
  QUARTERS.forEach((q, qi) => {
    const live = planned.filter((p) => p.q <= q);
    let acc = 0;
    const x = padL + qi * bw + bw * 0.18, w = bw * 0.64;
    live.forEach((p, i) => {
      const h = (H - top - bottom) * (p.f.arrUsd / arr);
      const sel = p.m.iso3 === state.selected;
      bars += `<rect x="${x.toFixed(1)}" y="${(y(acc) - h).toFixed(1)}" width="${w.toFixed(1)}" height="${Math.max(0, h - 1).toFixed(1)}" class="seg-bar${sel ? " sel" : ""}" style="fill:${heat(0.25 + 0.6 * ((i % 4) / 3))}"><title>${p.m.name}, live Q${p.q}: ${usdM(p.f.arrUsd)}</title></rect>`;
      acc += p.f.arrUsd;
    });
    bars += `<text x="${(x + w / 2).toFixed(1)}" y="${(y(acc) - 7).toFixed(1)}" text-anchor="middle" class="lab">${acc ? usdM(acc) : "$0"}</text>
      <text x="${(x + w / 2).toFixed(1)}" y="${H - 10}" text-anchor="middle" class="tick">Q${q}, ${live.length} live</text>`;
  });
  $("qchart").setAttribute("viewBox", `0 0 ${W} ${H}`);
  $("qchart").innerHTML = `<line x1="${padL}" x2="${W - padR}" y1="${H - bottom}" y2="${H - bottom}" class="axis"/>${bars}`;

  $("contrib").innerHTML = [...planned].sort((a, b) => b.f.arrUsd - a.f.arrUsd).map((p) => `
    <li data-iso="${p.m.iso3}" class="${p.m.iso3 === state.selected ? "is-selected" : ""}">
      <span class="qbadge">Q${p.q}</span>
      <span class="c-m">${p.m.name}</span>
      <span class="c-l">${p.lever}</span>
      <span class="c-v" title="Consumer / business run-rate">${usdM(p.c.arrUsd)} / ${usdM(p.b.arrUsd)}</span>
      <span class="c-v">${usdM(p.f.arrUsd)}</span>
      <span class="c-s">${fmtPct(p.f.arrUsd / arr, 0)}</span>
    </li>`).join("");
}

/* ---------- rendering: monitor ---------- */

function renderMonitor() {
  const s = snapshots();
  const last = s.at(-1);
  if (!last) {
    $("monitor-hint").textContent = "No App Store snapshots yet.";
    return;
  }
  const first = s[0];
  $("monitor-hint").textContent = s.length > 1
    ? `${s.length} daily snapshots from ${first.date} to ${last.date}, recorded by a scheduled job. Top 100 free iPhone apps; downloads, not usage.`
    : `History starts ${last.date}. A scheduled job adds a snapshot every day, so moves appear from the next run. Top 100 free iPhone apps; downloads, not usage.`;

  // Moves since the previous snapshot.
  const moves = [];
  if (s.length > 1) {
    const prev = s.at(-2);
    for (const m of state.markets) {
      const apps = new Set([...(prev.markets[m.iso3] ?? []), ...(last.markets[m.iso3] ?? [])].map((a) => a.app));
      for (const app of apps) {
        const a = rankIn(prev, m.iso3, app), b = rankIn(last, m.iso3, app);
        if (a === null && b !== null) moves.push({ size: 101 - b, text: `${app} entered the top 100 at #${b} in ${m.name}`, up: true });
        else if (a !== null && b === null) moves.push({ size: 101 - a, text: `${app} left the top 100 in ${m.name} (was #${a})`, up: false });
        else if (a !== null && Math.abs(a - b) >= 5) moves.push({ size: Math.abs(a - b), text: `${app} ${a > b ? "up" : "down"} ${Math.abs(a - b)} to #${b} in ${m.name}`, up: a > b });
      }
      const la = leaderIn(prev, m.iso3)?.app, lb = leaderIn(last, m.iso3)?.app;
      if (la && lb && la !== lb) moves.push({ size: 200, text: `${lb} overtook ${la} as the top assistant in ${m.name}`, up: lb === OWN_APP });
    }
    moves.sort((a, b) => b.size - a.size);
  }
  const behind = state.markets
    .map((m) => ({ m, own: rankIn(last, m.iso3, OWN_APP), lead: leaderIn(last, m.iso3) }))
    .filter((x) => x.lead && x.lead.app !== OWN_APP)
    // Largest gap first.
    .sort((a, b) => (b.own ?? 101) - b.lead.rank - ((a.own ?? 101) - a.lead.rank));
  // Ratings: total per storefront; additions since the previous snapshot that has ratings.
  const rated = s.filter((x) => x.ratings);
  const rNow = rated.at(-1), rPrev = rated.length > 1 ? rated.at(-2) : null;
  const ratingsOf = (snap, iso, app) => snap?.ratings?.[iso]?.[app]?.count ?? null;
  let ratingsHtml = "";
  if (rNow) {
    if (rPrev) {
      const days = Math.max(1, Math.round((Date.parse(rNow.date) - Date.parse(rPrev.date)) / 864e5));
      const rows = state.markets.map((m) => {
        const add = (app) => { const a = ratingsOf(rPrev, m.iso3, app), b = ratingsOf(rNow, m.iso3, app); return a === null || b === null ? null : b - a; };
        return { m, own: add(OWN_APP), gem: add("Gemini"), cla: add("Claude") };
      }).filter((x) => x.own !== null).sort((a, b) => b.own - a.own);
      ratingsHtml = `<h3>Ratings added since ${rPrev.date} (${days} day${days > 1 ? "s" : ""})</h3>
        <ul class="alert-list">${rows.slice(0, 8).map((x) => `<li class="${x.gem !== null && x.gem > x.own ? "down" : "up"}"><button type="button" data-goto="${x.m.iso3}">${x.m.name}</button>: ${OWN_APP} +${fmtInt.format(x.own)}, Gemini +${fmtInt.format(x.gem ?? 0)}, Claude +${fmtInt.format(x.cla ?? 0)}</li>`).join("")}</ul>`;
    } else {
      ratingsHtml = `<h3>Ratings</h3><p class="sub">Rating counts start ${rNow.date}; daily additions appear from the next snapshot. A growing count is a rough sign of a growing user base.</p>`;
    }
  }
  $("alerts").innerHTML = `${ratingsHtml}
    <h3>Moves since the previous snapshot</h3>
    ${s.length < 2 ? `<p class="sub">None yet: the first comparison comes with the next daily snapshot.</p>`
      : moves.length ? `<ul class="alert-list">${moves.slice(0, 8).map((x) => `<li class="${x.up ? "up" : "down"}">${x.text}</li>`).join("")}</ul>`
      : `<p class="sub">No assistant moved 5 places or more.</p>`}
    <h3>Where ${OWN_APP} is not the top assistant (${last.date})</h3>
    ${behind.length ? `<ul class="alert-list">${behind.map((x) => `<li class="down"><button type="button" data-goto="${x.m.iso3}">${x.m.name}</button>: ${x.lead.app} #${x.lead.rank}, ${OWN_APP} ${x.own === null ? "not in top 100" : `#${x.own}`}</li>`).join("")}</ul>`
      : `<p class="sub">${OWN_APP} leads the assistants in every market.</p>`}`;

  // Small multiples: rank over time for ChatGPT and the latest top rival, per market.
  const W = 132, H = 44, pad = 5;
  const days = s.map((x) => x.date);
  const xAt = (i) => (days.length < 2 ? W / 2 : pad + (i * (W - 2 * pad)) / (days.length - 1));
  const yAt = (r) => pad + (H - 2 * pad) * (Math.sqrt(r) - 1) / (Math.sqrt(100) - 1);
  const line = (iso, app, cls) => {
    const pts = s.map((snap, i) => [i, rankIn(snap, iso, app)]).filter(([, r]) => r !== null);
    if (!pts.length) return "";
    const path = pts.length > 1 ? `<polyline points="${pts.map(([i, r]) => `${xAt(i).toFixed(1)},${yAt(r).toFixed(1)}`).join(" ")}" class="${cls}"/>` : "";
    const [li, lr] = pts.at(-1);
    return `${path}<circle cx="${xAt(li).toFixed(1)}" cy="${yAt(lr).toFixed(1)}" r="3" class="${cls}"/>`;
  };
  $("multiples").innerHTML = [...state.markets].sort((a, b) => a.pos - b.pos).map((m) => {
    const rival = (last.markets[m.iso3] ?? []).find((a) => a.app !== OWN_APP);
    const own = rankIn(last, m.iso3, OWN_APP);
    return `<button type="button" class="mult${m.iso3 === state.selected ? " is-selected" : ""}" data-goto="${m.iso3}">
      <span class="mult-h"><span>${m.name}</span><span class="own">${own === null ? "out" : `#${own}`}</span></span>
      <svg viewBox="0 0 ${W} ${H}" aria-hidden="true">
        <line x1="0" x2="${W}" y1="${yAt(1)}" y2="${yAt(1)}" class="ref"/><line x1="0" x2="${W}" y1="${yAt(100)}" y2="${yAt(100)}" class="ref"/>
        ${rival ? line(m.iso3, rival.app, "rival") : ""}${line(m.iso3, OWN_APP, "ownl")}
      </svg>
      <span class="mult-f">${rival ? `${rival.app} #${rival.rank}` : "No rival in top 100"}</span>
      ${ratingsOf(rNow, m.iso3, OWN_APP) !== null ? `<span class="mult-f">${fmtCompact.format(ratingsOf(rNow, m.iso3, OWN_APP))} ratings${ratingsOf(rNow, m.iso3, "Gemini") ? `, ${(ratingsOf(rNow, m.iso3, OWN_APP) / ratingsOf(rNow, m.iso3, "Gemini")).toFixed(1)}× Gemini` : ""}</span>` : ""}
    </button>`;
  }).join("") + `<p class="sub mult-key"><span class="key own-k"></span>${OWN_APP} <span class="key rival-k"></span>highest-ranked other assistant. Top of each box is #1, bottom is #100.</p>`;
}

/* ---------- rendering: market brief ---------- */

function renderBrief() {
  const m = byIso(state.selected);
  const cur = m.currency.value;

  $("brief-title").textContent = m.name;
  const q = state.plan[m.iso3];
  $("rank-line").textContent = `Ranked ${m.pos} of ${state.markets.length} on your weights; top 5 under ${pct0(robustOf(m).top5 * 100)} of ${fmtInt.format(ROBUST_DRAWS)} random weightings. ${q ? `Live in Q${q.q}, led by ${q.lever}.` : "Not in the plan."}`;
  $("play-line").innerHTML = "";
  $("facts").innerHTML = [
    `<span><strong>${fmtCompact.format(m.population.value)}</strong> people</span>`,
    `<span><strong>${m.internet_pct.value.toFixed(0)}%</strong> online</span>`,
    `<span><strong>$${fmtInt.format(m.gdp_pc_ppp.value)}</strong> GDP per head, PPP</span>`,
    `<span><strong>${m.english ?? "Native"}</strong> EF English score</span>`,
    `<span><strong>${m.languages.value.join(", ")}</strong>${m.needsLocalisation ? ", needs full localisation" : ""}</span>`,
  ].join("");

  renderMemo(m);
  renderAdoption(m);
  renderBusiness(m);
  renderDeep(m);
  renderSegments(m);
  renderUsage(m);

  const p = priceFor(m);
  $("price-out").innerHTML = `
    <div class="kpi"><span class="kpi-v">${money(p.tierLocal, cur)}</span><span class="kpi-l">${p.tier.name}, per month in ${cur}</span></div>
    <div class="kpi"><span class="kpi-v">${money(p.tierUsd, "USD")}</span><span class="kpi-l">Same price in USD</span></div>
    <div class="kpi"><span class="kpi-v">${m.priceLevel.toFixed(2)}</span><span class="kpi-l">Price level (1.00 = US)</span></div>
    <div class="kpi"><span class="kpi-v">${fmtPct(p.affordability, 2)}</span><span class="kpi-l">Of monthly income per head</span></div>`;
  renderStrip(m);

  const results = SCENARIOS.map((s) => ({ ...s, ...funnelFor(m, s.factor) }));
  $("scenarios").innerHTML = results.map((r) => `
    <div class="scenario ${r.key === state.scenario ? "is-base" : ""}">
      <span class="sc-l">${r.label}</span>
      <span class="sc-v">${fmtCompact.format(r.paid)}</span>
      <span class="sc-s">paying subscribers</span>
      <span class="sc-v sc-v2">${usdM(r.arrUsd)}</span>
      <span class="sc-s">annual revenue</span>
    </div>`).join("");

  const base = results.find((r) => r.key === "base");
  const topN = base.steps[0].n;
  $("funnel-bars").innerHTML = base.steps.map((s) => `
    <div class="fbar">
      <span class="fbar-l">${s.label}</span>
      <span class="fbar-track"><span style="width:${Math.max(0.4, (100 * Math.sqrt(s.n / topN))).toFixed(1)}%"></span></span>
      <span class="fbar-v">${fmtCompact.format(s.n)}</span>
    </div>`).join("");
  const bres = SCENARIOS.map((sc) => ({ ...sc, ...funnelB2BFor(m, sc.factor) }));
  $("b2b-scenarios").innerHTML = seatPool(m) === null ? `<p class="nodata">No business figures for ${m.name}.</p>` : bres.map((r) => `
    <div class="scenario ${r.key === state.scenario ? "is-base" : ""}">
      <span class="sc-l">${r.label}</span>
      <span class="sc-v">${fmtCompact.format(r.seats)}</span>
      <span class="sc-s">business seats</span>
      <span class="sc-v sc-v2">${usdM(r.arrUsd)}</span>
      <span class="sc-s">annual revenue</span>
    </div>`).join("");
  const leak = base.steps.slice(1).reduce((a, b) => (b.rate < a.rate ? b : a));
  $("leak").textContent = `Largest leak at your base rates: "${leak.label}" keeps ${fmtPct(leak.rate, 0)}. Bars use a square-root scale so small stages stay visible.`;

  renderReadiness(m);
}

function renderAdoption(m) {
  const s = m.sig;
  const parts = [];
  if (s.genai_any?.survey === "dsit") {
    parts.push(`<div class="kpis">
      <div class="kpi"><span class="kpi-v">${pct0(s.genai_any.value)}</span><span class="kpi-l">of adults aged 16+ used generative AI in the last 3 months</span></div>
      <div class="kpi"><span class="kpi-v">${fmtCompact.format(nonUsers(m))}</span><span class="kpi-l">people online who did not</span></div>
      <div class="kpi"><span class="kpi-v">${pct0(s.genai_users_personal.value)}</span><span class="kpi-l">of users used it for personal reasons</span></div>
      <div class="kpi"><span class="kpi-v">${pct0(s.genai_users_work.value)}</span><span class="kpi-l">of users used it for work</span></div>
    </div>
    <p class="sub">Source: DSIT Public Engagement Survey 2025/26, the UK government's survey, since Eurostat no longer covers the UK. Same 3-month window as Eurostat but adults 16+ rather than 16–74, so read it as close, not identical.</p>`);
  } else if (s.genai_any) {
    parts.push(`<div class="kpis">
      <div class="kpi"><span class="kpi-v">${pct0(s.genai_any.value)}</span><span class="kpi-l">of people aged 16–74 used generative AI in the last 3 months</span></div>
      <div class="kpi"><span class="kpi-v">${fmtCompact.format(nonUsers(m))}</span><span class="kpi-l">people online who did not</span></div>
      <div class="kpi"><span class="kpi-v">${pct0(s.genai_16_24.value)} / ${pct0(s.genai_55_74.value)}</span><span class="kpi-l">use among ages 16–24 / 55–74</span></div>
      <div class="kpi"><span class="kpi-v">${pct0(s.genai_work.value)}</span><span class="kpi-l">used it for work (${pct0(s.genai_private.value)} private, ${pct0(s.genai_education.value)} education)</span></div>
    </div>`);
  } else {
    parts.push(`<p class="nodata">No official survey of generative-AI use for ${m.name}. The adoption gap is set to neutral in the ranking.</p>`);
  }
  if (s.nonuse) {
    const r = Object.entries(s.nonuse.value).sort((a, b) => b[1] - a[1]);
    parts.push(`<h4>Why people here don't use it</h4>
      <p class="sub">Share of non-users giving each reason; people could give more than one.${s.nonuse.survey === "dsit" ? " The four most common reasons in the DSIT survey." : ""}</p>
      <div class="bars">${r.map(([k, v]) => `
        <div class="fbar"><span class="fbar-l">${s.nonuse.labels?.[k] ?? REASON_LABELS[k]}</span>
        <span class="fbar-track"><span style="width:${v.toFixed(1)}%"></span></span>
        <span class="fbar-v">${pct0(v)}</span></div>`).join("")}</div>`);
  }
  const ctx = [];
  if (s.enterprise_ai) ctx.push(`<span><strong>${pct0(s.enterprise_ai.value)}</strong> of firms with 10+ staff use AI${firmsNotUsing(m) !== null ? `, leaving <strong>${fmtCompact.format(firmsNotUsing(m))}</strong> firms that don't (${s.firms_10plus.year} count)` : ""}</span>`);
  if (s.debit_card) ctx.push(`<span><strong>${pct0(s.debit_card.value)}</strong> of adults have a debit card (${s.debit_card.year})</span>`);
  if (s.mobile_share) ctx.push(`<span><strong>${pct0(s.mobile_share.value)}</strong> of web traffic is mobile</span>`);
  if (s.ios_share) ctx.push(`<span><strong>${pct0(s.ios_share.value)}</strong> of mobile traffic is iOS</span>`);
  if (ctx.length) parts.push(`<p class="facts ctx">${ctx.join("")}</p>`);
  if (s.paid_subs) {
    const v = s.paid_subs.value;
    const rows = [["Films, series or sport streaming", v.video], ["Music streaming", v.music], ["News sites or e-papers", v.news], ["Other apps", v.apps]];
    parts.push(`<h4>Already paying for digital subscriptions</h4>
      <p class="sub">Share of people aged 16–74 with a paid subscription in the last 3 months, ${s.paid_subs.year}. The habit an AI subscription has to join.</p>
      <div class="bars">${rows.map(([l, x]) => `
        <div class="fbar"><span class="fbar-l">${l}</span>
        <span class="fbar-track"><span style="width:${x.toFixed(1)}%"></span></span>
        <span class="fbar-v">${pct0(x)}</span></div>`).join("")}</div>`);
  } else {
    parts.push(`<h4>Already paying for digital subscriptions</h4><p class="sub">No comparable official figure for ${m.name}; Eurostat's survey does not cover it.</p>`);
  }
  const apps = snapshots().at(-1)?.markets[m.iso3];
  if (apps) {
    parts.push(`<h4>AI assistants in the App Store top 100 free apps, ${snapshots().at(-1).date}</h4>
      ${apps.length ? `<ol class="chart">${apps.map((a) => `<li><span class="rk">#${a.rank}</span> ${a.app}</li>`).join("")}</ol>` : `<p class="sub">None in the top 100 that day.</p>`}
      <p class="sub">iPhone downloads, not usage. Android charts have no public feed. The monitor above tracks this daily.</p>`);
  }
  $("adoption").innerHTML = parts.join("");
}

const bar = (label, pct, extra = "") => `
  <div class="fbar"><span class="fbar-l">${label}</span>
  <span class="fbar-track"><span style="width:${Math.min(100, pct).toFixed(1)}%"></span></span>
  <span class="fbar-v">${pct0(pct)}${extra}</span></div>`;

function renderBusiness(m) {
  const xs = seatsBySize(m), b = b2bOf(m);
  const parts = [];
  if (!xs) {
    $("business").innerHTML = `<p class="nodata">No official figures on firms' AI use for ${m.name}.</p>`;
    return;
  }
  const play = b2bPlayFor(m);
  parts.push(`<p class="lead-line">${b2bChip(play.key)} ${play.why}</p>`);
  parts.push(`<div class="table-wrap"><table class="sizes">
    <thead><tr><th scope="col">Firm size</th><th scope="col" class="num">Firms</th><th scope="col" class="num">Staff</th><th scope="col" class="num">Use any AI</th><th scope="col" class="num">Generate text or code</th><th scope="col" class="num">Considered, not using</th><th scope="col" class="num">Seats not using gen AI</th></tr></thead>
    <tbody>${xs.map((x) => `<tr${play.seg && play.seg.key === x.key ? ' class="is-focus"' : ""}><th scope="row">${x.label}</th>
      <td class="num">${x.firms != null ? fmtCompact.format(x.firms) : "n/a"}</td><td class="num">${x.emp != null ? fmtCompact.format(x.emp) : "n/a"}</td>
      <td class="num">${x.ai != null ? pct0(x.ai) : "n/a"}</td><td class="num">${b.sizes[x.key].genai != null ? pct0(b.sizes[x.key].genai) : b.all10.genai != null ? `${pct0(b.all10.genai)}*` : "n/a"}</td>
      <td class="num">${x.considered != null ? pct0(x.considered) : "n/a"}</td><td class="num"><strong>${x.seats != null ? fmtCompact.format(x.seats) : "n/a"}</strong></td></tr>`).join("")}</tbody>
  </table></div>
  <p class="sub">${b.survey === "ons" ? "* The UK publishes generative-AI use (large language models) only for all firms with 10+ employees; it is applied to each size. " : ""}Seats = staff in the size class × share of firms not using generative AI, assuming staff are spread evenly across firms. ${m.sig.b2b.note ?? ""}</p>`);
  const bars = (obj, labels, title, sub) => {
    const e = Object.entries(obj).sort((a, z) => z[1] - a[1]);
    return e.length ? `<div><h4>${title}</h4><p class="sub">${sub}</p><div class="bars">${e.map(([k, v]) => bar(labels[k], v)).join("")}</div></div>` : "";
  };
  const bh = bars(b.barriers, BARRIER_LABELS, "Why firms don't use AI", "% of all firms (10+) citing each reason; firms could give several.");
  const ph = bars(b.purposes, PURPOSE_LABELS, "What firms use AI for", "% of all firms (10+) using AI for each purpose.");
  if (bh || ph) parts.push(`<div class="seg-grid two">${bh}${ph}</div>`);
  if (b.facts?.length) parts.push(`<h4>What else ONS reports</h4><ul class="oai">${b.facts.map((f) => `<li>${f}</li>`).join("")}</ul>`);
  const o = m.sig.openai_business?.value;
  if (o) {
    parts.push(`<h4>From OpenAI's own report</h4><ul class="oai">${o.facts.map((f) => `<li>${f}</li>`).join("")}<li>Paying business customers grew ${o.growth}% from November 2024 to November 2025 (global average ${o.global_growth}%).</li></ul>
      <p class="sub">${m.sig.openai_business.source}.</p>`);
  }
  $("business").innerHTML = parts.join("");
}

// The strategy memo: a first draft from rules on the data above. Hypotheses to test, not conclusions.
function memoFor(m) {
  const c = playFor(m), b = b2bPlayFor(m);
  const lang = m.languages.value.find((l) => l !== "English") ?? "English";
  const a = m.sig.genai_any_online?.value;
  const ages = nonUsersByAge(m);
  const bigAge = ages ? ages.filter((x) => ["Y25_34", "Y35_44", "Y45_54", "Y55_64"].includes(x.code)).sort((x, y) => y.non - x.non)[0] : null;
  const bg = b2bOf(m)?.all10.genai;
  const pool = seatPool(m);
  const purposes = Object.entries(b2bOf(m)?.purposes ?? {}).sort((x, y) => y[1] - x[1]).slice(0, 2).map(([k]) => PURPOSE_LABELS[k].toLowerCase());
  const rival = (snapshots().at(-1)?.markets[m.iso3] ?? []).find((x) => x.app !== OWN_APP);

  let call;
  if (c.key === "localise") call = `Localise first, then lead with work. English proficiency is moderate, so product, support and sales in ${lang} come before scale${bg != null ? `; once they are in place, the larger gap is at work, where ${pct0(bg)} of firms use generative AI` : ""}.`;
  else if (c.key === "monetise") call = `Monetise consumers and use them as the way into teams. ${a != null ? `${pct0(a)} of people online already use generative AI` : "Use is high"} and the full-price tier applies${pool ? `, while ${fmtCompact.format(pool)} staff in firms not yet using generative AI are the next market` : ""}.`;
  else if (c.key === "reach") call = `Price for reach on consumer and grow teams through self-serve. Use is above the median but the price level is low, so revenue depends on an affordable tier.`;
  else call = `Lead with work. Consumer use is below the median and non-users mostly see no need${bg != null ? `, while only ${pct0(bg)} of firms use generative AI and the barriers they cite are ones a vendor can address` : ""}.`;

  const bizHow = {
    trust: `Sell trust: a legal and data-protection pack in ${lang} (contract terms, data handling, a template impact assessment) for ${b.seg?.short ?? "larger firms"}.`,
    enable: `Sell enablement: local IT partners and ready-made use cases${purposes.length ? ` for ${purposes.join(" and ")}, the most common uses` : ""}, aimed at ${b.seg?.short ?? "mid-sized firms"}.`,
    integrate: `Sell integration: connectors to the systems ${b.seg?.short ?? "firms"} already run, through partners and the API.`,
    selfserve: (() => {
      const xs = seatsBySize(m) ?? [];
      const smb = xs.filter((z) => z.key !== "large").reduce((t, z) => t + (z.seats ?? 0), 0);
      const large = xs.find((z) => z.key === "large")?.seats;
      return `Sell self-serve: a team plan with a low entry price and onboarding in ${lang}, for small and mid-sized firms (${fmtCompact.format(smb)} seats)${large ? `. Large firms, with ${fmtCompact.format(large)} seats, still need direct sales` : ""}.`;
    })(),
    open: `Set the motion after the deep dive: barrier data is not published here.`,
  }[b.key];
  const conHow = {
    localise: `Ship ${lang} onboarding, support and examples before spending on reach.`,
    monetise: `Grow paid conversion: annual and family plans, and the work-to-home path for people who already use it at work.`,
    reach: `An entry tier at the local parity price and local payment methods.`,
    activate: `Make it relevant to everyday tasks${bigAge ? ` for people aged ${bigAge.label}, the largest working-age group not using it (${fmtCompact.format(bigAge.non)})` : ""}.`,
  }[c.key];
  const sc = sectorCall(m);
  const sectorLine = sc ? ` Start with ${sc.largest.label.toLowerCase()}, the largest pool (${fmtCompact.format(sc.largest.seats)} staff; ${pct0(sc.largest.genai)} of its firms use generative AI), and use ${sc.ref.label.toLowerCase()} (${pct0(sc.ref.genai)}) for reference customers.` : "";
  const tests = [
    { trust: `Pilot the legal and data-protection pack with large firms. Watch: share that pass review, time to signature.`,
      enable: `Pilot two IT partners for ${b.seg?.short ?? "mid-sized firms"}. Watch: activated seats per partner, seats still active at day 60.`,
      integrate: `Pilot two connectors with partners. Watch: firms connected, seats per connected firm.`,
      selfserve: `Test a lower-priced self-serve team plan. Watch: sign-up to paid conversion.`,
      open: `Interview 20 firms per size class to find the main barrier. Watch: the barrier mix by size.` }[b.key],
    { localise: `Release ${lang} onboarding to new users. Watch: week-1 retention against today.`,
      monetise: `Test annual against monthly plans in ${m.currency.value}. Watch: free-to-paid conversion, churn at month 3.`,
      reach: `Test an entry tier at the parity price. Watch: conversion and revenue per user.`,
      activate: `Run an everyday-use campaign${bigAge ? ` for ages ${bigAge.label}` : ""}. Watch: reach in that group, first-week activation.` }[c.key],
    `Track App Store rank and rating growth${rival ? ` against ${rival.app}, the top rival here (#${rival.rank})` : ""} each week.`,
  ];
  const gaps = [];
  if (!m.sig.segments) gaps.push("who the non-users are: no breakdown by group is published here");
  if (!distinctiveBarrier(m)) gaps.push("why firms don't use AI: not published here");
  if (!m.sig.regions_b2b && !m.sig.region_note) gaps.push("use by region: not published here, so it needs the national statistics office");
  gaps.push("sector by firm size: Eurostat publishes each separately, not combined");
  gaps.push("the partner landscape: IT service providers, telcos and resellers");
  gaps.push("OpenAI's own funnel: active users, conversion and seats by segment");
  return { call, bizHow: bizHow + sectorLine, conHow, tests, gaps, b, c };
}

const escapeHtml = (t) => t.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
// Plain text to HTML: blank lines split paragraphs, lines starting with "- " become bullets.
function noteHtml(text) {
  return text.trim().split(/\n\s*\n/).map((block) => {
    const lines = block.split("\n");
    if (lines.every((l) => l.trim().startsWith("- "))) return `<ul>${lines.map((l) => `<li>${escapeHtml(l.trim().slice(2))}</li>`).join("")}</ul>`;
    return `<p>${lines.map(escapeHtml).join("<br>")}</p>`;
  }).join("");
}

function renderMemo(m) {
  const x = memoFor(m);
  const note = state.notes[m.iso3];
  const editor = state.editing
    ? `<div class="note-edit"><label class="field" for="note-text">Your memo for ${m.name}. Blank lines split paragraphs; start a line with "- " for a bullet.</label>
        <textarea id="note-text" rows="10">${escapeHtml(note ?? "")}</textarea>
        <div class="plan-tools"><button type="button" class="btn" id="note-save">Save memo</button><button type="button" class="btn" id="note-cancel">Cancel</button>${note ? '<button type="button" class="btn" id="note-delete">Delete memo</button>' : ""}</div>
        <p class="sub">Saved in this browser and in the link from "Copy link to this view".</p></div>`
    : `<div class="plan-tools"><button type="button" class="btn" id="note-edit">${note ? "Edit your memo" : "Write your memo"}</button></div>`;
  const draft = `
    <p class="memo-tag">${isFocus(m) ? '<span class="focus-badge">Focus market</span> ' : ""}Draft from rules on the public data below. Hypotheses to test, not conclusions.</p>
    <p class="memo-call">${x.call}</p>
    <div class="memo-grid">
      <div><h4>Business ${b2bChip(x.b.key)}</h4><p>${x.b.why}</p>${b2bOf(m)?.facts?.length ? `<p>${b2bOf(m).facts[0]}</p>` : ""}<p><strong>How to win:</strong> ${x.bizHow}</p></div>
      <div><h4>Consumer ${playChip(x.c.key)}</h4><p>${x.c.why}</p><p><strong>How to win:</strong> ${x.conHow}</p></div>
    </div>
    <h4>First 90 days</h4>
    <ol class="memo-tests">${x.tests.map((t) => `<li>${t}</li>`).join("")}</ol>
    <p class="sub">Targets for each test are yours to set.</p>
    <h4>The deep dive needs</h4>
    <ul class="memo-gaps">${x.gaps.map((g) => `<li>${g.charAt(0).toUpperCase() + g.slice(1)}.</li>`).join("")}</ul>`;
  $("memo").innerHTML = note && !state.editing
    ? `<div class="note"><p class="memo-tag">${isFocus(m) ? '<span class="focus-badge">Focus market</span> ' : ""}Your memo</p>${noteHtml(note)}</div>${editor}
       <details class="rule-draft"><summary>Rule draft from the data</summary>${draft}</details>`
    : `${editor}${draft}`;
}

function renderDeep(m) {
  if (!isFocus(m)) {
    $("deep").innerHTML = `<p class="nodata">The deep dive is built for the five focus markets. ${m.name} is not one of them.</p>`;
    return;
  }
  const parts = [];
  const tr = m.sig.b2b_trend;
  if (tr) {
    const ser = Object.entries(tr.value.series);
    const max = Math.max(...ser.map(([, v]) => v), ...Object.values(tr.value.eu ?? {}), 1);
    const kind = tr.value.kind === "any AI" ? "using at least one AI technology (ONS)" : "using AI to generate text or code";
    const first = ser[0], last = ser.at(-1);
    parts.push(`<h4>How fast firms are moving</h4>
      <p class="lead-line">Firms with 10+ staff ${kind}: ${pct0(first[1])} in ${first[0]}, ${pct0(last[1])} in ${last[0]}, ${(last[1] / first[1]).toFixed(1)}× in ${ser.length - 1 === 2 ? "two years" : "under three years"}.${tr.value.eu?.["2025"] ? ` EU-27 in 2025: ${pct0(tr.value.eu["2025"])}.` : ""}</p>
      <div class="bars">${ser.map(([y, v]) => `<div class="fbar"><span class="fbar-l">${y}</span><span class="fbar-track"><span style="width:${((100 * v) / max).toFixed(1)}%"></span></span><span class="fbar-v">${v.toFixed(1)}%</span></div>`).join("")}</div>`);
  }
  const xs = sectorSeats(m);
  if (xs) {
    const sc = sectorCall(m);
    parts.push(`<h4>Which sectors first</h4>
      <p class="lead-line">Largest pool: <strong>${sc.largest.label.toLowerCase()}</strong>, ${fmtCompact.format(sc.largest.seats)} staff in firms not yet using generative AI. Highest use, for reference customers: <strong>${sc.ref.label.toLowerCase()}</strong> (${pct0(sc.ref.genai)}).</p>
      <div class="table-wrap"><table class="sizes"><thead><tr><th scope="col">Sector</th><th scope="col" class="num">Staff</th><th scope="col" class="num">Firms using gen AI</th><th scope="col" class="num">Seats not using gen AI</th></tr></thead>
      <tbody>${xs.map((r) => `<tr${r.code === sc.largest.code ? ' class="is-focus"' : ""}><th scope="row">${r.label}</th><td class="num">${fmtCompact.format(r.emp)}</td><td class="num">${pct0(r.genai)}</td><td class="num"><strong>${fmtCompact.format(r.seats)}</strong></td></tr>`).join("")}</tbody></table></div>
      <p class="sub">${m.sig.sector_seats.note}</p>`);
  } else if (m.sig.sector_ai_uk) {
    const u = m.sig.sector_ai_uk.value;
    parts.push(`<h4>Which sectors first</h4>
      <p class="lead-line">Highest use: <strong>${u[0].label.toLowerCase()}</strong> (${pct0(u[0].pct)}); lowest: <strong>${u.at(-1).label.toLowerCase()}</strong> (${pct0(u.at(-1).pct)}). ONS does not publish staff by sector alongside, so seat pools per sector need the deep dive.</p>
      <div class="bars">${u.map((r) => bar(r.label, r.pct)).join("")}</div>
      <p class="sub">${m.sig.sector_ai_uk.source}, ${m.sig.sector_ai_uk.year}.</p>`);
  }
  const rg = m.sig.regions_b2b?.value;
  if (rg) {
    parts.push(`<h4>Where to start, by region</h4>
      <p class="lead-line">Firms using generative AI range from ${pct0(rg.at(-1).genai)} in ${rg.at(-1).name} to ${pct0(rg[0].genai)} in ${rg[0].name}.</p>
      <div class="bars">${rg.map((r) => bar(r.name, r.genai)).join("")}</div>`);
  } else if (m.sig.region_note) {
    parts.push(`<h4>Where to start, by region</h4><p class="lead-line">${m.sig.region_note.value} <span class="muted">(${m.sig.region_note.source})</span></p>`);
  } else {
    parts.push(`<h4>Where to start, by region</h4><p class="nodata">Eurostat does not publish firms' AI use by region for ${m.name}. The national statistics office is the next source.</p>`);
  }
  $("deep").innerHTML = parts.join("");
}

function renderSegments(m) {
  const s = m.sig;
  const parts = [];
  const ages = nonUsersByAge(m);
  if (s.segments) {
    const groups = s.segments.value;
    // Widest gap between groups. Age is shown separately, and work status mostly mirrors age
    // (students against retired people), so neither counts here.
    const spreads = ["education", "place", "work", "sex"].filter((g) => groups[g]).map((g) => {
      const xs = [...groups[g]].sort((a, b) => a.pct - b.pct);
      return { g, lo: xs[0], hi: xs.at(-1), d: xs.at(-1).pct - xs[0].pct };
    }).sort((a, b) => b.d - a.d);
    const big = ages ? [...ages].sort((a, b) => b.non - a.non)[0] : null;
    const w = spreads[0];
    parts.push(`<p class="lead-line">${big ? `Most people not using it are aged ${big.label}: <strong>${fmtCompact.format(big.non)}</strong>, of whom ${pct0(big.pct)} use it. ` : ""}${w ? `Beyond age, the widest gap is by ${GROUP_NAMES[w.g].toLowerCase()}: ${pct0(w.lo.pct)} (${w.lo.label.toLowerCase()}) against ${pct0(w.hi.pct)} (${w.hi.label.toLowerCase()}).` : ""}</p>`);
    if (ages) {
      parts.push(`<h4>By age</h4><p class="sub">Share who used generative AI in the last 3 months, and how many people in the band did not (population on 1 January 2025, online or not).</p>
        <div class="bars bars-age">${ages.map((x) => bar(x.label, x.pct, `<span class="non">${fmtCompact.format(x.non)} not</span>`)).join("")}</div>`);
    }
    parts.push(`<div class="seg-grid">${["status", "education", "place", "work", "sex"].filter((g) => groups[g]).map((g) => `
      <div><h4>${GROUP_NAMES[g]}</h4><div class="bars">${groups[g].map((v) => bar(v.label, v.pct)).join("")}</div></div>`).join("")}</div>`);
  } else if (s.age_note) {
    parts.push(`<p class="nodata">Eurostat does not cover the UK. DSIT reports: ${s.age_note.value}</p>`);
  } else {
    parts.push(`<p class="nodata">No breakdown by population group for ${m.name}.</p>`);
  }
  const extra = [];
  if (s.digital_skills) extra.push(`<span><strong>${pct0(s.digital_skills.value.basic_plus)}</strong> have at least basic digital skills (${pct0(s.digital_skills.value.above_basic)} above basic), ${s.digital_skills.year}</span>`);
  if (s.students) {
    const stud = s.segments?.value.status?.find((v) => v.code === "STUD");
    extra.push(`<span><strong>${fmtCompact.format(s.students.value)}</strong> students in higher education (${s.students.year})${stud ? `; ${pct0(stud.pct)} of students aged 16+ use generative AI` : ""}</span>`);
  }
  if (extra.length) parts.push(`<p class="facts ctx">${extra.join("")}</p>`);
  $("segments").innerHTML = parts.join("");
}

const GROUP_NAMES = { status: "Work status", education: "Education", place: "Where people live", work: "Type of job", sex: "Sex" };

function renderUsage(m) {
  const s = m.sig;
  const parts = [];
  if (s.sector_ai) {
    const xs = [...s.sector_ai.value].sort((a, b) => b.pct - a.pct);
    parts.push(`<h4>Firms using AI, by sector</h4><p class="sub">Share of firms with 10+ staff using at least one AI technology, ${s.sector_ai.year}. All sectors: ${s.enterprise_ai ? pct0(s.enterprise_ai.value) : "n/a"}.</p>
      <div class="bars">${xs.map((v) => bar(v.label, v.pct)).join("")}</div>`);
  } else {
    parts.push(`<p class="nodata">No Eurostat figures on firms' AI use by sector for ${m.name}.</p>`);
  }
  if (s.aei) {
    const a = s.aei.value, g = a.global;
    const vsG = (y) => (y ? ` <span class="muted">(global ${pct0(y)})</span>` : "");
    parts.push(`<h4>What Claude.ai users here ask for</h4>
      <p class="sub">Anthropic Economic Index, ${new Date(`${s.aei.year.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" })}. One assistant's users, not the whole market; it is the only public source of what people ask AI assistants for, by country.</p>
      <p class="facts ctx">
        ${a.per_capita_index !== null ? `<span><strong>${a.per_capita_index.toFixed(1)}×</strong> usage per head against working-age population share (1.0 = proportional)</span>` : ""}
        <span><strong>${pct0(a.use_case.work)}</strong> work${vsG(g.use_case.work)}, <strong>${pct0(a.use_case.personal)}</strong> personal${vsG(g.use_case.personal)}, <strong>${pct0(a.use_case.coursework)}</strong> coursework${vsG(g.use_case.coursework)}</span>
        ${a.translation_pct !== null ? `<span><strong>${a.translation_pct.toFixed(1)}%</strong> of conversations produce a translation${g.translation_pct ? ` <span class="muted">(global ${g.translation_pct.toFixed(1)}%)</span>` : ""}</span>` : ""}
      </p>
      <div class="bars">${a.topics.map((t) => bar(t.topic, t.pct, t.global_pct ? `<span class="non">global ${pct0(t.global_pct)}</span>` : "")).join("")}</div>`);
  }
  $("usage").innerHTML = parts.join("");
}

function renderStrip(sel) {
  const svg = $("strip");
  const W = 640, H = 104, padL = 12, padR = 12, y = 52;
  const base = basePrice() || 1;
  const ps = state.markets.map((m) => ({ m, v: base * m.priceLevel }));
  const max = Math.max(base * 1.2, ...ps.map((x) => x.v));
  const x = (v) => padL + (v / max) * (W - padL - padR);
  const hi = Number($("cut-high").value) * base;
  const mid = Number($("cut-mid").value) * base;
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  const bands = [
    { a: 0, b: mid, label: "Entry tier", cls: "band b1" },
    { a: mid, b: hi, label: "Discount tier", cls: "band b2" },
    { a: hi, b: max, label: "Full price", cls: "band b3" },
  ].map((t) => `<rect x="${x(t.a).toFixed(1)}" y="${y - 22}" width="${Math.max(0, x(t.b) - x(t.a)).toFixed(1)}" height="44" class="${t.cls}"/>
    <text x="${(x(t.a) + 4).toFixed(1)}" y="${y - 26}" class="tick">${t.label}</text>`).join("");
  const dots = ps.map(({ m, v }) => {
    const isSel = m.iso3 === sel.iso3;
    return `<circle cx="${x(v).toFixed(1)}" cy="${y}" r="${isSel ? 7 : 4.5}" class="${isSel ? "dot sel" : "dot"}"><title>${m.name}: ${money(v, "USD")} at parity</title></circle>`;
  }).join("");
  const sv = base * sel.priceLevel;
  svg.innerHTML = `
    ${bands}
    <line x1="${padL}" x2="${W - padR}" y1="${y}" y2="${y}" class="axis"/>
    ${dots}
    <text x="${x(sv).toFixed(1)}" y="${y + 38}" text-anchor="middle" class="lab">${sel.name}</text>
    <text x="${padL}" y="${H - 2}" class="tick">$0</text>
    <text x="${W - padR}" y="${H - 2}" text-anchor="end" class="tick">${money(max, "USD")}</text>`;
}

const readKey = (iso) => `csw:ready:${iso}`;
const memoryScores = {};

function renderReadiness(m) {
  const scores = memoryScores[m.iso3] ??= load(readKey(m.iso3), {});
  const topReason = topReasonOf(m);
  $("checklist").innerHTML = CHECKLIST.map((g, gi) => `
    <fieldset class="area ${g.reason && g.reason === topReason ? "is-focus" : ""}">
      <legend>${g.area}${g.reason && g.reason === topReason ? ' <span class="focus-tag">Biggest fixable barrier here</span>' : ""}</legend>
      ${g.items.map((item, ii) => {
        const id = `${gi}.${ii}`;
        const v = scores[id] ?? 0;
        return `<div class="item">
          <span class="item-l" id="it-${gi}-${ii}">${item}</span>
          <span class="seg" role="radiogroup" aria-labelledby="it-${gi}-${ii}">
            ${[0, 1, 2].map((n) => `<button type="button" role="radio" aria-checked="${v === n}" data-item="${id}" data-v="${n}">${n}</button>`).join("")}
          </span>
        </div>`;
      }).join("")}
    </fieldset>`).join("");

  const all = CHECKLIST.flatMap((g, gi) => g.items.map((item, ii) => ({ area: g.area, item, v: scores[`${gi}.${ii}`] ?? 0 })));
  const pct = all.reduce((s, x) => s + x.v, 0) / (all.length * 2);
  $("ready-score").innerHTML = `<span class="kpi-v">${fmtPct(pct, 0)}</span><span class="kpi-l">of growth levers in place in ${m.name}</span>`;
  const blockers = all.filter((x) => x.v === 0);
  const byArea = CHECKLIST.map((g) => ({ area: g.area, n: blockers.filter((b) => b.area === g.area).length })).filter((g) => g.n);
  $("blockers").innerHTML = blockers.length > 6
    ? `<h4>Not started (${blockers.length})</h4><p>${byArea.map((g) => `${g.area}: ${g.n} of 3 not started`).join(". ")}.</p>`
    : blockers.length
    ? `<h4>Not started (${blockers.length})</h4><ul>${blockers.map((b) => `<li><span>${b.area}</span> ${b.item}</li>`).join("")}</ul>`
    : `<h4>Every lever has started</h4>`;
}

function renderSources() {
  const seen = new Map();
  const keys = ["population", "internet_pct", "gdp_pc_ppp", "ppp_factor", "fx_rate", "ef_epi", "languages", "currency"];
  const sigKeys = ["genai_any", "nonuse", "segments", "pop_age", "digital_skills", "students", "enterprise_ai", "sector_ai", "firms_10plus", "paid_subs", "aei", "b2b", "b2b_trend", "sector_seats", "regions_b2b", "sector_ai_uk", "openai_business", "debit_card", "mobile_share", "ios_share"];
  for (const m of state.markets) {
    for (const f of [...keys.map((k) => m[k]), ...sigKeys.map((k) => m.sig[k])]) {
      if (!f) continue;
      const entry = seen.get(f.source) ?? { url: f.url, years: new Set() };
      if (f.year) entry.years.add(f.year);
      seen.set(f.source, entry);
    }
  }
  const s = snapshots();
  if (s.length) seen.set(state.historySource.source, { url: state.historySource.url, years: new Set([s[0].date, s.at(-1).date]) });
  const rated = s.filter((x) => x.ratings);
  if (rated.length && state.historySource.ratingsSource) {
    seen.set(state.historySource.ratingsSource, { url: state.historySource.ratingsUrl, years: new Set([rated[0].date, rated.at(-1).date]) });
  }
  $("sources").innerHTML = [...seen].map(([src, e]) => {
    const years = [...e.years].sort();
    const yr = years.length ? `, ${years.length > 1 ? `${years[0]} to ${years.at(-1)}` : years[0]}` : "";
    return `<li><a href="${e.url}">${src}</a>${yr}</li>`;
  }).join("") + `<li>Latest available year per country is used. Price level = PPP conversion factor ÷ market exchange rate. StatCounter shares are 12-month averages.</li>`;
}

function renderFunnelInputs() {
  $("b2b-inputs").innerHTML = FUNNEL_B2B.map((f) => `
    <label class="field">${f.label}
      <input type="number" min="0" max="100" step="1" value="${state.funnelB2B[f.key]}" data-funnelb="${f.key}">
    </label>`).join("") + `<label class="field">Business seat price, USD per month
      <input type="number" id="seat-price" min="1" max="500" step="1" value="${state.seatPrice ?? 25}">
    </label>`;
  $("funnel-inputs").innerHTML = FUNNEL.map((f) => `
    <label class="field">${f.label}
      <input type="number" min="0" max="100" step="1" value="${state.funnel[f.key]}" data-funnel="${f.key}">
    </label>`).join("") + `<p class="field-note" id="reach-note"></p><p class="field-note" id="paid-note"></p><p class="field-note">Downside and upside scale every rate by ${SCENARIOS[0].factor} and ${SCENARIOS[2].factor}.</p>`;
}

// "Use generative AI today" shows the selected market's figure (survey, or your override).
function applyMarketDefaults() {
  const m = byIso(state.selected);
  const ps = m.sig.paid_subs?.value;
  $("paid-note").textContent = ps
    ? `For "Convert to paid": in ${m.name}, ${pct0(ps.video)} of people pay for video streaming, ${pct0(ps.music)} for music and ${pct0(ps.apps)} for other apps (Eurostat ${m.sig.paid_subs.year}). These are habits, not conversion rates.`
    : `No official subscription figures for ${m.name} to anchor "Convert to paid".`;
  const g = m.sig.genai_any_online;
  const input = document.querySelector('input[data-funnel="reach"]');
  if (input) input.value = reachFor(m);
  $("reach-note").textContent = state.reach[m.iso3] !== undefined
    ? `"Use generative AI today" for ${m.name} is your own figure; the roll-up uses it too.`
    : g
    ? `"Use generative AI today" is set from ${g.survey === "dsit" ? "the DSIT survey 2025/26 (59% of adults ÷ 95% online)" : "Eurostat 2025"} for ${m.name}: any generative-AI tool, not only one product.`
    : `No survey for ${m.name}, so "Use generative AI today" is a placeholder.`;
}

/* ---------- orchestration ---------- */

function renderAll() {
  rank();
  renderMap();
  renderTable();
  renderPlan();
  renderRollup();
  renderMonitor();
  renderBrief();
}

function select(iso, { scroll = false } = {}) {
  if (!byIso(iso)) return;
  state.selected = iso;
  state.editing = false;
  syncUrl();
  applyMarketDefaults();
  renderMap();
  renderTable();
  renderPlan();
  renderRollup();
  renderMonitor();
  renderBrief();
  if (scroll) $("brief").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
}

function savePlan() { store("csw:plan", state.plan); syncUrl(); }

// The whole view lives in the URL hash, so a copied link opens on the same market, weights,
// scenario, list price, funnel rates and plan.
function syncUrl() {
  const plan = Object.entries(state.plan)
    .map(([iso, e]) => `${iso}-${e.q}-${CHECKLIST.findIndex((g) => g.area === e.lever)}`).join("_");
  const params = new URLSearchParams({
    m: state.selected,
    w: WEIGHTS.map((w) => state.weights[w.key]).join("-"),
    s: state.scenario,
    lp: String(basePrice()),
    f: ["active", "retained", "paid"].map((k) => state.funnel[k]).join("-"),
    t: state.track,
    wb: WEIGHTS_B2B.map((w) => state.weightsB2B[w.key]).join("-"),
    fb: FUNNEL_B2B.map((x) => state.funnelB2B[x.key]).join("-"),
    sp: String(seatPrice()),
    plan,
  });
  for (const [iso, text] of Object.entries(state.notes)) if (text) params.set(`n_${iso}`, text);
  try { history.replaceState(null, "", `#${params.toString()}`); } catch { /* ignore */ }
}

function readUrl() {
  const raw = location.hash.slice(1);
  if (!raw) return {};
  if (!raw.includes("=")) return { m: raw.toUpperCase() }; // older links: #GBR
  const params = new URLSearchParams(raw);
  const out = {};
  const m = params.get("m")?.toUpperCase();
  if (m && byIso(m)) out.m = m;
  const nums = (v, n) => {
    const xs = (v ?? "").split("-").map(Number);
    return xs.length === n && xs.every((x) => Number.isFinite(x) && x >= 0 && x <= 100) ? xs : null;
  };
  const w = nums(params.get("w"), WEIGHTS.length);
  if (w) out.weights = Object.fromEntries(WEIGHTS.map((x, i) => [x.key, w[i]]));
  if (SCENARIOS.some((x) => x.key === params.get("s"))) out.scenario = params.get("s");
  const lp = Number(params.get("lp"));
  if (lp >= 1 && lp <= 500) out.listPrice = lp;
  const f = nums(params.get("f"), 3);
  if (f) out.funnel = { active: f[0], retained: f[1], paid: f[2] };
  if (["b2c", "b2b"].includes(params.get("t"))) out.track = params.get("t");
  const wb = nums(params.get("wb"), WEIGHTS_B2B.length);
  if (wb) out.weightsB2B = Object.fromEntries(WEIGHTS_B2B.map((x, i) => [x.key, wb[i]]));
  const fb = nums(params.get("fb"), FUNNEL_B2B.length);
  if (fb) out.funnelB2B = Object.fromEntries(FUNNEL_B2B.map((x, i) => [x.key, fb[i]]));
  const sp = Number(params.get("sp"));
  if (sp >= 1 && sp <= 500) out.seatPrice = sp;
  out.notes = {};
  for (const [k, v] of params) {
    const iso = k.startsWith("n_") ? k.slice(2) : null;
    if (iso && byIso(iso) && v.length <= 6000) out.notes[iso] = v;
  }
  if (params.has("plan")) {
    out.plan = {};
    for (const part of params.get("plan").split("_").filter(Boolean)) {
      const [iso, q, li] = part.split("-");
      if (byIso(iso) && QUARTERS.includes(Number(q)) && CHECKLIST[Number(li)]) out.plan[iso] = { q: Number(q), lever: CHECKLIST[Number(li)].area };
    }
  }
  return out;
}

async function copyLink() {
  syncUrl();
  const b = $("copy-link");
  try {
    await navigator.clipboard.writeText(location.href);
    b.textContent = "Link copied";
  } catch {
    b.textContent = "Copy it from the address bar";
  }
  setTimeout(() => { b.textContent = "Copy link to this view"; }, 2400);
}

function bind() {
  $("metric").addEventListener("change", (e) => { state.metricBy[state.track] = e.target.value; renderMap(); renderTable(); });
  $("scenario").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-scenario]");
    if (!b) return;
    state.scenario = b.dataset.scenario;
    renderScenarioSeg();
    renderRollup();
    renderBrief();
    syncUrl();
    $("scenario").querySelector(`[data-scenario="${state.scenario}"]`)?.focus();
  });
  $("track").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-track]");
    if (!b || b.dataset.track === state.track) return;
    state.track = b.dataset.track;
    renderGlobals();
    renderWeights();
    renderAll();
    syncUrl();
    $("track").querySelector(`[data-track="${state.track}"]`)?.focus();
  });
  $("weights").addEventListener("input", (e) => {
    const key = e.target.dataset.weight;
    if (!key) return;
    weightsNow()[key] = Number(e.target.value);
    $(`w-${key}-out`).textContent = e.target.value;
    renderAll();
    syncUrl();
  });

  // Market selection from the map, the table, the monitor and the roll-up list.
  $("map").addEventListener("click", (e) => { const g = e.target.closest("[data-iso]"); if (g) select(g.dataset.iso, { scroll: true }); });
  $("map").addEventListener("keydown", (e) => {
    const g = e.target.closest("[data-iso]");
    if (g && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); select(g.dataset.iso, { scroll: true }); }
  });
  $("markets").addEventListener("click", (e) => {
    const s = e.target.closest("button[data-sort]");
    if (s) {
      state.sort = s.dataset.sort === state.sort.key ? { key: s.dataset.sort, dir: -state.sort.dir } : { key: s.dataset.sort, dir: -1 };
      renderTable();
      $("markets").querySelector(`button[data-sort="${state.sort.key}"]`)?.focus();
      return;
    }
    const tr = e.target.closest("tr[data-iso]");
    if (tr) select(tr.dataset.iso, { scroll: true });
  });
  $("markets").addEventListener("keydown", (e) => {
    const tr = e.target.closest("tr[data-iso]");
    if (tr && e.key === "Enter") select(tr.dataset.iso, { scroll: true });
  });
  for (const id of ["alerts", "multiples", "contrib"]) {
    $(id).addEventListener("click", (e) => {
      const b = e.target.closest("[data-goto], li[data-iso]");
      if (b) select(b.dataset.goto ?? b.dataset.iso, { scroll: true });
    });
  }

  // Plan.
  $("plan").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-plan]");
    if (!b) return;
    const iso = b.dataset.plan, q = Number(b.dataset.q);
    if (q) state.plan[iso] = { q, lever: state.plan[iso]?.lever ?? defaultLever(byIso(iso)) };
    else delete state.plan[iso];
    savePlan();
    renderMap(); renderTable(); renderPlan(); renderRollup(); renderBrief();
    $("plan").querySelector(`button[data-plan="${iso}"][data-q="${q}"]`)?.focus();
  });
  $("plan").addEventListener("change", (e) => {
    const iso = e.target.dataset.lever;
    if (!iso || !state.plan[iso]) return;
    state.plan[iso].lever = e.target.value;
    savePlan();
    renderRollup(); renderBrief();
  });
  $("plan-suggest").addEventListener("click", () => { state.plan = suggestPlan(); savePlan(); renderAll(); });
  $("plan-focus").addEventListener("click", () => { state.plan = focusPlan(); savePlan(); renderAll(); });
  $("plan-clear").addEventListener("click", () => { state.plan = {}; savePlan(); renderAll(); });

  // Prices and funnel.
  for (const id of ["base-price", "cut-high", "cut-mid", "mult-mid", "mult-low"]) {
    // Tier settings can change a market's play, so redraw everything.
    $(id).addEventListener("input", () => { renderAll(); syncUrl(); });
  }
  $("b2b-inputs").addEventListener("input", (e) => {
    if (e.target.id === "seat-price") state.seatPrice = Number(e.target.value) || 0;
    const key = e.target.dataset.funnelb;
    if (key) state.funnelB2B[key] = Math.max(0, Math.min(100, Number(e.target.value) || 0));
    renderRollup();
    renderBrief();
    syncUrl();
  });
  $("funnel-inputs").addEventListener("input", (e) => {
    const key = e.target.dataset.funnel;
    if (!key) return;
    const v = Math.max(0, Math.min(100, Number(e.target.value) || 0));
    if (key === "reach") state.reach[state.selected] = v;
    else state.funnel[key] = v;
    if (key === "reach") applyMarketDefaults();
    renderRollup();
    renderBrief();
    syncUrl();
  });

  $("checklist").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-item]");
    if (!b) return;
    const scores = memoryScores[state.selected];
    scores[b.dataset.item] = Number(b.dataset.v);
    store(readKey(state.selected), scores);
    renderReadiness(byIso(state.selected));
    document.querySelector(`button[data-item="${b.dataset.item}"][data-v="${b.dataset.v}"]`)?.focus();
  });
  $("print").addEventListener("click", () => window.print());
  $("memo").addEventListener("click", (e) => {
    const id = e.target.id;
    if (id === "note-edit") { state.editing = true; renderMemo(byIso(state.selected)); $("note-text")?.focus(); }
    if (id === "note-cancel") { state.editing = false; renderMemo(byIso(state.selected)); }
    if (id === "note-save" || id === "note-delete") {
      const text = id === "note-save" ? $("note-text").value.trim() : "";
      if (text) state.notes[state.selected] = text; else delete state.notes[state.selected];
      store("csw:notes", state.notes);
      state.editing = false;
      renderMemo(byIso(state.selected));
      syncUrl();
    }
  });
  $("copy-link").addEventListener("click", copyLink);
}

async function init() {
  const res = await fetch("data/markets.json");
  if (!res.ok) throw new Error(`Could not load market data (HTTP ${res.status}).`);
  const data = await res.json();
  const [sres, hres] = await Promise.all([fetch("data/signals.json"), fetch("data/appstore_history.json")]);
  const signals = sres.ok ? await sres.json() : {};
  const hist = hres.ok ? await hres.json() : { snapshots: [] };
  state.history = hist.snapshots ?? [];
  state.historySource = { source: hist.source, url: hist.url, ratingsSource: hist.ratings_source, ratingsUrl: hist.ratings_url };
  state.markets = data.markets.map((m) => derive({ ...m, sig: signals[m.iso3] ?? {} }));
  state.median = adoptionMedian();
  robustness();

  // A shared link wins; then this browser's saved plan; then the default plan.
  const url = readUrl();
  if (url.m) state.selected = url.m;
  if (url.weights) state.weights = url.weights;
  if (url.scenario) state.scenario = url.scenario;
  if (url.listPrice) $("base-price").value = url.listPrice;
  if (url.funnel) Object.assign(state.funnel, url.funnel);
  if (url.track) state.track = url.track;
  if (url.weightsB2B) state.weightsB2B = url.weightsB2B;
  if (url.funnelB2B) Object.assign(state.funnelB2B, url.funnelB2B);
  if (url.seatPrice) state.seatPrice = url.seatPrice;
  const savedNotes = load("csw:notes", {});
  state.notes = { ...DEFAULT_NOTES, ...(savedNotes && typeof savedNotes === "object" ? savedNotes : {}), ...(url.notes ?? {}) };
  state.focus = [...state.markets].sort((a, b) => b.population.value - a.population.value).slice(0, FOCUS_COUNT).map((m) => m.iso3);

  rank();
  const validPlan = (plan) => Object.fromEntries(Object.entries(plan).filter(([iso, e]) => byIso(iso) && QUARTERS.includes(e?.q) && CHECKLIST.some((g) => g.area === e.lever)));
  const saved = load("csw:plan", null);
  state.plan = url.plan ?? (saved && typeof saved === "object" ? validPlan(saved) : DEFAULT_PLAN ? validPlan(DEFAULT_PLAN) : focusPlan());

  renderGlobals();
  renderWeights();
  renderFunnelInputs();
  applyMarketDefaults();
  bind();
  renderAll();
  renderSources();
  syncUrl();
}

init().catch((err) => {
  const p = document.createElement("p");
  p.className = "error";
  p.textContent = `${err.message} Reload the page to try again.`;
  document.querySelector("main").replaceChildren(p);
});
