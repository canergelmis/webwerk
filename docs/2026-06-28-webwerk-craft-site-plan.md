# Webwerk Computational-Craft Site — Implementation Plan

> **For agentic workers:** Built inline by the lead (not subagents) — heavy WebGL needs visual iteration; subagents stalled on it. Steps use checkbox (`- [ ]`) tracking. Verification = Playwright render checks (freeze-hooks, screenshots, FR/EN, fallbacks), not unit tests.

**Goal:** Replace the dull v1 Webwerk site with a computational-craft single page whose WEBWERK particle hero proves the studio's skill on sight, with refined converting sections beneath.

**Architecture:** One self-contained `index.html` on GitHub Pages. Three.js (particles + aurora, one WebGL context) for the hero; GSAP+ScrollTrigger for reveals/handoff/kinetic headings; magnetic cursor. The `/lab/` prototype is the proven reference for the hero engine.

**Tech Stack:** Three.js 0.176 (importmap CDN), GSAP 3.15 + ScrollTrigger (CDN), Space Grotesk/Inter/Space Mono, vanilla JS i18n.

## Global Constraints

- Single self-contained `index.html`; no build step; GitHub-Pages-safe; libraries from CDN.
- Brand: near-black `#06070b`, cobalt `#3247ff` → violet accent, off-white `#eef1f8`; Space Grotesk (display) / Inter (body) / Space Mono (labels).
- FR default + EN switcher (in-HTML FR; `[data-i18n]`/`[data-i18n-html]`; `setLang()`; localStorage key `webwerk_lang`).
- **INDEXABLE:** real `<title>`, meta description, OG tags, canonical `https://webwerk.lu/`, `robots.txt` allow, `sitemap.xml`. (Opposite of the demos.)
- **Hero engine** reused/adapted from `lab/index.html` (proven): particle WEBWERK assemble→hold→dissolve over fbm aurora, cursor-reactive, one WebGL context / two passes.
- **Hero refinements:** 3D parallax tilt, spring-back on cursor-leave, cobalt→violet gradient + slow shimmer. Constellation lines = optional flag, default OFF.
- **MUST sample the particle wordmark only after `document.fonts.ready`** (known font-timing bug).
- **Fallbacks mandatory:** no-WebGL → CSS gradient + static `<h1>WEBWERK</h1>`; `prefers-reduced-motion` → static formed wordmark, reveals instant, no loops. Canvas `aria-hidden`; real content in DOM.
- **Perf:** page < 2 MB; DPR ≤ 1.6; pause RAF on hidden tab; mobile particle cap ≤ 12k (desktop ≤ 24k); lazy concerns acceptable since hero is above the fold.
- No backend, no public portfolio, no audio, no bloom post-processing.
- During verification use cache-busting `?v=N` query params (static-page caching bit us in the prototype).
- Commit after each task. Keep `/lab/` as-is (reference).

---

### Task 1: Scaffold shell, head/SEO, brand tokens, nav, FR/EN i18n

**Files:**
- Modify: `index.html` (full replace of v1)

**Interfaces:**
- Produces: the page skeleton + `setLang(l)` i18n function + CSS custom props (`--ink,--accent,--accent2,--paper,--muted`) consumed by all later tasks; section anchors `#services #process #why #about #contact`.

- [ ] **Step 1:** Replace `index.html` with: indexable `<head>` (title, description, OG, canonical, theme-color), Google Fonts (Space Grotesk/Inter/Space Mono), `:root` brand tokens, reset.
- [ ] **Step 2:** Build sticky `<header>`: Webwerk mark (dot + name), nav links (Services/Méthode/À propos/Contact), FR/EN `.lang-switch`, "Devis" CTA, mobile burger toggle.
- [ ] **Step 3:** Add the i18n engine (FR in-HTML default; `[data-i18n]` textContent + `[data-i18n-html]` innerHTML; `I18N={fr:{},en:{…}}`; `setLang`; localStorage `webwerk_lang`) — same mechanism as the demos.
- [ ] **Step 4 (verify):** Serve, load `?v=t1`; Playwright: title correct, no console errors (favicon ok), nav renders, `setLang('en')` swaps nav copy, `setLang('fr')` restores. Screenshot.
- [ ] **Step 5:** Commit `feat(webwerk): shell + head/SEO + nav + i18n`.

---

### Task 2: WebGL hero engine — aurora + particle WEBWERK (assemble→hold→dissolve), cursor-reactive, fallbacks

