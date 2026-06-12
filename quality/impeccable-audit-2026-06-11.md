# Career Coach — /impeccable Design Audit
**Date:** 2026-06-11
**Sprint:** S-CAREERCOACH-AUDIT (Notion: `375a09cf-876a-8158-8429-efc88c717170`)
**Auditor:** Claude Code (claude-sonnet-4-6 · loop mode)
**Audit scope:** `C:\twobirds\career-coach` — index.html, beta/index.html, pricing.html, privacy.html, PRODUCT.md
**Prior audit:** S-CC-HYGIENE (2026-04-21) + S-CAREER-COACH-REAUDIT build-validator (2026-06-11 → 17/20)

---

## Score

| Layer | Score | Notes |
|-------|-------|-------|
| Build compliance | 17/20 | Confirmed S-CAREER-COACH-REAUDIT (June 11) |
| Product-design principles | 8/10 | Good alignment; muted contrast + token gap |
| UX flows | 8/10 | Gate 0 prominent; pricing page = dead end |
| Visual coherence | 7/10 | Hardcoded hex in 3 files diverge; no token source of truth |
| Dark mode depth | 6/10 | Forced dark works; modals unchecked; no OS preference respect needed |
| **Overall** | **15/20** | Good bones; 3 clear blockers for pre-revenue state |

---

## PRODUCT.md Compliance Check

| Design Principle | Status | Finding |
|-----------------|--------|---------|
| Job posting = center of gravity | ✅ | Left-rail job list → right-panel detail flow is correct |
| Verify before you build (Gate 0) | ✅ | Gate 0 block visually prominent above add-job form |
| Action indicators over status labels | ✅ | Score circles, risk dots, priority badges |
| BYOK = feature, not constraint | ⚠️ | Provider picker wired (S-CC-PORTABILITY) but no "you control your data" framing in UI |
| Trust the user's judgment | ✅ | AI generates, human decides — correct |
| Not "dark hacker terminal" | ✅ | DM Serif Display headings, card-based layout — professional, not terminal |
| Trusted co-pilot tone | ✅ | Copy is practical, plain English — correct |
| Anti-references avoided | ✅ | No affirmation language, no overbuilt dashboard |

---

## P0 Findings (ship blockers)

*(none — 17/20 build-validator means no P0 tech blockers)*

---

## P1 Findings (pre-revenue blockers)

**P1-1: Token architecture missing — hex values split across 3 files**

`index.html`, `beta/index.html`, and `pricing.html` each define their own `:root` block. They diverge:
- `index.html`: `--navy: #1B3A4B` / `--bg: #0F1B2D` (two background shades)
- `beta/index.html`: `--navy: #0F1B2D` (different from index.html)
- `pricing.html`: no `:root` at all — bare hex `#0F1B2D`, `#00C9A7`, `#8AA0B8` inline

**Impact:** A brand colour change requires edits in 3+ places; beta and main render different backgrounds.
**Fix:** Extract `css/cc-tokens.css` with single `:root`; import in all 3 files. LOE: 30 min.

---

**P1-2: Pricing page is a "Coming Soon" stub with no email capture**

`pricing.html` is 24 lines: "Career Coach Pro — Coming Soon" with no email signup. Every user who clicks "Pro" (from any CTA in the app) hits a dead end.

**Impact:** Zero revenue path, zero conversion data. The free-to-Pro funnel is broken at the gate.
**Fix:** Add email capture form (Formspree/Buttondown) with "Tell me when Pro launches" CTA. Pre-commit the Pro feature list (even rough). LOE: 1 h. This was AUDIT.md item 5 (April 2026, still open).

---

**P1-3: `--muted` on `--card` contrast unconfirmed**

`--muted: #8AA0B8` on `--card: #1A2D44` = ~3.9:1 (estimated). WCAG AA requires 4.5:1 for normal text. The muted colour is used extensively: `filter-btn` labels, `.sort-bar label`, `.stat-label`, `.job-title-co span` (company name), `.detail-company`. These are all UI-critical text nodes.

**Impact:** Screen reader / low-vision users cannot read company names or filter labels at WCAG AA.
**Fix:** Darken `--muted` to `#9DB5CC` or lighten `--card` by 5%. Need axe-core scan to confirm exact failures. LOE: 15 min once axe results are in.

---

## P2 Findings (polish, non-blocking)

**P2-1: `beta/index.html` uses different `--navy` and `--teal` token values**

`--teal` in index.html is `#2EC4B6`, in beta/index.html it's `#00C9A7` (different green-teal). These are visually distinct. The demo path and the live path render different brand colours.

**Fix:** Pull from cc-tokens.css once P1-1 is done — zero additional effort.

**P2-2: 40+ inline `onclick` handlers remain**

Flagged in April 2026 audit. Not a keyboard-a11y issue (all on `<button>` elements), but blocks Content Security Policy headers when Career Coach moves off GitHub Pages.

**Fix:** Event delegation pass — attach one listener per major section at the `<main>` level. LOE: 2-3 h.

