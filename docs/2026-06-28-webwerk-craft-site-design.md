# Webwerk — computational-craft site (design spec)

**Date:** 2026-06-28
**Project:** Webwerk — Luxembourg web studio (general SMB; restaurants = lead vertical)
**Supersedes:** the v1 "competent but dull" single-page site (kept in git history). Same repo `canergelmis/webwerk`, GitHub Pages, domain `webwerk.lu` (to point later).

## Goal

Rebuild the Webwerk site so the site **itself is the portfolio** — a computational-craft, "embroidered by AI" experience that proves the studio's skill on sight. The wow lives in **code-as-craft** (GPU particles, generative motion, intelligent interaction), NOT in a tool/gimmick. It must still be a real studio site that converts: services, process, contact.

## Locked decisions (with user)

- **Direction:** computational craft (Chipsa/Obys tier). Rejected: a "type-your-business → AI builds it" hero (reads as a budget Lovable/Base44 — wrong positioning).
- **Hero = the showpiece:** a GPU particle system forms the wordmark **WEBWERK**, then dissolves into a flowing abstract field; cursor-reactive; over a living fbm-aurora shader. (Prototype proven + deployed at `/lab/`.)
- **Intensity:** hero is the big moment; the rest of the page is **refined** — clean premium sections with tasteful scroll-reveals + a magnetic cursor, not maximal motion everywhere.
- **Hero refinements to fold in:** 3D parallax tilt, spring-back physics on cursor-leave, cobalt→violet gradient + slow shimmer across the letters. Constellation lines = optional toggle (off by default for clarity/perf). 
- **Scroll handoff:** as the user scrolls out of the hero, the wordmark dissolves and particles flow downward into the first section divider — one graceful tie; rest of page stays refined.
- **Languages:** FR default + EN (same i18n switcher as the demos). **Indexable** (real title/description/OG/canonical, robots allow, sitemap) — unlike the noindex restaurant demos.
- **No public client portfolio** (none signed yet); proof = the site's own craft + the demo-first process. Contact = Formspree form (placeholder id swapped later) + mailto fallback.
- **No "move the mouse" / hand-holding cues** — interactivity is discovered. A wordless scroll cue only.

## Tech / architecture

- **Single self-contained `index.html`** (+ `robots.txt`, `sitemap.xml`, `README.md`), no build step, GitHub-Pages-safe. Libraries from CDN.
- **Three.js 0.176** via importmap (particles + aurora background, one WebGL context, two render passes — proven in the prototype).
- **GSAP 3.15 + ScrollTrigger** (CDN) for section reveals, kinetic headings, the scroll handoff. Animate transform/opacity only.
- **Fonts:** Space Grotesk (display), Inter (body), Space Mono (labels) — established Webwerk brand. Cobalt `#3247ff`/violet accent on near-black `#06070b` + warm off-white.
- **Mandatory fallbacks:** no-WebGL → CSS-gradient hero + static wordmark; `prefers-reduced-motion` → static formed wordmark, no looping motion, reveals become instant. Canvas `aria-hidden`; all real content in normal DOM.
- **Performance budget:** < 2 MB page; lazy-init WebGL via IntersectionObserver; cap DPR ≤ 1.6; pause RAF when tab hidden; mobile particle cap lower; Lighthouse stays decent.

## Page structure (single page)

1. **Sticky nav** — Webwerk mark + FR/EN switch + "Devis" CTA; magnetic on the CTA; mobile burger.
2. **Hero** — particle WEBWERK assemble→hold→dissolve over aurora; refinements above; tagline ("On conçoit des sites qui ne ressemblent à aucun autre."); wordless scroll cue. Scroll handoff into §3.
3. **Services** (4) — design & build · multilingual · hosting & visibility/SEO · done-for-you. Scroll-revealed cards; magnetic hover.
4. **Process / "La méthode"** (dark) — the demo-first hook: we build you a free demo → you review → we launch & maintain. "Pas de catalogue générique — votre site, pas celui d'un autre."
5. **Why Webwerk** (4) — local · multilingual · see-before-you-pay · simple & transparent.
6. **About** — small two-person studio, Luxembourg, much care.
7. **Contact** — Formspree form (name/business, email, project) + mailto + FB/IG; kinetic heading.
8. **Footer** — mark, email, © .

Each section is an independent unit (own DOM block + reveal); the WebGL hero is isolated (its own canvas + module), so the page degrades cleanly if WebGL fails.

## Success criteria

- Hero: WEBWERK forms legibly, holds, dissolves; cursor parallax + spring-back + gradient/shimmer all visibly working; aurora reacts. Render-verified via Playwright (freeze-hook for exact phases).
- Full page renders correctly desktop (1280) + mobile (375); FR/EN switches all copy; scroll reveals fire; magnetic cursor works; scroll handoff plays once.
- Fallbacks verified: simulated no-WebGL shows static wordmark; reduced-motion shows static formed state with no loops.
- Indexable head tags present; page weight < 2 MB; no console errors; deployed live (HTTP 200) on GitHub Pages.

## Out of scope (YAGNI)

- Real AI/LLM backend (the rejected generator). No backend at all.
- Public client portfolio / case studies.
- Audio layer (skipped — user didn't bite earlier).
- Heavy post-processing bloom (mobile cost).
- Domain registration / Formspree account / mailbox — owner prerequisites, documented in README, not build tasks.

## Risks

- **Mobile GPU perf** — mitigate: lower particle cap, DPR cap, simpler shader on small screens, IntersectionObserver lazy-init.
- **Font-timing** (sampling the wordmark before the web font loads → garbled) — KNOWN bug from the prototype; build MUST sample targets only after `document.fonts.ready`.
- **Aggressive static-page caching during iteration** — use cache-busting query params when verifying.
- **Legibility of particle wordmark** — keep small non-bloomed points + sufficient density (proven: ~15k desktop / ~12k mobile cap).
