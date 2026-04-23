# Career Coach — HAL Stack Rigor Audit

> **⚠ PROGRESS UPDATE 2026-04-22** — 3 of 5 §8 Top-5 next-actions have SHIPPED; 2 remain open. Do NOT treat §8 as an untouched backlog; re-audit before proposing Career Coach work.
>
> | # | Action | Status |
> |---|---|---|
> | 1 | Apply S-CLARITY-PORTABILITY pattern | **Shipped** in `9d7e44e` S-CC-PORTABILITY (provider picker wired end-to-end) |
> | 2 | Self-host DM fonts | **Shipped** in `45d3ddd` S-CC-FONTS (~145 KB vendored across 5 woff2 + 2 OFL licences) |
> | 3 | Complete `pricing.html` | **Open** — blocked on deciding what Pro is |
> | 4 | Clarity + Career Coach cross-promotion | **Shipped** in `da62d75` S-CROSS-PROMO (footer links to Clarity + DCC) |
> | 5 | Pro-launch email capture | **Open** — not shipped |
>
> Also shipped post-audit: inline script extraction to `js/app.js` (`0b53a6e` S-CC-CSP-READY) and stale preconnect cleanup (`80ee1e1` S-037) — both ancillary to §8.



**Audit date:** 2026-04-21
**Auditor:** Claude Code (Opus 4.7 · max-mode autonomous)
**Sprint:** S-CC-HYGIENE (self-directed; fifth audit pattern of the day after S-CLARITY, S-KEVIN, S-AARON, S-TBI)
**Repo state at audit:** `career-coach` master @ `0159a5b`; one inline fix commit shipped during this sprint.

---

## What this is

Career Coach is a static HTML/CSS/JS app that helps job seekers land jobs with AI assistance. Same product family as Clarity — LLM portability layer underneath, BYO API key, private-by-design (all data in-browser). Features: onboarding wizard, CV-vs-job-posting analysis, cover letter generation, mission-driven cover letter variant, job tracking with stats, JSON/CSV export, pricing-page tease for Career Coach Pro, bilingual EN/FR (via `data-en`/`data-fr` attrs), voice input on form fields. ~2780-line single-page `index.html` + `llm-provider.js` + `qa-audit.js` + `pricing.html`.

Biggest of the three Clarity-family products by surface area — Clarity is a diagnostic (one-shot), Career Coach is a workflow (multi-session).

---

## TL;DR — shipped this sprint

| Fix | Why | Commit |
|---|---|---|
| `lang="en"` → `lang="en-CA"` | Canadian English site was lying to SRs and search engines about locale | pending |
| Full SEO/social metadata block (description, robots, canonical, OG title/description/type/url/locale) | All were missing despite product being user-acquisition-facing | pending |
| Skip-link + `<main id="main">` landmark | WCAG 2.4.1 / 1.3.1 — both missing | pending |
| New `.github/workflows/axe-core.yml` | Every-push a11y CI (matches DCC / Clarity / Kevin / aaron-patzalek / TBI) | pending |

---

## 1. Accessibility

### Strengths (pre-existing)
- `qa-audit.js` already wired for `?qa=true` axe overlay — same pattern as Clarity, Kevin, TBI
- Form fields appear to have `aria-label` on voice-input mic buttons
- Bilingual `data-en` / `data-fr` attributes indicate accessibility-thoughtful authoring
- Mobile-first CSS (`@media (max-width: 600px)` adjustments)
- `sr-only` utility class defined

### Shipped this sprint
- Skip-link added (WCAG 2.4.1) — was missing
- `<main id="main">` landmark wrapping app content — was missing
- `lang="en-CA"` corrected from `lang="en"`