**Files:**
- Modify: `index.html` (hero section + Three.js module)

**Interfaces:**
- Consumes: brand tokens from Task 1.
- Produces: `#gl` canvas + hero DOM (eyebrow, tagline, wordless scroll cue); module globals via hooks `window.__setPhase(a,d)`, `window.__unfreeze()`, `window.__dbg` for verification; a `dissolveTo(v)` path later driven by scroll (Task 5).

- [ ] **Step 1:** Port the proven `/lab/` hero: importmap Three 0.176; one `WebGLRenderer` (autoClear off); fbm-aurora fullscreen shader pass; particle `Points` with `aTarget/aRand`; vertex shader doing `mix(position,aTarget,uAssemble)` + breathing + dissolve flow-field + cursor repulsion; small non-additive points (size ≈1.7 desktop/1.3 mobile, `gl_PointSize … *22.0/-mv.z`); timeline assemble 0–2.6s / hold→4.2s / dissolve→0.55.
- [ ] **Step 2:** Wordmark sampling: build target points from a canvas `fillText('WEBWERK', …)` **inside a `document.fonts.ready` gate** (rebuild + restart timeline); density cap 24k desktop / 12k mobile; step 2/3.
- [ ] **Step 3:** Fallbacks: `try{new WebGLRenderer}` → on fail add `.no-webgl` (CSS shows `.fallback` gradient + static `WEBWERK`, hides `#gl`). `prefers-reduced-motion` → set `uAssemble=1`, skip timeline/RAF loop animation of phase. Canvas `aria-hidden="true"`.
- [ ] **Step 4 (verify):** load `?v=t2`; wait `document.fonts.ready`; `window.__setPhase(1,0)` → screenshot → confirm **legible WEBWERK** (`window.__dbg` shows wide-thin band x≈[-10,10] y≈[0.6,3.6], N≈15k). `__setPhase(1,0.55)` → screenshot dissolve. Move pointer via `dispatchEvent` → confirm particles displace. No console errors.
- [ ] **Step 5:** Commit `feat(webwerk): WebGL particle hero + aurora + fallbacks`.

---

### Task 3: Hero refinements — 3D parallax tilt, spring-back physics, cobalt→violet gradient + shimmer

**Files:**
- Modify: `index.html` (hero module + shaders)

**Interfaces:**
- Consumes: Task 2 hero module (uniforms `uAssemble,uDissolve,uMouse,uTime`; `points` mesh; `mWorld`).
- Produces: refined hero; new uniforms `uTilt` (vec2), gradient handled in frag via `aTarget.x`-based mix; spring state on cursor-leave.

- [ ] **Step 1 (parallax tilt):** track smoothed pointer offset; apply a small rotation to `points` (and a counter-parallax on aurora `u_mouse`) so the wordmark tilts toward cursor — clamp ≈ ±0.12 rad; lerp for smoothness.
- [ ] **Step 2 (spring-back):** replace the instantaneous cursor-leave with a spring: maintain a `repel` strength that eases to 0 with slight overshoot when the pointer leaves (`pointerleave`), so particles elastically resettle into letters.
- [ ] **Step 3 (gradient + shimmer):** in the fragment shader, mix `uA1`(cobalt)→`uViolet` across normalized `aTarget.x` (pass an `aU` attribute = letter-space x in [0,1]); add a slow shimmer wave `sin(aU*k - uTime*s)` modulating brightness while held.
- [ ] **Step 4 (verify):** load `?v=t3`; freeze formed; screenshot → confirm cobalt→violet across letters + visible shimmer; dispatch pointer move → tilt visible; pointer-leave → particles spring back (sample two frames). No perf error; FPS sane (no RAF errors).
- [ ] **Step 5:** Commit `feat(webwerk): hero parallax tilt + spring-back + gradient/shimmer`.

---

### Task 4: Content sections — services, process (dark), why, about, contact, footer (refined, scroll-revealed)

**Files:**
- Modify: `index.html` (sections + GSAP)

**Interfaces:**
- Consumes: brand tokens + i18n from Task 1 (every new string gets `data-i18n`/EN entry).
- Produces: sections `#services #process #why #about #contact` + footer; `.reveal` elements; GSAP ScrollTrigger init.