**P2-3: `<html lang>` stays `en-CA` when French UI is active**

`toggleLang()` swaps `data-en`/`data-fr` content but doesn't update `document.documentElement.lang`. Screen readers announce the language as English while reading French text.

**Fix:** Add `document.documentElement.lang = lang === 'fr' ? 'fr-CA' : 'en-CA'` to `toggleLang()`. LOE: 5 min.

**P2-4: "Private by design" BYOK framing not surfaced in UI**

The API key entry step has no "why this is good for you" framing. The PRODUCT.md explicitly says BYOK should "feel like a deliberate choice ('you control your data')". Currently the prompt is purely technical.

**Fix:** Add one sentence callout in the API key step: "Your key is stored in your browser only — never sent to our servers." LOE: 5 min.

---

## Shape Brief — Pricing Page Redesign

**Trigger:** P1-2 above. Pricing page needs a real page before any Pro outreach or conversion.

**What it should be:**
- Not a product tour — a decision page. The user already uses Career Coach; this page tells them what Pro unlocks.
- 3-tier layout: Free (current), Pro ($X/mo), Team ($Y/mo — placeholder)
- Pro differentiators (best guesses for Aaron to confirm): saved analysis history, team sharing, ATS keyword export, priority model access
- Email capture above the fold: "Pro isn't live yet. Get notified when it ships." Formspree.

**Aaron sign-off needed on:**
1. Pro feature list (what does Pro actually include?)
2. Pricing ($X/month — suggest $9.99 CA as starting anchor)
3. Team tier: yes/no?

---

## What Changed Since April 2026 Audit

| April finding | June status |
|--------------|-------------|
| Google Fonts CDN | ✅ Fixed — self-hosted DM Sans + DM Serif |
| Skip link missing | ✅ Fixed |
| lang="en" wrong | ✅ Fixed to en-CA |
| Provider picker not wired | ✅ Fixed (S-CC-PORTABILITY) |
| axe-core CI missing | ✅ Fixed |
| Cross-promotion Clarity/DCC | ✅ Fixed |
| Pricing page Coming Soon stub | ⚠️ Still open (P1-2 above) |
| Pro email capture | ⚠️ Still open (P1-2 above) |
| Inline onclick handlers (40+) | ⚠️ Still open (P2-2 above) |
| lang toggle FR not updating | ⚠️ Still open (P2-3 above) |

---

## Founding Board — Abbreviated Verdicts (Stage 3 audit)

**Vera (WCAG / a11y):** P1-3 is a real WCAG AA failure. `--muted` at 3.9:1 is below the 4.5:1 threshold for normal text. Company name in job cards is critical information — not decorative. Run axe-core immediately to get the full finding list; this will block library or employer demos if not fixed. APPROVED with P1-3 as mandatory pre-demo fix.

**Kwame (ethics / sovereignty):** BYOK model is correct — zero server-side storage. P2-4 (missing privacy framing at API entry) is a trust gap. For job seekers sharing CV content and salary data, making the data-sovereignty guarantee visible is not optional. File it as P1 if this is going into library or employer demos. APPROVED.

**Frank (scrappy execution):** 3 items: token file (30 min), lang toggle fix (5 min), BYOK callout (5 min). That's 40 minutes that removes P1 blockers and 2 P2s simultaneously. Do them before the next demo. Pricing page needs Aaron's feature decision first — no point building a page around "TBD". APPROVED with 40-min cleanup sprint recommended.

**Nadia (user empathy):** A job seeker opening Career Coach for the first time: the dark interface reads as "professional tool" not "hacker terminal" — correct. The score circle (big coloured number) is the single most useful UI element — it immediately answers "should I apply?" Gate 0 (link verification) is prominent and explains why. The main friction: the onboarding wizard asks for API key in step 1, which feels like a technical barrier. Consider hiding the key behind a "Try it first" demo mode. Not blocking now, but note for Pro launch UX. APPROVED.

**Overall verdict: APPROVED.** P1-1 (token file) and P1-3 (muted contrast) must ship before any external demo. P1-2 (pricing page) needs Aaron decision on Pro features before build.

---

## Aaron Actions Required

1. **Decide Pro feature list** — what does Career Coach Pro include beyond the free tier? (P1-2 is blocked on this)
2. **Confirm pricing anchor** — $9.99 CA/month as starting point? Or different model?
3. **Optional: demo mode** — "Try Career Coach without an API key" — worth it before library pitch?

LOE per action: 15-30 min each (thinking + decision, not build).

---

## Sprint Recommendation: S-CAREERCOACH-P1-FIXES

**Scope:** P1-3 + P2-2 cleanup + P2-3 + P2-4 (the items not gated on Aaron's decision)
**LOE:** ~45 min
**What it ships:** Token architecture (cc-tokens.css), lang toggle fix (5 min), BYOK framing (5 min), muted contrast fix (15 min after axe-core confirms)
**Aaron action first:** none — these are all agent-doable
**Blocked until Aaron decides:** pricing page (P1-2)
