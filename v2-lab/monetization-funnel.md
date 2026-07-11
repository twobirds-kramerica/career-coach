# Career Coach v2 — Monetization Funnel Scope

**Status:** DRAFT — scoping only. No payment integration exists anywhere in the Two Birds stack (verified 2026-07-11: no Stripe/PayPal/processor code in any repo), so building one is out of scope until Aaron decides pricing and processor. This document defines what is free, what is advanced, and where a paid tier would slot in.
**Origin:** Aaron feedback item 6, 2026-07-06 dictation. Companion to ADR-0029 (built-in provider) and ADR-0005 (BYOK).

## The funnel logic

Cost structure drives the tiers. A verdict is one cheap Haiku-class call (fractions of a cent, capped by worker rate limits). Generation work (tailored CV, cover letter, interview prep) is multi-call, longer-output, higher-value — the natural gate.

| Tier | Who pays for tokens | What you get | Gate |
|---|---|---|---|
| **Free (default)** | Two Birds (capped: 10/hr/IP, 300/day global) | The triage layer: Gate Zero link check, verdict, ATS before/after, requirements scorecard, keyword table, gap directions | None. No account, no key. |
| **Advanced (BYOK)** | User (their key) or nobody (local Ollama) | Everything in Free with no rate caps, plus the generation layer: tailored CV suggestions, cover letter drafts, interview prep, salary scripts | User adds a key in step 1 (Advanced) |
| **Paid (future, undecided)** | Two Birds, funded by the user's payment | Generation layer without needing an API key; possibly saved history/pipeline sync | Payment — NOT BUILT. Needs Aaron: pricing, processor (Stripe = L3 per decapitation checklist), and an ADR |

## Why gate generation, not triage

- Triage is the differentiated promise ("we tell you when NOT to apply") — giving it away builds trust and is cheap to serve.
- Generation is where every competitor charges ($29–$40 USD/month: Teal, Jobscan, Rezi) and where token cost is real.
- BYOK as the advanced gate means the funnel works TODAY with zero payment infrastructure: the "upgrade" action is adding a key, which also removes Two Birds' cost exposure.

## What ships now (this build)

- Landing toolkit cards for Cover letter / Interview prep / Salary marked "Advanced — your own key" so the funnel is visible before the features land in v2.
- App copy already explains the two reasons to go BYOK (no limits, total privacy).

## Aaron decisions needed before a paid tier

1. Price point and unit (per package? monthly? CAD-first?).
2. Processor choice (Stripe is the obvious candidate; L3 sovereignty trade-off needs the decapitation checklist + an ADR).
3. Whether a paid tier is even wanted, versus keeping BYOK as the only advanced path (zero cost exposure, zero payment ops).
