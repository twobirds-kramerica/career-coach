# Career Coach — Product Roadmap

**Owner:** Aaron Patzalek | Two Birds Innovation
**Status:** Beta (live on GitHub Pages)
**Stack:** Static HTML/CSS/JS + Anthropic API (client-side)

---

## Phase 1 — Beta (Current) ✅
- 3-step onboarding (profile, priorities, CV)
- AI job analysis with composite scoring (ATS, fit, salary, AI risk)
- CV customisation with defendability slider
- Job tracker with status pipeline
- Cover letter generation (5 templates)
- Salary negotiation helper
- Red flags detector
- CSV export + JSON full data export
- Print jobs table
- Application report export
- Privacy-first: all data in browser, API key entered by user
- Bilingual EN/FR toggle
- Voice input on all fields

## Phase 2 — AI Analysis Enhancements
- CV feedback: AI analyses CV against specific job posting, suggests improvements
- Market insights: salary range data, demand trends per role
- Interview prep: AI generates likely questions based on job description
- Application follow-up reminders (browser notifications)
- Batch analysis: paste multiple job URLs, analyse in sequence

## Phase 3 — Claude API Integration
- LLM portability layer: swap between Claude, GPT-4o, Gemini, Ollama
- Configurable model selection (Haiku for speed, Sonnet for depth)
- Token usage tracking and cost estimation
- Offline mode: queue analyses for when API key is available

## Phase 4 — Growth
- Shareable job comparison reports (static HTML export)
- Portfolio mode: track applications across multiple job searches
- Achievement system: celebrate milestones (10 applications, first interview, etc.)
- White-label option for career counselling organisations

---

## Privacy Commitment

Career Coach will never:
- Store user data on a server
- Track user behaviour with analytics
- Require account creation
- Send data anywhere except the user-selected AI provider during analysis

All data stays in localStorage. Users can export everything as JSON and delete all data at any time.
