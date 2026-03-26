# Career Coach

AI-powered job application coaching tool by Two Birds Innovation.

**Live:** https://twobirds-kramerica.github.io/career-coach/

Built with: HTML, CSS, vanilla JS, Anthropic API (claude-haiku-4-5-20251001)
No frameworks. No build tools. Runs entirely in the browser.

## Features
- 3-step onboarding (profile, priorities, CV)
- AI-powered job analysis with composite scoring
- ATS match, fit score, salary match, AI displacement risk
- CV customisation with defendability slider
- Job tracker with status pipeline
- CSV export
- All data stays in your browser (localStorage)

## Setup
1. Open the app
2. Complete the 3-step onboarding
3. Add your Anthropic API key in Settings (⚙ icon)
4. Paste a job posting and click "Analyse this job"

Your API key and all job data is stored only in your browser — never on a server.

## Tech Stack
- Single `index.html` — no build step required
- Google Fonts: DM Serif Display + DM Sans
- Anthropic API: `claude-haiku-4-5-20251001` for scoring, `claude-haiku-4-5-20251001` for CV generation
- localStorage for all persistence
