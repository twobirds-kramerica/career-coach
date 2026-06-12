# Product

## Register

product

## Users

Actively job-searching professionals, primarily Aaron Patzalek and users like him: mid-to-senior level, 10-20 years experience, navigating a market that has shifted toward AI-first screening. BYOK model (bring your own API key) — users are technically comfortable enough to connect an LLM, but don't want to think about it once it's set up.

Primary task on any session: add a new job posting, get an analysis, generate a tailored cover letter or interview prep, and move forward in the application pipeline with confidence.

Secondary tasks: track the pipeline status across applications, identify which jobs need follow-up, run ATS keyword analysis before submitting.

## Product Purpose

Seven-tool AI job hunt assistant. Not a job board, not a resume builder — a suite of tools that augment the human judgment of a job seeker. The AI does the research and first drafts; the human makes the calls.

Success looks like: Aaron applies to a verified, canonical job posting with a tailored cover letter, verified ATS keywords, prepared interview answers, and a follow-up plan — all in under 30 minutes per application.

## Brand Personality

Trusted co-pilot. Competent without being cocky.

Tone: practical, efficient, plain English. Not motivational. Not cheerleading. "Here's what the job posting is asking for, here's where your CV fits, here's what to say."
Voice: like a sharp colleague who has done the research before the meeting. Gets to the point.

## Anti-references

- Career coaching apps with affirmation-style language ("You've got this!", "Your dream job is waiting!")
- Overbuilt dashboards with 20 metrics visible at once
- Dark "hacker terminal" aesthetic (wrong audience — senior professionals, not developers)
- LinkedIn-mimicking layouts (users are already fatigued by LinkedIn)
- Generic blue-and-white SaaS look — indistinguishable from every other HR tool

## Design Principles

1. **The job posting is the center of gravity.** Every tool orbits a specific job. The job card is not a list item — it's the primary context for all downstream work.
2. **Verify before you build.** Gate 0 (link verification, aggregator detection) must be visually prominent. The cost of working on a dead link is real.
3. **Action indicators over status labels.** Don't just say "Applied." Show what needs to happen next. Priority flags, overdue follow-up indicators, unverified links — these are operational signals, not just data.
4. **BYOK is a feature, not a constraint.** The provider picker and API key setup must feel like a deliberate choice ("you control your data") not a technical hurdle.
5. **Trust the user's judgment.** The AI generates; the human decides. No friction between reading the output and acting on it.

## Accessibility & Inclusion

- WCAG 2.1 AA — primary use is desktop during active job searching, but mobile must work for checking the pipeline on the go
- Dark mode: the current dark theme must maintain contrast across all modals (salary, interview, ATS — these pop up in the middle of work)
- Font: DM Sans + DM Serif Display (self-hosted, SIL OFL) — correct and distinctive. Maintain.
- Touch targets: not a primary mobile app but modals must be thumb-navigable