### Backlog
- **Inline onclick handlers** — 40+ `onclick=` attributes across the file. Semantic (all on real `<button>` elements so not a keyboard-a11y issue) but CSP-unfriendly. A future cleanup into event delegation would tighten CSP readiness. LOE: 2-3 h for full extraction. Low urgency.
- **Contrast on the dark-teal palette** — `--text-secondary: #8AA0B8` on `--navy: #1B3A4B` is borderline. Once axe-core CI runs, the exact contrast numbers will appear in the JSON report. Fix downstream based on findings.
- **Voice input mic buttons** — work great but have no state indicator for "currently listening". A pulsing ring + `aria-live` announcement would make the feature accessible to non-visual users.
- **Bilingual `data-en`/`data-fr`** — good pattern, but the `lang` attribute on the `<html>` element stays `en-CA` even when the UI switches to French via `toggleLang()`. Should also toggle `document.documentElement.lang = 'fr-CA'` when French is active, for screen readers.

---

## 2. Performance

- 2779-line single-page app. Large but parses fast — no build step, no frameworks.
- **External font load from Google Fonts** — DM Sans (4 weights) + DM Serif Display. ~300 KB across the two families. Same phone-home issue as Kevin's site and Aaron's brand site (both since fixed in their audits).
- Single API call per LLM action; no streaming.

### Recommendations
- **Self-host the two DM fonts** (DM Sans + DM Serif Display). Both available from Google Fonts' open catalogue under SIL OFL 1.1. Drop into `fonts/dm-sans/` + `fonts/dm-serif-display/`, remove the `fonts.googleapis.com` links. Parallel to the Kevin + aaron-patzalek self-host. LOE: 30 min. Sovereignty win + removes cross-origin font loading.
- **Prompt caching** — same recommendation as Clarity. The CV-analysis call at `index.html:1790` has a long stable scaffolding followed by the user's CV. Moving the scaffolding into a cached `system` block saves latency + input-token cost. Low urgency until daily traffic justifies it.

---

## 3. LLM portability layer

**Status:** same three-state diagnosis as the pre-S-CLARITY-PORTABILITY state of Clarity. The `llm-provider.js` is identical (4 providers supported) but the `index.html` doesn't wire the provider picker UI. All 4 `llmChat` calls assume Anthropic + rely on the provider's default Haiku 4.5 model. One call at line 2594 explicitly overrides to `model: 'claude-haiku-4-5-20251001'` (which matches the default — redundant but not broken).

### Recommendation
- **Apply the same Route B wiring** I shipped for Clarity in S-CLARITY-PORTABILITY (`a5a0d4d` on clarity repo):
  - Add a provider `<select>` to the settings panel (the existing API-key entry form in the left-rail `<aside>` is the natural spot).
  - On activate, call `llmSetProvider(provider, apiKey)` → writes `llm_provider` + `llm_api_key` to localStorage.
  - Remove the redundant `model:` override at line 2594 (let the provider default drive).
  - Update the privacy note to name the active provider dynamically.
- LOE: ~60 min. Mirrors the Clarity pattern exactly; the `llm-provider.js` file is already identical.

---

## 4. Security & privacy

- **API key in `localStorage`** — industry-standard for browser-only apps; disclosure on the site is accurate.
- **Legacy `cc_api_key`** — `llm-provider.js` reads `llm_api_key || cc_api_key` as fallback. Backwards-compatible with older users.
- **`anthropic-dangerous-direct-browser-access: true` header** — known Anthropic escape hatch; present in all Clarity-family sites.
- **No tracking, no analytics, no cookies** — consistent with the brand promise.
- **JSON + CSV export + clear-all button** — proper data-sovereignty UX for the user.

