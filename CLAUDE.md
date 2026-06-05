# CLAUDE.md — Career Coach

## Project Identity
- Owner: Aaron Patzalek · Two Birds Innovation
- Product: Career Coach — seven-tool AI job hunt assistant for mid-to-senior professionals
- Audience: Job-seeking professionals (10–20 years experience); desktop-primary, mobile-secondary
- Stack: Static HTML/CSS/JavaScript only. No frameworks, no backend, no build tools.
- Deployment: GitHub Pages (`twobirds-kramerica.github.io/career-coach`)
- HAL Stack global context: `C:\twobirds\two-birds-portfolio\CLAUDE.md`

## Hard Constraints (Never Violate)
- STATIC ONLY: No Node.js, no npm, no build steps, no backend APIs.
- BYOK MODEL: Career Coach uses Bring Your Own API Key. The user's LLM API key is stored in their browser (localStorage). It is NEVER transmitted to any Two Birds server. All LLM calls go directly from the user's browser to the LLM provider (Anthropic/OpenAI). Do not introduce any server-side proxy for LLM calls without a new ADR and Aaron's explicit approval.
- PROMPT PRIVACY: Never log, transmit, or store user prompt content or LLM responses to any Two Birds endpoint. The user's job search data is private.
- FONT INTEGRITY: DM Sans + DM Serif Display are self-hosted (SIL OFL). Do not swap these for Google Fonts CDN or any CDN-delivered font. Verify self-hosted font files exist before referencing them.

## BYOK UX Rule
The API key setup flow must feel like a deliberate user choice ("you control your data"), not a technical hurdle. Keep the provider picker and key entry clear, minimal, and confidence-building. Never hide or de-emphasise the BYOK framing.

## Design Principles (from PRODUCT.md)
1. The job posting is the centre of gravity — every tool orbits a specific job
2. Verify before you build — Gate 0 (link verification, aggregator detection) must be visually prominent
3. Action indicators over status labels — show what needs to happen next, not just current state
4. BYOK is a feature — frame it as user control, not a limitation
5. Trust the user's judgment — AI generates, human decides; no friction between reading output and acting

## Anti-references (never ship anything resembling these)
- Affirmation-style language: "You've got this!", "Your dream job is waiting!" — banned
- Overbuilt dashboards with 20+ visible metrics
- Dark "hacker terminal" aesthetic (wrong audience)
- LinkedIn-mimicking layouts
- Generic blue-and-white SaaS look

## Language — Career-Safe
Never guarantee job outcomes. Use hedged language:
- Allowed: "may help", "can support", "is likely to strengthen", "based on the posting"
- Banned: "will get you the job", "guaranteed to impress", "you will be hired"

## Known Audit Issues (June 4, 2026 — 11/20 score)
These are outstanding P1/P2 items — fix before shipping any sprint that touches the relevant area:
- **P1 `--bg` undefined:** A CSS custom property `--bg` is referenced but not defined in the root. Find and define it before any CSS sprint.
- **P1 DM Sans not in body stack:** The `font-family` declaration on `body` is missing DM Sans. Fix before any typography sprint.
- **P1 Modal focus traps missing:** All modals (salary, interview, ATS) must trap focus when open. Tab key must not escape the modal. Add `focustrap` logic before shipping any modal sprint.
- **P2 Side-stripe issues (x2):** Two components have a side-stripe accent that fails contrast or bleeds layout. Fix as part of any CSS pass on those components.

## Accessibility Standards
- WCAG 2.1 AA — contrast ≥ 4.5:1 body text, ≥ 3:1 large text/UI
- Dark mode: all modals must maintain contrast in dark mode. Test salary modal, interview modal, and ATS modal specifically before any dark mode sprint is marked done.
- Touch targets: modals must be thumb-navigable (minimum 44px touch targets)
- No autoplay, no attention-interrupting animations during active job search flow

## Commit Convention
- `feat(cc):` new feature
- `fix(cc):` bug fix
- `chore(cc):` maintenance, config, docs

## ADR Rule
Any sprint introducing a significant architectural change (new LLM provider, new data persistence strategy, new auth model) must file an ADR in `C:\twobirds\two-birds-portfolio\hal-stack\architecture\decisions\` before pushing.