- [ ] **Step 1:** Add GSAP 3.15 + ScrollTrigger via CDN; `gsap.registerPlugin(ScrollTrigger)` in `DOMContentLoaded`.
- [ ] **Step 2:** Build the 6 blocks (markup + CSS) from the spec: Services (4 cards), Process/dark (3 steps + "pas de catalogue générique" kicker), Why (4), About, Contact (Formspree form `action="https://formspree.io/f/YOUR_FORM_ID"` + name/business,email,project + mailto + FB/IG), Footer. Each string `data-i18n`’d with an EN entry added to `I18N.en`.
- [ ] **Step 3:** Scroll-reveals: stagger `.reveal` (opacity/translateY only) via ScrollTrigger; kinetic char-reveal on section `h2`s; gate all of it behind `(prefers-reduced-motion: no-preference)` (reduced → show instantly).
- [ ] **Step 4 (verify):** load `?v=t4`; scroll through; Playwright: all 6 sections present, reveals fire (elements gain `.in`), FR/EN swaps all section copy, form fields present & action set. Desktop 1280 + mobile 375 screenshots. No console errors.
- [ ] **Step 5:** Commit `feat(webwerk): content sections + scroll reveals`.

---

### Task 5: Magnetic cursor + scroll handoff (hero dissolves into page on scroll)

**Files:**
- Modify: `index.html` (cursor + ScrollTrigger linking hero uniform)

**Interfaces:**
- Consumes: hero `uDissolve` uniform (Task 2), GSAP/ScrollTrigger (Task 4), `.btn`/nav CTA elements.
- Produces: magnetic-cursor behavior; a ScrollTrigger that scrubs hero `uDissolve` 0→0.6 as the hero scrolls out.

- [ ] **Step 1 (magnetic):** add a custom cursor / magnetic pull on `.btn`+CTA+nav (transform toward pointer within a radius); disable on touch + reduced-motion.
- [ ] **Step 2 (handoff):** ScrollTrigger on the hero: as it scrolls out (top→ -50vh), scrub `mat.uniforms.uDissolve.value` 0→0.6 and fade hero text, so the wordmark visibly disperses downward into the page; let the auto-timeline yield to scroll once the user scrolls (flag `userScrolled`).
- [ ] **Step 3 (verify):** load `?v=t5`; programmatic scroll to 30%/60% → screenshot shows wordmark dispersing; magnetic CTA shifts toward a dispatched pointer; touch/reduced-motion path skips both. No console errors.
- [ ] **Step 4:** Commit `feat(webwerk): magnetic cursor + scroll handoff`.

---

### Task 6: SEO assets, perf/a11y pass, deploy, verify live

**Files:**
- Modify: `index.html`; ensure `robots.txt`, `sitemap.xml`, `README.md` current.

- [ ] **Step 1:** Confirm `robots.txt` (Allow + sitemap) and `sitemap.xml` exist & correct; README go-live checklist current (domain via EuroDNS, CNAME, Formspree id, mailbox, FB/IG). Add `prefers-reduced-motion` + no-WebGL notes.
- [ ] **Step 2 (perf/a11y):** verify page weight < 2 MB; DPR cap; RAF pauses on `visibilitychange`; canvas `aria-hidden`; reduced-motion path clean; tab/keyboard reaches nav + form; color-contrast on text sane.
- [ ] **Step 3:** Commit `feat(webwerk): SEO assets + perf/a11y`; push to `canergelmis/webwerk`.
- [ ] **Step 4 (verify live):** poll `https://canergelmis.github.io/webwerk/` until 200 (cache-bust); confirm title, **no `noindex`**, hero canvas present, robots/sitemap served, FR/EN works live. Report the live URL.

---

### Task 7: Memory + wrap-up

- [ ] **Step 1:** Update `project_webwerk.md` + MEMORY line: site rebuilt to computational-craft (particle WEBWERK hero), live; note the lab prototype + the font-timing/caching lessons already recorded.
- [ ] **Step 2:** Summarize to user with the live link + screenshots + remaining owner prerequisites.

---

## Self-Review notes
- **Spec coverage:** hero+refinements (T2,T3), refined sections (T4), magnetic+handoff (T5), FR/EN+indexable (T1,T6), fallbacks (T2 step3 + T4 step3 + T6), perf budget (T6) — all mapped. Constellation lines intentionally deferred (optional, default-off) — noted, not a task.
- **Adaptation:** no unit harness; every task ends in a Playwright render/behavior verification with explicit expected outcomes (legible wordmark via `__dbg` bounds, reveals gaining `.in`, live 200 + no-noindex).
- **Known traps encoded:** font-timing gate (T2 step2), cache-bust on verify (global + each verify step), mobile particle cap (global/T2).