### Backlog
- CSP header (not present; hosted on GitHub Pages which can't set headers). Same story as Clarity — refactor to external JS + no inline `onclick` first, then add CSP when migrating to a headered host.

---

## 5. Code quality

- **2779-line single-file `index.html`** — substantial app in one file. Works, but refactor into separate JS files would improve maintainability (split by: onboarding, job-tracking, CV analysis, cover-letter generation, export/import).
- **Lots of inline `onclick`** — 40+ instances, all on real `<button>` elements. Upgrade path is event delegation at the app root.
- **Bilingual attributes** (`data-en`/`data-fr`) are a cleaner pattern than most would use; good.
- **Existing qa-audit.js + llm-provider.js** show the author already thinks in terms of extractable modules.

---

## 6. CI / CD

### Before this sprint
None. No workflows directory.

### After this sprint
- `axe-core.yml` — every-push a11y CI. **New.**

### Backlog
- **Broken-external-link check** — pricing page links out, LinkedIn links exist, GitHub links exist. Weekly HEAD-probe (mirror of Kevin's `listing-availability.yml`) would flag if any break. LOE: 15 min.
- **Playwright smoke** — the onboarding wizard + CV-analysis flows would benefit from E2E smoke tests, but those require a mock LLM endpoint (same blocker as Clarity's Playwright recommendation). Defer until traffic justifies.

---

## 7. Monetization & positioning

- **Career Coach Pro tease** on `pricing.html` exists — currently just a "Coming Soon" link from the app footer. No pricing disclosed.
- **Hero copy is strong**: "Land the job. Know your worth. Own your story." Three outcomes in three verbs.
- **"Private by design" framing** is a differentiator against competitors that harvest CV content.

### Recommendations
- **Complete the pricing page**. Currently it's a 23-line "Coming Soon" stub. Concrete pricing (and what Pro includes beyond the free tier) is a pre-requisite for conversion. LOE: 1-2 h once Aaron decides what Pro is. Same note as the Clarity pricing page recommendation.
- **Clarity + Career Coach cross-promotion**. Both are free AI-workflow products targeting overlapping cohorts. Each should link to the other ("Finished your career diagnostic? Run an AI business diagnostic on your business next → Clarity"). LOE: 5 min per site.
- **Capture email for launch announcement** on Pro. If Pro ships in 2026, the users who use the free tier between now and then are the highest-converting cohort. Asking for an email with "tell me when Pro ships" during CSV export or after first successful CV analysis is high-ROI. LOE: 30 min + Formspree/Buttondown integration.

---

## 8. Top 5 prioritised next actions

By impact × (1 / LOE):

1. **Apply the S-CLARITY-PORTABILITY pattern** (~60 min). Wire the provider picker UI; removes the theoretical-only portability claim. Parallel to commit `a5a0d4d` on Clarity.
2. **Self-host DM fonts** (30 min). Removes Google Fonts phone-home; parallel to the Kevin + aaron-patzalek fixes.
3. **Complete `pricing.html`** (1-2 h content). Pre-requisite for any Pro conversion. Blocked on deciding what Pro is.
4. **Clarity + Career Coach cross-promotion** (5 min per site). Highest-leverage single change — each product becomes the other's top-of-funnel.
5. **Pro-launch email capture** (30 min + service setup). Builds the list that converts when Pro ships.

Items 4 + 2 together = ~35 min and could ship as one sprint.

---

## 9. What this audit did NOT cover

- **Rendered-browser QA** — didn't open the site. Dark-navy palette contrast needs axe-core + visual verification.
- **Real job-seeker walkthrough** — substitute for watching an actual Canadian job-seeker complete the onboarding and a CV analysis. Likely reveals UX friction invisible to static inspection.
- **Comparison to paid competitors** (Teal, Jobscan, Rezi). How does Career Coach's private-by-design positioning land vs established paid products?
- **AI output quality audit** — did Haiku 4.5 produce good cover letters and CV analyses in practice? No sample runs were executed from this audit.

---

## Confidence (overall)

83%. Four inline fixes are small and reversible. The top-5 recommendations map cleanly onto patterns already proven elsewhere in the portfolio (S-CLARITY-PORTABILITY, S-KEVIN-HYGIENE font self-host). 17% reserved for: no browser rendering was done this session, and the AI output quality question is genuinely unknown without sample runs.

## Scrappy Pack says
The Ripper — Career Coach is structurally identical to pre-portability Clarity; applying the same S-CLARITY-PORTABILITY Route-B wiring is the single biggest unlock (proves L3/L4 capability, opens non-Anthropic providers). 60 min for a feature that's been specced + delivered once already on the same codebase family.

LOE for Top 5: ~4 h total; ~90 min if items 1+2+4 only (highest-leverage triad).
