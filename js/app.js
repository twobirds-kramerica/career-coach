// ── State ──
let profile = null;
let jobs = [];
let currentFilter = 'all';
let selectedJobId = null;

// ── LLM provider metadata (mirrors llm-provider.js options) ──
const PROVIDER_META = {
  anthropic: {
    label:       'Claude (Anthropic)',
    keyLabel:    'Anthropic API Key',
    placeholder: 'sk-ant-...',
    signupUrl:   'https://console.anthropic.com',
    signupText:  'Get an Anthropic API key →',
    needsKey:    true
  },
  openai: {
    label:       'GPT-4o (OpenAI)',
    keyLabel:    'OpenAI API Key',
    placeholder: 'sk-...',
    signupUrl:   'https://platform.openai.com/api-keys',
    signupText:  'Get an OpenAI API key →',
    needsKey:    true
  },
  gemini: {
    label:       'Gemini (Google)',
    keyLabel:    'Google AI Studio API Key',
    placeholder: 'AIza...',
    signupUrl:   'https://aistudio.google.com/apikey',
    signupText:  'Get a free Gemini API key →',
    needsKey:    true
  },
  ollama: {
    label:       'Ollama (local, no key)',
    keyLabel:    '',
    placeholder: '',
    signupUrl:   'https://ollama.com/download',
    signupText:  'Download Ollama (localhost:11434) →',
    needsKey:    false
  }
};

function getActiveProvider() {
  try { return localStorage.getItem('llm_provider') || 'anthropic'; }
  catch(e) { return 'anthropic'; }
}

function getActiveApiKey() {
  try {
    return localStorage.getItem('llm_api_key')
        || localStorage.getItem('cc_api_key')
        || '';
  } catch(e) { return ''; }
}

function renderSettingsForProvider(provider) {
  const meta = PROVIDER_META[provider] || PROVIDER_META.anthropic;
  const labelEl = document.getElementById('settingsApiKeyLabel');
  const inputEl = document.getElementById('settingsApiKey');
  const groupEl = document.getElementById('settingsApiKeyGroup');
  const linkEl  = document.getElementById('settingsGetKeyLink');
  if (labelEl) labelEl.textContent = meta.keyLabel || 'API key';
  if (inputEl) {
    inputEl.placeholder = meta.placeholder;
    inputEl.required = meta.needsKey;
  }
  if (groupEl) groupEl.style.display = meta.needsKey ? '' : 'none';
  if (linkEl) {
    linkEl.href = meta.signupUrl;
    linkEl.textContent = meta.signupText;
  }
}

// ── Init ──
function init() {
  try { profile = JSON.parse(localStorage.getItem('cc_profile')); } catch(e) {}
  try { jobs = JSON.parse(localStorage.getItem('cc_jobs')) || []; } catch(e) {}
  const provider = getActiveProvider();
  const providerEl = document.getElementById('settingsProvider');
  if (providerEl) providerEl.value = provider;
  renderSettingsForProvider(provider);
  const apiKey = getActiveApiKey();
  document.getElementById('settingsApiKey').value = apiKey;

  if (profile) showMainApp();
  else showOnboarding();

  document.getElementById('settingsBtn').onclick = openSettings;
  document.getElementById('settingsOverlay').onclick = closeSettings;

  // Demo card / history — hook textarea input event
  const jobInput = document.getElementById('jobInput');
  if (jobInput) {
    jobInput.addEventListener('input', updateDemoCardVisibility);
  }

  // Initial demo card visibility
  updateDemoCardVisibility();

  applyLang();
}

// ── Onboarding ──
function showOnboarding() {
  document.getElementById('onboarding').classList.remove('hidden');
  document.getElementById('main-app').classList.add('hidden');
}

function goStep(n) {
  [1,2,3].forEach(i => {
    document.getElementById('step'+i).classList.toggle('hidden', i !== n);
    const ws = document.getElementById('ws'+i);
    if (i < n) { ws.className = 'wizard-step done'; }
    else if (i === n) { ws.className = 'wizard-step active'; }
    else { ws.className = 'wizard-step'; }
  });
}

function getRadio(name) {
  const el = document.querySelector(`input[name="${name}"]:checked`);
  return el ? el.value : '';
}

function saveProfile() {
  profile = {
    name: document.getElementById('pName').value.trim(),
    status: document.getElementById('pStatus').value,
    minSalary: document.getElementById('pMinSal').value,
    targetSalary: document.getElementById('pTargetSal').value,
    location: document.getElementById('pLocation').value.trim(),
    hybrid: getRadio('hybrid'),
    remote: getRadio('remote'),
    relocate: getRadio('relocate'),
    preferredSectors: [...document.querySelectorAll('[name="sector"]:checked')].map(e => e.value),
    workType: getRadio('workType'),
    priorities: {
      salary: document.getElementById('p_salary').value,
      workLifeBalance: document.getElementById('p_wlb').value,
      security: document.getElementById('p_security').value,
      growth: document.getElementById('p_growth').value,
      culture: document.getElementById('p_culture').value
    },
    intensity: document.getElementById('pIntensity').value,
    gig: getRadio('gig'),
    values: [
      document.getElementById('pVal1').value.trim(),
      document.getElementById('pVal2').value.trim(),
      document.getElementById('pVal3').value.trim()
    ].filter(Boolean),
    industriesToAvoid: document.getElementById('pAvoidIndustries').value.trim(),
    companyTypesToAvoid: [...document.querySelectorAll('[name="avoidCompany"]:checked')].map(e => e.value),
    workArrangementsToAvoid: [...document.querySelectorAll('[name="avoidArrangement"]:checked')].map(e => e.value),
    otherAvoid: document.getElementById('pAvoidOther').value.trim(),
    cv: document.getElementById('pCV').value.trim(),
    coverLetter: document.getElementById('pCoverLetter').value.trim()
  };
  try {
    localStorage.setItem('cc_profile', JSON.stringify(profile));
  } catch(e) {
    if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
      alert('Browser storage is full. Export your data (CSV) and clear some old jobs to free up space.');
      return;
    }
  }
  showMainApp();
}

// ── Main app ──
function showMainApp() {
  document.getElementById('onboarding').classList.add('hidden');
  document.getElementById('main-app').classList.remove('hidden');
  renderJobList();
  updateJobStats();
}

// ── Filters & sort ──
function setFilter(f, btn) {
  currentFilter = f;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderJobList();
}

function renderJobList() {
  const sort = document.getElementById('sortSelect').value;
  let list = [...jobs];

  if (currentFilter !== 'all') {
    if (currentFilter === 'pending') {
      list = list.filter(j => !j.analysis);
    } else {
      list = list.filter(j => j.analysis && j.analysis.application_recommendation === currentFilter);
    }
  }

  const salaryScore = s => ({ 'above target': 3, 'at target': 2, 'not specified': 1, 'below target': 0 }[s] ?? 1);
  list.sort((a, b) => {
    if (sort === 'score') return (b.compositeScore||0) - (a.compositeScore||0);
    if (sort === 'ats') return ((b.analysis?.ats_score)||0) - ((a.analysis?.ats_score)||0);
    if (sort === 'date') return new Date(b.addedAt) - new Date(a.addedAt);
    if (sort === 'salary') return salaryScore(b.analysis?.salary_match) - salaryScore(a.analysis?.salary_match);
    return 0;
  });

  const container = document.getElementById('jobsList');
  document.getElementById('jobCount').textContent = jobs.length;
  renderStatsCard();

  if (!list.length) {
    container.innerHTML = `<div class="jobs-empty">${jobs.length ? 'No jobs match this filter.' : 'No jobs yet.<br>Paste a job posting on the right to get started.'}</div>`;
    return;
  }

  container.innerHTML = list.map(job => {
    const sc = job.compositeScore || 0;
    const scoreClass = sc >= 70 ? 'score-high' : sc >= 45 ? 'score-mid' : 'score-low';
    const rec = job.analysis?.application_recommendation || 'pending';
    const badgeClass = { 'apply custom': 'badge-apply-custom', 'apply generic': 'badge-apply-generic', 'skip': 'badge-skip', 'pending': 'badge-pending' }[rec] || 'badge-pending';
    const badgeLabel = rec === 'pending' ? 'Not Analysed' : rec.replace(/\b\w/g, c => c.toUpperCase());
    const risk = job.analysis?.ai_risk_rating || '';
    const riskClass = { low: 'risk-low', medium: 'risk-medium', high: 'risk-high' }[risk] || '';

    return `<div class="job-card${job.id === selectedJobId ? ' selected' : ''}" onclick="openJobDetail('${job.id}')">
      <div class="job-card-header">
        <div class="job-title-co">
          <strong>${job.analysis?.job_title || 'Untitled'}</strong>
          <span>${job.analysis?.company || 'Unknown Company'}</span>
        </div>
        <div class="score-circle ${scoreClass}">${sc}</div>
      </div>
      <div class="job-badges">
        <span class="badge ${badgeClass}">${badgeLabel}</span>
        ${risk ? `<span class="badge" style="display:flex;align-items:center;gap:4px;background:none;padding:2px 4px;"><span class="risk-dot ${riskClass}"></span><span style="font-size:0.72em;color:var(--muted);">AI ${risk}</span></span>` : ''}
        ${job.status && job.status !== 'Saved' ? `<span class="badge badge-pending">${job.status}</span>` : ''}
      </div>
    </div>`;
  }).join('');

  updateJobStats();
}

// ── Job Search Stats Card ──
function updateJobStats() {
  const card = document.getElementById('jobStatsCard');
  if (!card) return;
  if (jobs.length === 0) { card.classList.add('hidden'); return; }
  card.classList.remove('hidden');

  document.getElementById('statTotal').textContent = jobs.length;

  const analysed = jobs.filter(j => j.analysis);
  const fits = analysed.map(j => j.analysis.overall_fit).filter(v => typeof v === 'number');
  document.getElementById('statAvgFit').textContent = fits.length ? Math.round(fits.reduce((a,b) => a + b, 0) / fits.length) : '—';

  document.getElementById('statApply').textContent = analysed.filter(j => j.analysis.application_recommendation === 'apply custom').length;
  document.getElementById('statSkip').textContent = analysed.filter(j => j.analysis.application_recommendation === 'skip').length;

  const dates = jobs.map(j => j.addedAt).filter(Boolean).map(d => new Date(d)).filter(d => !isNaN(d));
  if (dates.length) {
    const earliest = new Date(Math.min(...dates));
    const days = Math.floor((Date.now() - earliest) / 86400000);
    document.getElementById('statDays').textContent = days;
  } else {
    document.getElementById('statDays').textContent = '—';
  }

  // Pipeline breakdown
  const pipelineSection = document.getElementById('pipelineSection');
  const pipelineBar = document.getElementById('pipelineBar');
  const statuses = ['Applied','Callback','Interview','Offer / Negotiating','Declined'];
  const colours = { Applied:'#2196F3', Callback:'#FF9800', Interview:'#9C27B0', 'Offer / Negotiating':'#4CAF50', Declined:'#F44336' };
  const counts = {};
  statuses.forEach(s => { counts[s] = jobs.filter(j => j.status === s).length; });
  const hasAny = statuses.some(s => counts[s] > 0);
  if (hasAny && pipelineSection && pipelineBar) {
    pipelineSection.style.display = '';
    pipelineBar.innerHTML = statuses.filter(s => counts[s] > 0).map(s =>
      '<span style="display:inline-flex;align-items:center;gap:4px;background:' + colours[s] + '22;border:1px solid ' + colours[s] + '44;border-radius:20px;padding:3px 10px;font-size:0.78em;font-weight:600;color:' + colours[s].replace('F','9') + '">' +
      '<span style="width:8px;height:8px;border-radius:50%;background:' + colours[s] + ';flex-shrink:0"></span>' +
      counts[s] + ' ' + s + '</span>'
    ).join('');
  } else if (pipelineSection) {
    pipelineSection.style.display = 'none';
  }

  // ── Priority action flags ──
  const flagsSection = document.getElementById('priorityFlags');
  const flagsBar     = document.getElementById('priorityFlagsBar');
  if (!flagsSection || !flagsBar) return;

  const flags = [];
  const now = Date.now();
  const FOLLOWUP_DAYS = 7;

  // Flag 1: jobs needing Gate 0 verification
  const needsVerify = jobs.filter(j =>
    j.posting_url && !j.verified_live && j.analysis
  );
  if (needsVerify.length) {
    flags.push({
      colour: '#F57C00',
      icon: '⚠',
      text: needsVerify.length + ' job' + (needsVerify.length > 1 ? 's need' : ' needs') + ' link verification (Gate 0)',
      jobId: needsVerify[0].id
    });
  }

  // Flag 2: aggregator sources without canonical URL
  const needsCanonical = jobs.filter(j =>
    j.is_aggregator && !j.canonical_url && j.analysis
  );
  if (needsCanonical.length) {
    flags.push({
      colour: '#E53935',
      icon: '🔍',
      text: needsCanonical.length + ' job' + (needsCanonical.length > 1 ? 's from' : ' from') + ' aggregators — find the employer\'s direct link',
      jobId: needsCanonical[0].id
    });
  }

  // Flag 3: applied jobs overdue for follow-up
  const overdueFollowUp = jobs.filter(j => {
    if (j.status !== 'Applied' || !j.statusDate) return false;
    const appliedMs = new Date(j.statusDate).getTime();
    const daysSince = (now - appliedMs) / 86400000;
    return daysSince >= FOLLOWUP_DAYS;
  });
  if (overdueFollowUp.length) {
    flags.push({
      colour: '#7B1FA2',
      icon: '📩',
      text: overdueFollowUp.length + ' application' + (overdueFollowUp.length > 1 ? 's' : '') + ' — ' + FOLLOWUP_DAYS + '+ days since applying, follow-up due',
      jobId: overdueFollowUp[0].id
    });
  }

  if (flags.length) {
    flagsSection.style.display = '';
    flagsBar.innerHTML = flags.map(f =>
      '<div style="display:flex;align-items:center;gap:8px;background:' + f.colour + '15;border-left:3px solid ' + f.colour + ';border-radius:0 6px 6px 0;padding:5px 10px;cursor:pointer;font-size:0.82em;color:' + f.colour + ';font-weight:600" onclick="openJobDetail(\'' + f.jobId + '\')">' +
      '<span>' + f.icon + '</span><span>' + f.text + '</span><span style="margin-left:auto;opacity:0.6">→</span></div>'
    ).join('');
  } else {
    flagsSection.style.display = 'none';
  }
}

// ── Stats Card ──
function renderStatsCard() {
  const card = document.getElementById('statsCard');
  if (!card) return;
  if (!jobs.length) { card.classList.add('hidden'); return; }
  const analysed = jobs.filter(j => j.analysis).length;
  const scored = jobs.filter(j => j.compositeScore > 0);
  const avgScore = scored.length ? Math.round(scored.reduce((s, j) => s + j.compositeScore, 0) / scored.length) : 0;
  const recommended = jobs.filter(j => j.analysis && j.analysis.application_recommendation && j.analysis.application_recommendation !== 'skip').length;
  const dates = jobs.map(j => new Date(j.addedAt)).filter(d => !isNaN(d.getTime()));
  const daysSince = dates.length ? Math.floor((Date.now() - Math.min(...dates.map(d => d.getTime()))) / 86400000) : 0;
  const isFr = currentLang === 'fr';
  card.classList.remove('hidden');
  card.innerHTML =
    '<div class="stat-item"><div class="stat-value">' + analysed + '</div><div class="stat-label">' + (isFr ? 'Analysées' : 'Analysed') + '</div></div>' +
    '<div class="stat-item"><div class="stat-value">' + (avgScore || '—') + '</div><div class="stat-label">' + (isFr ? 'Score moy.' : 'Avg Score') + '</div></div>' +
    '<div class="stat-item"><div class="stat-value">' + recommended + '</div><div class="stat-label">' + (isFr ? 'Recommandées' : 'Recommended') + '</div></div>' +
    '<div class="stat-item"><div class="stat-value">' + daysSince + '</div><div class="stat-label">' + (isFr ? 'Jours actif' : 'Days Active') + '</div></div>';
}

// ── Analysis ──
function buildProfileText() {
  if (!profile) return '';
  return `Name: ${profile.name || 'Not given'}
Employment status: ${profile.status}
Location: ${profile.location}
Minimum salary: $${profile.minSalary} CAD
Target salary: $${profile.targetSalary} CAD
Open to hybrid: ${profile.hybrid}
Open to remote: ${profile.remote}
Willing to relocate: ${profile.relocate}
Work intensity preference: ${profile.intensity}
Gig work acceptable: ${profile.gig}
Priority rankings (1=most important): Salary=${profile.priorities.salary}, Work-life balance=${profile.priorities.workLifeBalance}, Security=${profile.priorities.security}, Growth=${profile.priorities.growth}, Culture=${profile.priorities.culture}
Personal values: ${profile.values.join(', ')}

CV:
${profile.cv}

Sectors preferred: ${(profile.preferredSectors||[]).join(', ') || 'Not specified'}
Work type: ${profile.workType || 'Not specified'}
Industries to avoid: ${profile.industriesToAvoid || 'None'}
Company types to avoid: ${(profile.companyTypesToAvoid||[]).join(', ') || 'None'}
Work arrangements to avoid: ${(profile.workArrangementsToAvoid||[]).join(', ') || 'None'}
Other avoidances: ${profile.otherAvoid || 'None'}`;
}

// ── Gate 0: Aggregator detection ──────────────────────────────
const AGGREGATOR_DOMAINS = [
  'jobgether.com', 'bebee.com', 'indeed.com', 'ziprecruiter.com',
  'jobted.com', 'glassdoor.com', 'monster.ca', 'monster.com',
  'careerbuilder.ca', 'careerbuilder.com', 'simplyhired.ca', 'simplyhired.com',
  'talent.com', 'jooble.org', 'eluta.ca', 'workopolis.com', 'adzuna.ca',
  'jobs.lever.co'  // Lever is an ATS, NOT an aggregator — kept for awareness only
];
// Real ATS platforms (not aggregators — canonical sources):
const ATS_DOMAINS = [
  'greenhouse.io', 'lever.co', 'workday.com', 'taleo.net',
  'smartrecruiters.com', 'icims.com', 'myworkdayjobs.com', 'applytojob.com'
];

function detectAggregator(url) {
  if (!url) return null;
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    // Lever is a real ATS — not an aggregator
    if (ATS_DOMAINS.some(d => host.includes(d))) return null;
    const match = AGGREGATOR_DOMAINS.find(d => host.includes(d));
    return match || null;
  } catch(e) { return null; }
}

function openPostingUrl() {
  const url = document.getElementById('jobUrlInput')?.value?.trim();
  if (url) window.open(url, '_blank', 'noopener,noreferrer');
}

function markJobVerified(jobId) {
  const job = jobs.find(j => j.id === jobId);
  if (!job) return;
  job.verified_live = new Date().toISOString().slice(0, 10);
  saveJobs();
  openJobDetail(jobId);
}

function setCanonicalUrl(jobId) {
  const input = document.getElementById('canonicalUrlInput');
  if (!input) return;
  const url = input.value.trim();
  const job = jobs.find(j => j.id === jobId);
  if (!job) return;
  job.canonical_url = url;
  saveJobs();
  openJobDetail(jobId);
}

// Wire aggregator warning on URL input change
document.addEventListener('input', function(e) {
  if (e.target.id !== 'jobUrlInput') return;
  const url = e.target.value.trim();
  const warning = document.getElementById('aggregatorWarning');
  const openBtn = document.getElementById('btnUrlOpen');
  const helpLink = document.getElementById('aggregatorHelpLink');
  if (!warning) return;
  const match = detectAggregator(url);
  if (match) {
    warning.classList.remove('hidden');
    // Build a search link for the job title (extracted from textarea if present)
    const jobText = document.getElementById('jobInput')?.value || '';
    const titleMatch = jobText.match(/(?:job title|position|role)[:\s]+([^\n]+)/i);
    const searchQuery = encodeURIComponent((titleMatch?.[1] || 'this role') + ' careers site');
    if (helpLink) helpLink.href = 'https://www.google.ca/search?q=' + searchQuery;
  } else {
    warning.classList.add('hidden');
  }
  if (openBtn) openBtn.style.display = url ? 'inline-flex' : 'none';
});

async function analyseJob() {
  const jobText = document.getElementById('jobInput').value.trim();
  if (!jobText) { setStatus('Please paste a job posting first.', true); return; }
  const postingUrl = document.getElementById('jobUrlInput')?.value?.trim() || '';
  const aggregatorMatch = detectAggregator(postingUrl);

  const provider = getActiveProvider();
  const providerMeta = PROVIDER_META[provider] || PROVIDER_META.anthropic;
  const apiKey = getActiveApiKey();
  if (providerMeta.needsKey && !apiKey) { setStatus('Please add your ' + providerMeta.label + ' API key in Settings (⚙).', true); return; }

  setStatus('Analysing… this takes about 10 seconds.', false);
  document.getElementById('analyseBtn').disabled = true;

  const systemPrompt = `You are a career coach AI. Analyse the job posting against the candidate profile and return ONLY valid JSON with no markdown, no explanation, no code fences. Return exactly this structure:
{"job_title":"string","company":"string","ats_score":0-100,"overall_fit":0-100,"salary_match":"above target|at target|below target|not specified","ai_risk_rating":"low|medium|high","ai_risk_note":"string","gig_eligible":true/false,"culture_signals":["array"],"company_size_estimate":"startup (<50)|mid-size (50-500)|large (500+)|unknown","volatility_estimate":"low|medium|high","days_posted":null,"application_recommendation":"apply custom|apply generic|skip","recommendation_reason":"string","cv_gaps":["array"],"cv_strengths":["array"],"custom_cv_suggestions":["array"],"defendability_note":"string"}`;

  const userMsg = `CANDIDATE PROFILE:\n${buildProfileText()}\n\nJOB POSTING:\n${jobText}`;

  try {
    const raw = await llmChat(userMsg, { system: systemPrompt, maxTokens: 1500, provider: provider, apiKey: apiKey });
    let analysis;
    try { analysis = JSON.parse(raw); }
    catch(e) {
      const match = raw.match(/\{[\s\S]*\}/);
      analysis = match ? JSON.parse(match[0]) : {};
    }

    const job = {
      id: 'j' + Date.now(),
      addedAt: new Date().toISOString(),
      rawPosting: jobText,
      posting_url: postingUrl || null,
      canonical_url: null,
      verified_live: null,
      is_aggregator: !!aggregatorMatch,
      analysis,
      compositeScore: computeCompositeScore(analysis),
      status: 'Saved',
      statusDate: null,
      notes: '',
      cvVersions: []
    };

    jobs.unshift(job);
    saveJobs();
    renderJobList();
    // Save to analysis history
    saveToHistory(jobText, analysis, job.compositeScore);
    document.getElementById('jobInput').value = '';
    const urlInput = document.getElementById('jobUrlInput');
    if (urlInput) { urlInput.value = ''; }
    const aggregatorWarning = document.getElementById('aggregatorWarning');
    if (aggregatorWarning) aggregatorWarning.classList.add('hidden');
    const openBtn = document.getElementById('btnUrlOpen');
    if (openBtn) openBtn.style.display = 'none';
    setStatus('');
    updateDemoCardVisibility();
    // gtag('event', 'analysis_complete', { score: job.compositeScore });
    openJobDetail(job.id);

  } catch(err) {
    const isRate = err.message.includes('429') || err.message.toLowerCase().includes('rate');
    let errMsg;
    if (isRate) {
      errMsg = 'Rate limit reached — please wait a moment and try again.';
    } else if (err.message.includes('401') || err.message.toLowerCase().includes('auth')) {
      errMsg = 'Invalid API key. Check your key in Settings (⚙).';
    } else if (err.message.includes('429')) {
      errMsg = 'Too many requests — please wait a moment and try again.';
    } else if (err.message.includes('500') || err.message.includes('503')) {
      errMsg = 'The AI service is temporarily unavailable. Please try again in a few minutes.';
    } else {
      errMsg = 'Analysis failed. Check your internet connection and API key, then try again.';
    }
    setStatus(errMsg, true);
  } finally {
    document.getElementById('analyseBtn').disabled = false;
  }
}

function setStatus(msg, isErr) {
  const el = document.getElementById('analysisStatus');
  el.textContent = msg;
  el.className = 'analysis-status' + (isErr ? ' analysis-error' : '');
}

function computeCompositeScore(a) {
  if (!a || !a.ats_score) return 0;
  const salMap = { 'above target': 100, 'at target': 75, 'below target': 25, 'not specified': 50 };
  const riskMap = { low: 100, medium: 50, high: 0 };
  const recMap = { 'apply custom': 100, 'apply generic': 60, skip: 0 };
  return Math.round(
    (a.ats_score || 0) * 0.30 +
    (a.overall_fit || 0) * 0.25 +
    (salMap[a.salary_match] || 50) * 0.20 +
    (riskMap[a.ai_risk_rating] || 50) * 0.15 +
    (recMap[a.application_recommendation] || 50) * 0.10
  );
}

// ── Job Detail ──
function openJobDetail(id) {
  selectedJobId = id;
  renderJobList();
  const job = jobs.find(j => j.id === id);
  if (!job) return;

  document.getElementById('addJobPanel').classList.add('hidden');
  const panel = document.getElementById('jobDetailPanel');
  panel.classList.remove('hidden');

  const a = job.analysis || {};
  const sc = job.compositeScore || 0;
  const fillColour = sc >= 70 ? '#2ECC71' : sc >= 45 ? '#F39C12' : '#E74C3C';

  const statusOptions = ['Saved','Applied','Callback','Interview','Offer / Negotiating','Declined','Archived'];

  panel.innerHTML = `
    <div class="job-detail">
      <div class="detail-header">
        <div>
          <div class="detail-title">${a.job_title || 'Job'}</div>
          <div class="detail-company">${a.company || ''} &nbsp;·&nbsp; ${a.company_size_estimate || ''} &nbsp;·&nbsp; Volatility: ${a.volatility_estimate || 'unknown'}</div>
        </div>
        <button class="btn-close-detail" onclick="closeJobDetail()">✕ Close</button>
      </div>

      <!-- Gate 0: Verification status -->
      ${(() => {
        const isAgg = job.is_aggregator;
        const postUrl = job.posting_url;
        const canonUrl = job.canonical_url;
        const verified = job.verified_live;
        if (!postUrl && !isAgg && !canonUrl && !verified) return '';
        const verifiedBadge = verified
          ? `<span class="g0-badge g0-verified">✓ Verified live ${verified}</span>`
          : `<span class="g0-badge g0-unverified">⚠ Unverified</span>`;
        const aggBadge = isAgg
          ? `<span class="g0-badge g0-aggregator">⚠ Aggregator source</span>` : '';
        return `<div class="gate0-block">
          <div class="gate0-header">
            <span class="gate0-label">Gate 0 — Link Verification</span>
            ${verifiedBadge}${aggBadge}
          </div>
          ${postUrl ? `<div class="gate0-row"><span class="gate0-field-label">Posting URL</span><a href="${esc(postUrl)}" target="_blank" rel="noopener noreferrer" class="gate0-link">${esc(postUrl.length > 60 ? postUrl.slice(0,60)+'…' : postUrl)}</a></div>` : ''}
          ${canonUrl ? `<div class="gate0-row"><span class="gate0-field-label">Canonical URL</span><a href="${esc(canonUrl)}" target="_blank" rel="noopener noreferrer" class="gate0-link">${esc(canonUrl.length > 60 ? canonUrl.slice(0,60)+'…' : canonUrl)}</a></div>` : ''}
          <div class="gate0-actions">
            ${!verified ? `<button class="btn-g0" onclick="markJobVerified('${esc(job.id)}')">✓ Mark as verified today</button>` : ''}
            ${postUrl ? `<button class="btn-g0" onclick="window.open('${esc(postUrl)}','_blank','noopener')">Open posting ↗</button>` : ''}
            ${!canonUrl ? `<span class="gate0-canon-wrap"><input id="canonicalUrlInput" class="canonical-url-input" placeholder="Paste employer's direct ATS link…" type="url"><button class="btn-g0" onclick="setCanonicalUrl('${esc(job.id)}')">Save canonical URL</button></span>` : `<button class="btn-g0" onclick="window.open('${esc(canonUrl)}','_blank','noopener')">Open canonical ↗</button>`}
          </div>
        </div>`;
      })()}

      <!-- Score bars -->
      <div class="score-bars">
        <div class="score-bar-card">
          <div class="label">Composite Score</div>
          <div class="value" style="color:${fillColour}">${sc}</div>
          <div class="meter"><div class="meter-fill" style="width:${sc}%;background:${fillColour}"></div></div>
        </div>
        <div class="score-bar-card">
          <div class="label">ATS Match</div>
          <div class="value">${a.ats_score || '—'}</div>
          <div class="meter"><div class="meter-fill" style="width:${a.ats_score||0}%;background:var(--teal)"></div></div>
        </div>
        <div class="score-bar-card">
          <div class="label">Overall Fit</div>
          <div class="value">${a.overall_fit || '—'}</div>
          <div class="meter"><div class="meter-fill" style="width:${a.overall_fit||0}%;background:var(--purple)"></div></div>
        </div>
        <div class="score-bar-card">
          <div class="label">Salary Match</div>
          <div class="value" style="font-size:1em">${a.salary_match || '—'}</div>
          <div style="margin-top:6px;font-size:0.78em;color:var(--muted)">AI Risk: <span class="risk-dot ${a.ai_risk_rating==='low'?'risk-low':a.ai_risk_rating==='medium'?'risk-medium':'risk-high'}" style="vertical-align:middle"></span> ${a.ai_risk_rating||'unknown'}</div>
          <div style="font-size:0.78em;color:var(--muted);margin-top:3px">${a.ai_risk_note||''}</div>
        </div>
      </div>

      <!-- Recommendation -->
      <div class="detail-section" style="margin-bottom:16px;">
        <h3>Recommendation</h3>
        <span class="badge badge-${(a.application_recommendation||'pending').replace(' ','-')}" style="font-size:0.9em;padding:4px 12px">${(a.application_recommendation||'pending').replace(/\b\w/g,c=>c.toUpperCase())}</span>
        <p style="margin-top:10px;font-size:0.92em;line-height:1.6;color:var(--muted)">${a.recommendation_reason||''}</p>
      </div>

      <div class="detail-sections">
        ${a.culture_signals?.length ? `<div class="detail-section"><h3>Culture Signals</h3><div class="tag-list">${a.culture_signals.map(s=>`<span class="tag">${s}</span>`).join('')}</div></div>` : ''}

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
          ${a.cv_gaps?.length ? `<div class="detail-section"><h3>CV Gaps</h3>${a.cv_gaps.map(g=>`<div class="gap-item">${g}</div>`).join('')}</div>` : ''}
          ${a.cv_strengths?.length ? `<div class="detail-section"><h3>CV Strengths</h3>${a.cv_strengths.map(s=>`<div class="strength-item">${s}</div>`).join('')}</div>` : ''}
        </div>

        <!-- CV Customisation -->
        ${a.custom_cv_suggestions?.length ? `
        <div class="detail-section">
          <h3>CV Customisation <span class="pro-badge">Pro</span></h3>
          <div class="defend-row">
            <label>Tight (100% defensible)</label>
            <input type="range" class="defend-slider" id="defendSlider" min="0" max="100" value="50" oninput="filterSuggestions()">
            <label>Stretch (go further)</label>
          </div>
          <div id="suggestionsContainer">
            ${a.custom_cv_suggestions.map((s,i)=>`
              <div class="suggestion-card" data-idx="${i}">
                <input type="checkbox" id="sug${i}" checked>
                <label class="suggestion-text" for="sug${i}">${s}</label>
              </div>`).join('')}
          </div>
          <p style="font-size:0.8em;color:var(--muted);margin-top:8px">${a.defendability_note||''}</p>
          <button class="btn-gen-cv" onclick="generateCV('${job.id}')">Generate my tailored CV</button>
          <div id="cvOutputArea" class="hidden">
            <textarea class="cv-output" id="cvOutput" readonly></textarea>
            <button class="btn-copy" onclick="copyCV()">Copy to clipboard</button>
          </div>
        </div>` : ''}

        <!-- 6B: Red Flags -->
        ${buildRedFlagsHTML(a, job.rawPosting)}

        <!-- 6D: Industry Insights -->
        ${buildIndustryInsightsHTML(a.job_title || '')}

        <!-- CV Feedback / Strengthen -->
        <div class="detail-section" style="margin-top:16px;">
          <h3 data-en="Strengthen My CV" data-fr="Renforcer mon CV">Strengthen My CV</h3>
          <p style="font-size:0.88em;color:var(--muted);margin-bottom:4px;" data-en="Get a detailed CV review tailored to this specific job posting." data-fr="Obtenez une analyse détaillée de votre CV adaptée à cette offre d'emploi.">Get a detailed CV review tailored to this specific job posting.</p>
          <p style="font-size:0.78em;color:var(--muted);margin-bottom:8px;" data-en="🔒 Your CV is only sent to the AI during this analysis — never stored on a server." data-fr="🔒 Votre CV n'est envoyé à l'IA que pendant cette analyse — jamais stocké sur un serveur.">🔒 Your CV is only sent to the AI during this analysis — never stored on a server.</p>
          <button class="btn-salary-neg" onclick="strengthenCV('${job.id}')" id="btn-strengthen-${job.id}" data-en="📝 Analyse my CV for this role" data-fr="📝 Analyser mon CV pour ce poste">📝 Analyse my CV for this role</button>
          <div id="cv-feedback-${job.id}" class="hidden" style="margin-top:12px;"></div>
        </div>

        <!-- 6A: Salary Negotiation button -->
        <div class="detail-section" style="margin-top:16px;">
          <h3 data-en="Salary Negotiation" data-fr="Négociation salariale">Salary Negotiation</h3>
          <p style="font-size:0.88em;color:var(--muted);margin-bottom:4px;" data-en="Get AI-generated negotiation tactics specific to this role." data-fr="Obtenez des tactiques de négociation générées par l'IA pour ce poste.">Get AI-generated negotiation tactics specific to this role.</p>
          <button class="btn-salary-neg" onclick="openSalaryModal('${job.id}')" data-en="💰 Help me negotiate salary" data-fr="💰 Aider à négocier le salaire">💰 Help me negotiate salary</button>
        </div>

        <!-- 6B: Cover Letter Generator -->
        <div class="detail-section" style="margin-top:16px;">
          <h3 data-en="Cover Letter" data-fr="Lettre de motivation">Cover Letter</h3>
          <p style="font-size:0.88em;color:var(--muted);margin-bottom:4px;" data-en="Generate a tailored cover letter for this specific role using your CV and profile." data-fr="Générez une lettre de motivation adaptée pour ce poste en utilisant votre CV et votre profil.">Generate a tailored cover letter for this specific role using your CV and profile.</p>
          <button class="btn-salary-neg" onclick="openCoverLetterModal('${job.id}')" data-en="✉️ Generate cover letter" data-fr="✉️ Générer la lettre de motivation">✉️ Generate cover letter</button>
        </div>

        <!-- 6C: Interview Prep -->
        <div class="detail-section" style="margin-top:16px;">
          <h3 data-en="Interview Prep" data-fr="Préparation à l'entretien">Interview Prep</h3>
          <p style="font-size:0.88em;color:var(--muted);margin-bottom:4px;" data-en="Get likely interview questions, answer frameworks, and smart questions to ask — tailored to this role." data-fr="Obtenez des questions d'entretien probables, des cadres de réponse et des questions intelligentes à poser — adaptés à ce poste.">Get likely interview questions, answer frameworks, and smart questions to ask — tailored to this role.</p>
          <button class="btn-salary-neg" onclick="openInterviewModal('${job.id}')" data-en="🎤 Prepare for interview" data-fr="🎤 Se préparer à l'entretien">🎤 Prepare for interview</button>
        </div>

        <!-- 6E: ATS Keywords -->
        <div class="detail-section" style="margin-top:16px;">
          <h3 data-en="ATS Keyword Analysis" data-fr="Mots-clés ATS">ATS Keyword Analysis</h3>
          <p style="font-size:0.88em;color:var(--muted);margin-bottom:4px;" data-en="Find the keywords an ATS is likely scanning for — and see which are missing from your CV." data-fr="Trouvez les mots-clés qu'un ATS est susceptible de scanner — et voyez lesquels manquent dans votre CV.">Find the keywords an ATS is likely scanning for — and see which are missing from your CV.</p>
          <button class="btn-salary-neg" onclick="openAtsModal('${job.id}')" data-en="🔍 Analyse ATS keywords" data-fr="🔍 Analyser les mots-clés ATS">🔍 Analyse ATS keywords</button>
        </div>

        <!-- 6D: Follow-Up Email -->
        <div class="detail-section" style="margin-top:16px;">
          <h3 data-en="Follow-Up Email" data-fr="Courriel de suivi">Follow-Up Email</h3>
          <p style="font-size:0.88em;color:var(--muted);margin-bottom:4px;" data-en="Generate a professional thank-you or follow-up email after an interview or application — the step most candidates skip." data-fr="Générez un courriel de remerciement ou de suivi professionnel après un entretien ou une candidature — l'étape que la plupart des candidats sautent.">Generate a professional thank-you or follow-up email after an interview — the step most candidates skip.</p>
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px;">
            <button class="btn-salary-neg" onclick="openFollowUpModal('${job.id}','post-interview')" style="font-size:0.85em" data-en="📩 After interview" data-fr="📩 Après l'entretien">📩 After interview</button>
            <button class="btn-salary-neg" onclick="openFollowUpModal('${job.id}','after-apply')" style="font-size:0.85em" data-en="📩 After applying" data-fr="📩 Après candidature">📩 After applying</button>
          </div>
        </div>

        <!-- Job Tracker -->
        <div class="detail-section">
          <h3>Job Tracker <span class="pro-badge">Pro</span></h3>
          <div class="tracker-row">
            <div class="field-group">
              <label>Status</label>
              <select id="trackerStatus" onchange="updateTrackerStatus('${job.id}')">
                ${statusOptions.map(s=>`<option${s===job.status?' selected':''}>${s}</option>`).join('')}
              </select>
            </div>
            <div class="field-group">
              <label>Date Applied</label>
              <input type="date" id="trackerDate" value="${job.statusDate||''}" onchange="updateTrackerDate('${job.id}')">
            </div>
          </div>
          <textarea class="tracker-notes" id="trackerNotes" placeholder="Notes..." onblur="updateTrackerNotes('${job.id}')">${job.notes||''}</textarea>
          <button class="btn-secondary" style="margin-top:8px;font-size:0.82em" onclick="viewOriginalPosting('${job.id}')">View original posting</button>
        </div>
      </div>
    </div>`;
}

function closeJobDetail() {
  selectedJobId = null;
  document.getElementById('addJobPanel').classList.remove('hidden');
  document.getElementById('jobDetailPanel').classList.add('hidden');
  renderJobList();
  updateDemoCardVisibility();
}

function filterSuggestions() {
  // Stretch slider — show all at 100, only first half at 0 (simplified)
  const val = parseInt(document.getElementById('defendSlider')?.value || 50);
  const cards = document.querySelectorAll('.suggestion-card');
  const cutoff = Math.ceil(cards.length * (val / 100 + 0.3));
  cards.forEach((c, i) => { c.style.opacity = i < cutoff ? '1' : '0.4'; });
}

async function generateCV(jobId) {
  const job = jobs.find(j => j.id === jobId);
  if (!job) return;
  const provider = getActiveProvider();
  const providerMeta = PROVIDER_META[provider] || PROVIDER_META.anthropic;
  const apiKey = getActiveApiKey();
  if (providerMeta.needsKey && !apiKey) { alert('Add your ' + providerMeta.label + ' API key in Settings first.'); return; }

  const checked = [...document.querySelectorAll('.suggestion-card')]
    .filter(c => c.querySelector('input[type=checkbox]').checked)
    .map(c => c.querySelector('.suggestion-text').textContent);

  if (!checked.length) { alert('Select at least one suggestion to apply.'); return; }

  const btn = document.querySelector('.btn-gen-cv');
  btn.innerHTML = '⏳ Generating your tailored CV…'; btn.disabled = true;

  try {
    const cvPrompt = `Rewrite this CV incorporating exactly these approved changes:\n${checked.map((c,i)=>`${i+1}. ${c}`).join('\n')}\n\nKeep everything else identical. Return only the full CV text, no explanation.\n\nORIGINAL CV:\n${profile.cv}`;
    const text = await llmChat(cvPrompt, { maxTokens: 2000, provider: provider, apiKey: apiKey });
    document.getElementById('cvOutput').value = text;
    document.getElementById('cvOutputArea').classList.remove('hidden');
    job.cvVersions = job.cvVersions || [];
    job.cvVersions.push({ date: new Date().toISOString(), text });
    saveJobs();
    // gtag('event', 'cv_customised', { job_id: jobId });
  } catch(err) {
    const isQuota = err.message && err.message.toLowerCase().includes('quota');
    const isKey   = err.message && (err.message.includes('401') || err.message.toLowerCase().includes('auth'));
    let msg;
    if (isKey)   msg = 'Invalid API key. Check your key in Settings (⚙) and try again.';
    else if (isQuota) msg = 'CV is too long to process. Try shortening your CV in your profile.';
    else         msg = 'Could not generate CV. Check your API key and internet connection, then try again.';
    const errEl = document.createElement('p');
    errEl.style.cssText = 'color:var(--red,#c0392b);font-size:0.88em;margin-top:8px;';
    errEl.textContent = msg;
    btn.parentNode.insertBefore(errEl, btn.nextSibling);
    setTimeout(function(){ if (errEl.parentNode) errEl.parentNode.removeChild(errEl); }, 8000);
  } finally {
    btn.innerHTML = 'Generate my tailored CV'; btn.disabled = false;
  }
}

async function strengthenCV(jobId) {
  var job = jobs.find(function(j) { return j.id === jobId; });
  if (!job) return;
  var provider = getActiveProvider();
  var providerMeta = PROVIDER_META[provider] || PROVIDER_META.anthropic;
  var apiKey = getActiveApiKey();
  if (providerMeta.needsKey && !apiKey) { alert('Add your ' + providerMeta.label + ' API key in Settings first.'); return; }
  if (!profile || !profile.cv) { alert('Please add your CV in your profile first (Settings → Reset profile to update).'); return; }

  var btn = document.getElementById('btn-strengthen-' + jobId);
  var feedbackEl = document.getElementById('cv-feedback-' + jobId);
  if (!btn || !feedbackEl) return;

  btn.disabled = true;
  btn.textContent = '⏳ Analysing your CV…';
  feedbackEl.classList.remove('hidden');
  feedbackEl.innerHTML = '<p style="color:var(--muted);font-size:0.88em;">Reviewing your CV against this job posting…</p>';

  var prompt = 'You are a career coach. Analyse this CV against the job posting and provide specific, actionable feedback.\n\n' +
    'Return ONLY valid JSON with this structure:\n' +
    '{"overall_match":"strong|moderate|weak","summary":"2-sentence assessment","strengths":["3 specific CV strengths for this role"],"gaps":["3 specific gaps or weaknesses"],"improvements":["5 specific line-by-line improvement suggestions"],"keywords_missing":["keywords from the job posting missing from the CV"]}\n\n' +
    'CV:\n' + profile.cv + '\n\nJOB POSTING:\n' + (job.rawPosting || 'No posting text available');

  try {
    var raw = await llmChat(prompt, { maxTokens: 1500, provider: provider, apiKey: apiKey });
    var feedback;
    try { feedback = JSON.parse(raw); }
    catch(e) { var m = raw.match(/\{[\s\S]*\}/); feedback = m ? JSON.parse(m[0]) : null; }
    if (!feedback) throw new Error('Could not parse response.');

    var matchColour = feedback.overall_match === 'strong' ? 'var(--green,#27ae60)' : feedback.overall_match === 'weak' ? 'var(--red,#c0392b)' : 'var(--amber,#f39c12)';
    var html = '<div style="background:var(--bg-alt,#f8f9fa);border-radius:12px;padding:16px;border:1px solid var(--border,#e0e0e0);">';
    html += '<p style="font-weight:700;color:' + matchColour + ';font-size:0.95em;margin-bottom:8px;">Match: ' + (feedback.overall_match || '').toUpperCase() + '</p>';
    html += '<p style="font-size:0.88em;color:var(--text,#333);margin-bottom:12px;">' + (feedback.summary || '') + '</p>';
    if (feedback.strengths && feedback.strengths.length) {
      html += '<h4 style="font-size:0.85em;font-weight:700;margin-bottom:6px;">Strengths</h4>';
      html += feedback.strengths.map(function(s) { return '<p style="font-size:0.82em;color:var(--green,#27ae60);margin-bottom:4px;">✓ ' + s + '</p>'; }).join('');
    }
    if (feedback.gaps && feedback.gaps.length) {
      html += '<h4 style="font-size:0.85em;font-weight:700;margin:10px 0 6px;">Gaps</h4>';
      html += feedback.gaps.map(function(g) { return '<p style="font-size:0.82em;color:var(--red,#c0392b);margin-bottom:4px;">✗ ' + g + '</p>'; }).join('');
    }
    if (feedback.improvements && feedback.improvements.length) {
      html += '<h4 style="font-size:0.85em;font-weight:700;margin:10px 0 6px;">Specific Improvements</h4>';
      html += '<ol style="font-size:0.82em;padding-left:20px;margin:0;">';
      html += feedback.improvements.map(function(i) { return '<li style="margin-bottom:4px;">' + i + '</li>'; }).join('');
      html += '</ol>';
    }
    if (feedback.keywords_missing && feedback.keywords_missing.length) {
      html += '<h4 style="font-size:0.85em;font-weight:700;margin:10px 0 6px;">Missing Keywords</h4>';
      html += '<p style="font-size:0.82em;color:var(--muted);">' + feedback.keywords_missing.join(', ') + '</p>';
    }
    html += '</div>';
    feedbackEl.innerHTML = html;
  } catch(err) {
    feedbackEl.innerHTML = '<p style="color:var(--red,#c0392b);font-size:0.88em;">Could not analyse CV: ' + (err.message || 'Unknown error') + '</p>';
  } finally {
    btn.disabled = false;
    btn.textContent = '📝 Analyse my CV for this role';
  }
}

function copyCV() {
  const t = document.getElementById('cvOutput');
  navigator.clipboard.writeText(t.value).then(() => {
    const btn = document.querySelector('.btn-copy');
    btn.textContent = 'Copied!';
    setTimeout(() => btn.textContent = 'Copy to clipboard', 2000);
  });
}

function viewOriginalPosting(jobId) {
  const job = jobs.find(j => j.id === jobId);
  if (!job) return;
  const w = window.open('', '_blank', 'width=700,height=600,scrollbars=yes');
  w.document.write(`<pre style="font-family:sans-serif;padding:20px;white-space:pre-wrap">${job.rawPosting.replace(/</g,'&lt;')}</pre>`);
}

function updateTrackerStatus(jobId) {
  const job = jobs.find(j => j.id === jobId);
  if (!job) return;
  job.status = document.getElementById('trackerStatus').value;
  if (job.status === 'Applied' && !job.statusDate) {
    job.statusDate = new Date().toISOString().split('T')[0];
    const dateEl = document.getElementById('trackerDate');
    if (dateEl) dateEl.value = job.statusDate;
  }
  saveJobs();
}
function updateTrackerDate(jobId) {
  const job = jobs.find(j => j.id === jobId);
  if (job) { job.statusDate = document.getElementById('trackerDate').value; saveJobs(); }
}
function updateTrackerNotes(jobId) {
  const job = jobs.find(j => j.id === jobId);
  if (job) { job.notes = document.getElementById('trackerNotes').value; saveJobs(); }
}

// ── Export ──
function exportCSV() {
  const headers = ['Job Title','Company','Date Added','Status','Composite Score','ATS Score','Fit Score','Salary Match','AI Risk','Recommendation','Date Applied','Notes'];
  const rows = jobs.map(j => [
    j.analysis?.job_title || '',
    j.analysis?.company || '',
    j.addedAt?.split('T')[0] || '',
    j.status || '',
    j.compositeScore || 0,
    j.analysis?.ats_score || '',
    j.analysis?.overall_fit || '',
    j.analysis?.salary_match || '',
    j.analysis?.ai_risk_rating || '',
    j.analysis?.application_recommendation || '',
    j.statusDate || '',
    (j.notes || '').replace(/"/g,'""')
  ].map(v => `"${v}"`).join(','));

  const csv = [headers.join(','), ...rows].join('\n');
  const a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
  a.download = 'career-coach-jobs-' + new Date().toISOString().split('T')[0] + '.csv';
  a.click();
  // gtag('event', 'export_downloaded', { job_count: jobs.length });
}

function exportJSON() {
  var data = {
    exportDate: new Date().toISOString(),
    profile: profile,
    jobs: jobs
  };
  var a = document.createElement('a');
  a.href = 'data:application/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(data, null, 2));
  a.download = 'career-coach-backup-' + new Date().toISOString().split('T')[0] + '.json';
  a.click();
}

// ── Settings ──
function openSettings() {
  document.getElementById('settings-panel').classList.add('open');
  document.getElementById('settingsOverlay').classList.add('open');
}
function closeSettings() {
  document.getElementById('settings-panel').classList.remove('open');
  document.getElementById('settingsOverlay').classList.remove('open');
}
function saveApiKey() {
  const providerEl = document.getElementById('settingsProvider');
  const provider = (providerEl && providerEl.value) || 'anthropic';
  const meta = PROVIDER_META[provider] || PROVIDER_META.anthropic;
  const key = document.getElementById('settingsApiKey').value.trim();

  if (meta.needsKey && !key) {
    document.getElementById('settingsApiKey').focus();
    return;
  }

  try {
    localStorage.setItem('llm_provider', provider);
    if (meta.needsKey) {
      localStorage.setItem('llm_api_key', key);
      // keep legacy key in sync for backwards compatibility with older sessions
      localStorage.setItem('cc_api_key', key);
    } else {
      localStorage.removeItem('llm_api_key');
      localStorage.removeItem('cc_api_key');
    }
  } catch(e) {
    alert('Could not save settings — browser storage may be full.');
    return;
  }
  closeSettings();
  alert('Provider and key saved. (' + meta.label + ')');
}
function clearJobs() {
  if (!confirm('Clear all jobs? This cannot be undone.')) return;
  jobs = [];
  saveJobs();
  closeJobDetail();
  renderJobList();
  closeSettings();
}
function resetProfile() {
  if (!confirm('Reset your profile? You will return to the onboarding wizard.')) return;
  localStorage.removeItem('cc_profile');
  localStorage.removeItem('cc_jobs');
  profile = null;
  jobs = [];
  closeSettings();
  showOnboarding();
  goStep(1);
}

// ── Persist ──
function saveJobs() {
  try {
    localStorage.setItem('cc_jobs', JSON.stringify(jobs));
  } catch(e) {
    if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
      setStatus('Browser storage is full. Export your jobs (CSV) and remove old applications to free up space.', true);
    }
  }
}

// ── Voice Input ──
(function initVoice() {
  if (!('SpeechRecognition' in window) && !('webkitSpeechRecognition' in window)) {
    document.querySelectorAll('.mic-btn').forEach(b => b.style.display = 'none');
  }
})();

function startVoice(btn, targetId) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return;
  const rec = new SR();
  const lang = localStorage.getItem('cc_lang') === 'fr' ? 'fr-CA' : 'en-CA';
  rec.lang = lang;
  rec.interimResults = false;
  rec.maxAlternatives = 1;
  btn.classList.add('recording');
  rec.start();
  rec.onresult = function(e) {
    const transcript = e.results[0][0].transcript;
    const el = document.getElementById(targetId);
    if (el) el.value = (el.value ? el.value + ' ' : '') + transcript;
    btn.classList.remove('recording');
  };
  rec.onerror = function() { btn.classList.remove('recording'); };
  rec.onend = function() { btn.classList.remove('recording'); };
}

// ── Phase 10: Demo card, Keyboard shortcuts, History, Mobile polish ──

// ── Demo job posting (sample) ──
const DEMO_JOB = `Senior Product Manager — Acme Health Tech
Location: Toronto, ON (Hybrid — 2 days/week in office)
Salary: $110,000–$130,000 CAD + bonus + RRSP matching

About the Role:
Acme Health Tech is a fast-growing digital health company building software for primary care clinics across Canada. We're looking for an experienced Senior Product Manager to lead our patient-facing mobile product.

You'll work cross-functionally with engineering, design, clinical advisors, and external clinic partners to define and deliver features that improve patient outcomes.

Responsibilities:
- Own the product roadmap for our patient engagement platform (iOS + Android)
- Lead discovery, prioritisation, and delivery across 2 squads
- Define success metrics and run regular A/B tests and user research
- Collaborate with regulatory and clinical teams to ensure compliance with provincial health data requirements
- Present quarterly roadmap reviews to the executive team
- Mentor junior PMs on the team

Requirements:
- 5+ years of product management experience in a software company
- Experience in healthcare, health-tech, or regulated industries preferred
- Strong data analysis skills — comfortable with SQL and product analytics tools (Mixpanel, Amplitude)
- Track record of shipping mobile products used by 10,000+ users
- Excellent communication skills with both technical and non-technical stakeholders
- PMP or similar certification is a strong asset

Nice to Have:
- Experience with HL7/FHIR healthcare data standards
- French language skills
- Background in UX research

Why Join Us:
- Mission-driven company improving healthcare access for Canadians
- Flexible hybrid work with a collaborative, psychologically safe culture
- Comprehensive health benefits + 4 weeks vacation
- Annual learning budget of $2,000

Apply by sending your CV and a brief cover letter to careers@acmehealthtech.ca`;

// ── Try Demo ──
function tryDemo() {
  const textarea = document.getElementById('jobInput');
  if (!textarea) return;
  textarea.value = DEMO_JOB;
  textarea.focus();
  updateDemoCardVisibility();
  setStatus('Sample job loaded — click "Analyse this job" to see a real analysis.', false);
}

// ── Demo card visibility ──
function updateDemoCardVisibility() {
  const textarea = document.getElementById('jobInput');
  const demoCard = document.getElementById('demoCard');
  const historySection = document.getElementById('historySection');
  if (!textarea || !demoCard) return;

  const isEmpty = !textarea.value.trim();
  const history = getHistory();

  if (isEmpty && !history.length) {
    demoCard.classList.remove('hidden');
  } else {
    demoCard.classList.add('hidden');
  }

  if (history.length) {
    historySection.classList.remove('hidden');
    renderHistory();
  } else {
    historySection.classList.add('hidden');
  }
}

// ── History ──
const HISTORY_KEY = 'coach-history';
const MAX_HISTORY = 10;

function getHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; }
  catch(e) { return []; }
}

function saveToHistory(jobText, analysisResult, compositeScore) {
  const history = getHistory();
  const firstLine = jobText.trim().split('\n')[0] || '';
  const title = firstLine.length > 50 ? firstLine.substring(0, 50) + '…' : firstLine || 'Job Analysis';
  const entry = {
    id: 'h' + Date.now(),
    title,
    jobText,
    analysisResult,
    compositeScore,
    savedAt: new Date().toISOString()
  };
  history.unshift(entry);
  if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch(e) {
    /* Silent fail — history is a convenience feature */
  }
}

function renderHistory() {
  const history = getHistory();
  const list = document.getElementById('historyList');
  if (!list) return;

  list.innerHTML = history.map(entry => {
    const sc = entry.compositeScore || 0;
    const scoreClass = sc >= 70 ? 'history-score-high' : sc >= 45 ? 'history-score-mid' : sc > 0 ? 'history-score-low' : 'history-score-none';
    const date = entry.savedAt ? new Date(entry.savedAt).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }) : '';
    return `<div class="history-item" onclick="restoreHistory('${entry.id}')">
      <span class="history-item-title">${entry.title}</span>
      <span class="history-item-meta">${date}</span>
      ${sc > 0 ? `<span class="history-score ${scoreClass}">${sc}</span>` : '<span class="history-score history-score-none">—</span>'}
    </div>`;
  }).join('');
}

function restoreHistory(id) {
  const history = getHistory();
  const entry = history.find(h => h.id === id);
  if (!entry) return;
  const textarea = document.getElementById('jobInput');
  if (textarea) {
    textarea.value = entry.jobText;
    textarea.focus();
  }
  updateDemoCardVisibility();
  setStatus('Previous analysis restored — re-run to get a fresh result.', false);
}

// ── Keyboard shortcuts ──
function openKbdHelp() {
  document.getElementById('kbd-help-overlay').classList.remove('hidden');
}

function closeKbdHelp(e) {
  if (e && e.target !== document.getElementById('kbd-help-overlay') && e.target !== document.getElementById('kbd-close-btn')) return;
  document.getElementById('kbd-help-overlay').classList.add('hidden');
}

document.addEventListener('keydown', function(e) {
  const tag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
  const isEditable = tag === 'input' || tag === 'textarea' || tag === 'select';

  // Ctrl+Enter triggers analysis from anywhere
  if (e.ctrlKey && e.key === 'Enter') {
    e.preventDefault();
    document.getElementById('analyseBtn')?.click();
    return;
  }

  // Keys that only fire when NOT in a text field
  if (!isEditable) {
    if (e.key === '?') {
      e.preventDefault();
      openKbdHelp();
      return;
    }
    if (e.key === 'n' || e.key === 'N' || e.key === 'Enter') {
      const kbdOverlay = document.getElementById('kbd-help-overlay');
      if (!kbdOverlay.classList.contains('hidden')) return;
      e.preventDefault();
      const textarea = document.getElementById('jobInput');
      if (textarea && !textarea.closest('.hidden')) {
        textarea.focus();
        textarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }
  }

  // Escape: close help panel, then clear results/textarea
  if (e.key === 'Escape') {
    const kbdOverlay = document.getElementById('kbd-help-overlay');
    if (!kbdOverlay.classList.contains('hidden')) {
      kbdOverlay.classList.add('hidden');
      return;
    }
    // If detail panel is open, close it
    const detailPanel = document.getElementById('jobDetailPanel');
    if (detailPanel && !detailPanel.classList.contains('hidden')) {
      closeJobDetail();
      return;
    }
    // Otherwise clear textarea
    if (!isEditable) {
      const textarea = document.getElementById('jobInput');
      if (textarea) {
        textarea.value = '';
        setStatus('');
        updateDemoCardVisibility();
      }
    }
  }
});

// ── Language / i18n ──
let currentLang = localStorage.getItem('cc_lang') || 'en';

function applyLang() {
  document.querySelectorAll('[data-en]').forEach(el => {
    el.textContent = currentLang === 'fr' ? el.getAttribute('data-fr') : el.getAttribute('data-en');
  });
  const btn = document.getElementById('langToggleBtn');
  if (btn) btn.textContent = currentLang === 'fr' ? 'EN' : 'FR';
}

function toggleLang() {
  currentLang = currentLang === 'en' ? 'fr' : 'en';
  localStorage.setItem('cc_lang', currentLang);
  applyLang();
}

// ── Phase 9C: Cover Letter Templates ──
const COVER_LETTER_TEMPLATES = {
  standard: `[YOUR NAME]
[Your City, Province] | [your.email@example.com] | [Phone Number]
[Today's Date]

Hiring Manager
[COMPANY]
[Company Address]

Dear Hiring Manager,

I am writing to express my strong interest in the [ROLE] position at [COMPANY]. With [X years] of experience in [your field], I have developed a track record of [key achievement — e.g., leading cross-functional teams, delivering projects on time and under budget, growing client accounts]. I am confident that my background aligns closely with the requirements you have outlined, and I am excited by the opportunity to contribute to [COMPANY]'s mission.

In my most recent role as [Your Current/Last Title] at [Previous Company], I [describe a specific, measurable achievement — e.g., "led a team of six to redesign a client onboarding process, reducing time-to-activation by 40% and improving customer satisfaction scores by 18 points"]. I bring strong skills in [Skill 1], [Skill 2], and [Skill 3], and I am known for [a quality — e.g., clear communication, calm under pressure, collaborative problem-solving]. I am particularly drawn to [COMPANY] because of [specific reason — e.g., your commitment to sustainability, your reputation for innovation, your work in the healthcare sector].

I would welcome the opportunity to discuss how my experience can add value to your team. Thank you for your time and consideration. I look forward to hearing from you.

Sincerely,
[YOUR NAME]`,

  'career-change': `[YOUR NAME]
[Your City, Province] | [your.email@example.com] | [Phone Number]
[Today's Date]

Hiring Manager
[COMPANY]
[Company Address]

Dear Hiring Manager,

Although my career path has taken a different route than a traditional candidate for the [ROLE] at [COMPANY], I believe my transferable skills and genuine enthusiasm for this field make me a compelling fit. I am making a deliberate transition from [Previous Field] to [New Field], and I am bringing with me a set of capabilities that are directly applicable to the work your team does.

During my time in [Previous Field], I developed strong expertise in [Transferable Skill 1 — e.g., project coordination, stakeholder communication, data analysis, process improvement]. For example, [describe a specific achievement that maps to the new role — e.g., "I managed a portfolio of 12 accounts and coordinated deliverables across three departments, which mirrors the cross-functional coordination required in this role"]. I have also invested in building skills specific to this transition, including [relevant courses, certifications, or self-directed learning].

I understand that a career change requires some leap of faith on your part, and I appreciate that. I am eager to prove myself quickly, and I am prepared to do the work to close any knowledge gaps. I would love the chance to speak with you about how my background can serve [COMPANY] in new and unexpected ways. Thank you for your consideration.

Sincerely,
[YOUR NAME]`,

  return: `[YOUR NAME]
[Your City, Province] | [your.email@example.com] | [Phone Number]
[Today's Date]

Hiring Manager
[COMPANY]
[Company Address]

Dear Hiring Manager,

I am writing to apply for the [ROLE] position at [COMPANY]. After a period away from the workforce to [brief, neutral explanation — e.g., care for a family member, focus on personal health, pursue education], I am ready to re-enter the professional world with renewed focus and a strong desire to contribute. My earlier career in [Your Field] gave me a solid foundation, and I have spent time during my break keeping my skills current and preparing for this return.

Before my career break, I held positions where I [describe relevant responsibilities and achievements — e.g., "managed a team of eight and consistently exceeded quarterly targets"]. My core strengths include [Skill 1], [Skill 2], and [Skill 3], all of which remain highly relevant to the [ROLE]. During my time away, I also [briefly mention any relevant activity — e.g., completed an online certification in data analysis, volunteered as a project coordinator for a local non-profit, or kept current by following industry developments].

I am committed, reliable, and genuinely excited to bring my experience to [COMPANY]. I welcome the opportunity to speak with you and address any questions about my time away from the workforce. Thank you for considering my application.

Sincerely,
[YOUR NAME]`,

  mission: `[YOUR NAME]
[Your City, Province] | [your.email@example.com] | [Phone Number]
[Today's Date]

[Hiring Manager's Name]
[COMPANY]

Dear [Hiring Manager's Name],

I am writing to express my interest in the [ROLE] position at [COMPANY]. What draws me to your organisation is not just the role itself, but the mission behind the work. [One sentence about what specifically resonates — e.g., "Your commitment to expanding access to mental health services in underserved communities aligns deeply with the values that have guided my entire career."]

In my previous role as [Your Previous Title] at [Previous Organisation], I [describe a mission-aligned achievement — e.g., "led a programme that connected 2,000 newcomer families with settlement services, reducing wait times by 40% through process redesign and community partnerships"]. I bring [X years] of experience in [relevant area], and I am particularly drawn to environments where measurable impact matters more than corporate optics. I understand the realities of working within tight budgets and high expectations, and I thrive in that space.

I would welcome the opportunity to discuss how my experience and commitment to [COMPANY's] mission could contribute to your team's goals. Thank you for your time and for the important work you do.

Sincerely,
[YOUR NAME]`,

  startup: `[YOUR NAME]
[Your City, Province] | [your.email@example.com] | [Phone Number]
[Today's Date]

[Founder's Name or Hiring Manager]
[COMPANY]

Hi [First Name],

I came across the [ROLE] opening at [COMPANY] and it immediately caught my attention — not just because of the role itself, but because of what [COMPANY] is building. [One sentence about why the company genuinely excites you — e.g., "The way you're approaching [problem] is exactly the kind of creative, mission-driven work I want to be part of."]

I bring [X years] of experience in [relevant area], including [a specific, concrete achievement — e.g., "building a customer success function from scratch that scaled to 3,000 users in eight months"]. I thrive in environments where things move fast, where I have to wear multiple hats, and where my work has a visible impact on the company's direction. I am comfortable with ambiguity and I am the kind of person who figures things out rather than waiting for a playbook.

I would love to chat — even just a 20-minute call to learn more about where you're headed and see if there's a fit. Thanks for taking the time to read this.

[YOUR NAME]`
};

function loadCoverLetterTemplate() {
  const select = document.getElementById('clTemplateSelect');
  const area = document.getElementById('clTemplateArea');
  const textarea = document.getElementById('clTextarea');
  const key = select.value;

  if (!key) {
    area.classList.add('hidden');
    return;
  }

  let text = COVER_LETTER_TEMPLATES[key] || '';

  // Pre-fill [YOUR NAME] if profile name is set
  if (profile && profile.name) {
    text = text.replace(/\[YOUR NAME\]/g, profile.name);
  }

  textarea.value = text;
  area.classList.remove('hidden');
  textarea.focus();
}

function copyCoverLetter() {
  const textarea = document.getElementById('clTextarea');
  if (!textarea) return;
  navigator.clipboard.writeText(textarea.value).then(() => {
    const btn = document.querySelector('.btn-copy-cl');
    const isFr = currentLang === 'fr';
    btn.textContent = isFr ? 'Copié !' : 'Copied!';
    setTimeout(() => {
      btn.textContent = isFr ? 'Copier dans le presse-papiers' : 'Copy to clipboard';
    }, 2000);
  }).catch(() => {
    textarea.select();
    document.execCommand('copy');
  });
}

// ── 6B: Red Flags Detection ──
function detectRedFlags(analysis, rawPosting) {
  const flags = [];
  const posting = (rawPosting || '').toLowerCase();
  const a = analysis || {};

  // Salary concern
  if (a.salary_match === 'below target') flags.push({ cat: 'Salary', msg: 'Salary is below your target — consider whether this meets your minimum requirements.' });
  if (a.salary_match === 'not specified') flags.push({ cat: 'Salary', msg: 'No salary range is listed. Research market rates before applying or negotiating.' });

  // No company name
  if (!a.company || a.company === 'Unknown' || a.company === '') flags.push({ cat: 'Transparency', msg: 'Company name is not clearly stated. Anonymous postings can indicate opacity about the employer.' });

  // Vague description — check for very short or keyword-stuffed postings
  if (rawPosting && rawPosting.trim().length < 300) flags.push({ cat: 'Vague Description', msg: 'Job posting is very short. Legitimate roles usually include detailed responsibilities and requirements.' });

  // Excessive requirements — many "required" skills
  const reqMatches = (posting.match(/\brequired\b/g) || []).length;
  if (reqMatches >= 6) flags.push({ cat: 'Excessive Requirements', msg: `Posting uses "required" ${reqMatches} times. May indicate unrealistic expectations or qualification gatekeeping.` });

  // High turnover signals in text
  const turnoverSignals = ['fast-paced environment', 'hit the ground running', 'self-starter', 'no hand-holding', 'sink or swim', 'hustle', 'wear many hats', 'do whatever it takes'];
  const found = turnoverSignals.filter(s => posting.includes(s));
  if (found.length >= 2) flags.push({ cat: 'High Turnover Signs', msg: `Posting uses phrases associated with high-pressure or unstable environments: "${found.slice(0,2).join('", "')}"${found.length > 2 ? `, +${found.length-2} more` : ''}.` });

  // AI risk
  if (a.ai_risk_rating === 'high') flags.push({ cat: 'AI Replacement Risk', msg: 'This role has been flagged as high risk for AI disruption. Evaluate long-term role stability.' });

  // High volatility
  if (a.volatility_estimate === 'high') flags.push({ cat: 'Company Volatility', msg: 'Company or role volatility is estimated as high. Research news and employee reviews before proceeding.' });

  return flags;
}

function buildRedFlagsHTML(analysis, rawPosting) {
  const flags = detectRedFlags(analysis, rawPosting);
  const count = flags.length;
  const isFr = currentLang === 'fr';
  const summaryLabel = count === 0
    ? (isFr ? '⚠️ Signaux d\'alerte — Aucun détecté' : '⚠️ Red Flags — None detected')
    : (isFr ? `⚠️ Signaux d'alerte — ${count} détecté${count > 1 ? 's' : ''}` : `⚠️ Red Flags — ${count} detected`);

  const catFr = { 'Salary': 'Salaire', 'Transparency': 'Transparence', 'Vague Description': 'Description vague',
    'Excessive Requirements': 'Exigences excessives', 'High Turnover Signs': 'Signes de fort roulement',
    'AI Replacement Risk': 'Risque de remplacement IA', 'Company Volatility': 'Volatilité de l\'entreprise' };

  const body = count === 0
    ? `<p class="no-red-flags">${isFr ? 'Aucun signal d\'alerte majeur détecté pour cette offre.' : 'No major red flags detected for this posting.'}</p>`
    : flags.map(f => `<div class="red-flag-item"><div><strong style="font-size:0.82em;text-transform:uppercase;letter-spacing:0.3px;color:var(--red)">${isFr && catFr[f.cat] ? catFr[f.cat] : f.cat}:</strong> ${f.msg}</div></div>`).join('');

  return `<details class="red-flags-section"${count > 0 ? ' open' : ''}>
    <summary>${summaryLabel} <span class="rf-toggle"></span></summary>
    <div class="red-flags-body">${body}</div>
  </details>`;
}

// ── 6D: Industry Insights (static Canadian data) ──
const INDUSTRY_INSIGHTS = {
  tech: {
    label: 'Technology',
    timeToHire: '3–6 weeks',
    remote: '~55% hybrid or fully remote',
    skills: ['AI/ML literacy', 'Cloud (AWS/Azure/GCP)', 'DevOps/CI-CD', 'Cybersecurity', 'TypeScript/Python'],
    source: 'Two Birds Innovation sector summary, Q1 2026'
  },
  healthcare: {
    label: 'Healthcare',
    timeToHire: '4–8 weeks',
    remote: '~20% hybrid (clinical roles mostly in-person)',
    skills: ['EMR/EHR systems', 'Patient advocacy', 'Regulated environment', 'Bilingualism', 'Data privacy (PHIPA)'],
    source: 'Two Birds Innovation sector summary, Q1 2026'
  },
  trades: {
    label: 'Skilled Trades',
    timeToHire: '1–3 weeks',
    remote: '~5% (mostly on-site)',
    skills: ['Red Seal certification', 'Safety compliance', 'Blueprint reading', 'Equipment operation', 'Apprenticeship credentials'],
    source: 'Two Birds Innovation sector summary, Q1 2026'
  },
  education: {
    label: 'Education',
    timeToHire: '6–12 weeks',
    remote: '~30% hybrid (admin/curriculum roles)',
    skills: ['Curriculum design', 'Inclusive education', 'LMS platforms', 'French language', 'Special needs support'],
    source: 'Two Birds Innovation sector summary, Q1 2026'
  },
  finance: {
    label: 'Finance & Banking',
    timeToHire: '4–7 weeks',
    remote: '~40% hybrid',
    skills: ['Financial modelling', 'CPA/CFA credentials', 'Risk management', 'Regulatory compliance', 'Excel/Power BI'],
    source: 'Two Birds Innovation sector summary, Q1 2026'
  },
  retail: {
    label: 'Retail & Customer Service',
    timeToHire: '1–2 weeks',
    remote: '~10% (mostly in-person)',
    skills: ['POS systems', 'Inventory management', 'Customer relations', 'Bilingualism', 'Loss prevention'],
    source: 'Two Birds Innovation sector summary, Q1 2026'
  },
  nonprofit: {
    label: 'Non-Profit & Social Services',
    timeToHire: '5–9 weeks',
    remote: '~35% hybrid',
    skills: ['Grant writing', 'Community engagement', 'Program evaluation', 'Volunteer management', 'Donor relations'],
    source: 'Two Birds Innovation sector summary, Q1 2026'
  },
  marketing: {
    label: 'Marketing & Communications',
    timeToHire: '3–5 weeks',
    remote: '~50% hybrid or remote',
    skills: ['Digital marketing', 'SEO/SEM', 'Content strategy', 'Analytics (GA4)', 'Social media management'],
    source: 'Two Birds Innovation sector summary, Q1 2026'
  },
  logistics: {
    label: 'Logistics & Supply Chain',
    timeToHire: '2–4 weeks',
    remote: '~15% hybrid',
    skills: ['ERP systems (SAP)', 'Supply chain optimisation', 'Customs/import-export', 'Fleet management', 'Lean/Six Sigma'],
    source: 'Two Birds Innovation sector summary, Q1 2026'
  },
  government: {
    label: 'Government & Public Service',
    timeToHire: '8–16 weeks',
    remote: '~30% hybrid',
    skills: ['Policy analysis', 'Bilingualism (EN/FR)', 'GC Suite / Phoenix', 'Security clearance', 'Stakeholder engagement'],
    source: 'Two Birds Innovation sector summary, Q1 2026'
  },
  energy: {
    label: 'Clean Energy & Sustainability',
    timeToHire: '4–8 weeks',
    remote: '~25% hybrid',
    skills: ['Environmental assessment', 'Project management', 'Regulatory compliance', 'GIS / AutoCAD', 'Grant applications'],
    source: 'Two Birds Innovation sector summary, Q1 2026'
  }
};

function detectSector(jobTitle) {
  const t = (jobTitle || '').toLowerCase();
  if (/\b(software|developer|engineer|devops|data scientist|machine learning|ai|cloud|it |tech|product manager|scrum|agile|cybersec|full.?stack|front.?end|back.?end)\b/.test(t)) return 'tech';
  if (/\b(nurse|doctor|physician|health|clinic|hospital|pharma|medical|patient|therapist|dental|physiotherapy)\b/.test(t)) return 'healthcare';
  if (/\b(electrician|plumber|carpenter|welder|mechanic|hvac|trades|construction|millwright|ironworker)\b/.test(t)) return 'trades';
  if (/\b(teacher|principal|education|curriculum|instructor|professor|tutor|school|librarian|early childhood)\b/.test(t)) return 'education';
  if (/\b(accountant|finance|banker|investment|cpa|cfa|analyst|financial|auditor|controller|treasury)\b/.test(t)) return 'finance';
  if (/\b(retail|store|sales associate|cashier|customer service|merchandising|buyer)\b/.test(t)) return 'retail';
  if (/\b(non-profit|nonprofit|charity|social worker|community|fundrais|program coordinator|outreach)\b/.test(t)) return 'nonprofit';
  if (/\b(marketing|communications|content|copywriter|seo|social media|brand|pr|public relations|campaign)\b/.test(t)) return 'marketing';
  if (/\b(logistics|supply chain|warehouse|dispatcher|procurement|shipping|inventory|fleet)\b/.test(t)) return 'logistics';
  if (/\b(government|public serv|policy|federal|provincial|municipal|city of|town of|ministry|crown)\b/.test(t)) return 'government';
  if (/\b(energy|solar|wind|renewable|sustainability|environmental|cleantech|climate|carbon)\b/.test(t)) return 'energy';
  return null;
}

function buildIndustryInsightsHTML(jobTitle) {
  const sectorKey = detectSector(jobTitle);
  if (!sectorKey) return '';
  const d = INDUSTRY_INSIGHTS[sectorKey];
  const isFr = currentLang === 'fr';
  const heading = isFr ? `${d.label} — Marché de l'emploi au Canada` : `${d.label} — Hiring Landscape in Canada`;
  const lbl1 = isFr ? 'Délai moyen d\'embauche' : 'Avg. Time to Hire';
  const lbl2 = isFr ? 'Télétravail / Hybride' : 'Remote / Hybrid';
  const srcLabel = isFr ? `Source : ${d.source}` : `Source: ${d.source}`;
  return `<div class="industry-insights-card">
    <div class="ii-header">${heading}</div>
    <div class="ii-grid">
      <div class="ii-stat">
        <div class="ii-stat-label">${lbl1}</div>
        <div class="ii-stat-value">${d.timeToHire}</div>
      </div>
      <div class="ii-stat">
        <div class="ii-stat-label">${lbl2}</div>
        <div class="ii-stat-value">${d.remote}</div>
      </div>
    </div>
    <div class="ii-skills">${d.skills.map(s=>`<span class="ii-skill-tag">${s}</span>`).join('')}</div>
    <div class="ii-ai-note" style="margin-top:10px;font-size:0.82em;color:var(--muted);font-style:italic;border-top:1px solid var(--border);padding-top:8px;">${isFr ? 'Les rôles nécessitant du jugement et des relations humaines sont les plus résilients face à l\'automatisation par l\'IA.' : 'Roles requiring judgment and human connection are most resilient to AI automation.'}</div>
    <div class="ii-source">${srcLabel}</div>
  </div>`;
}

// ── 6A: Salary Negotiation Modal ──
let salaryModalJobId = null;

function openSalaryModal(jobId) {
  salaryModalJobId = jobId;
  const job = jobs.find(j => j.id === jobId);
  if (!job) return;
  const a = job.analysis || {};
  const titleText = `${a.job_title || 'Role'} — ${a.company || 'Company'}`;
  document.getElementById('salaryModalSub').textContent = titleText;
  document.getElementById('salaryModalBody').innerHTML = `<div class="salary-modal-loading" data-en="Generating negotiation strategy…" data-fr="Génération de la stratégie de négociation…">Generating negotiation strategy…</div>`;
  document.getElementById('salaryModalOverlay').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  fetchSalaryNegotiation(job);
}

function closeSalaryModal(e) {
  // If called from the overlay's onclick, only close when clicking the backdrop itself
  if (e && e.target && e.target.id !== 'salaryModalOverlay' && !e.currentTarget?.classList?.contains('salary-modal-close')) return;
  document.getElementById('salaryModalOverlay').classList.add('hidden');
  document.body.style.overflow = '';
}

async function fetchSalaryNegotiation(job) {
  const provider = getActiveProvider();
  const providerMeta = PROVIDER_META[provider] || PROVIDER_META.anthropic;
  const apiKey = getActiveApiKey();
  const a = job.analysis || {};
  const jobTitle = a.job_title || 'this role';
  const company = a.company || 'the company';

  if (providerMeta.needsKey && !apiKey) {
    document.getElementById('salaryModalBody').innerHTML = `<p style="color:var(--red);font-size:0.92em;">Please add your ${providerMeta.label} API key in Settings (⚙) first.</p>`;
    return;
  }

  const prompt = `Based on this job posting: ${jobTitle} at ${company}, generate salary negotiation advice for a Canadian job seeker. Include: 1) Estimated salary range in CAD, 2) A 2-paragraph negotiation script, 3) Three specific tactics for this role, 4) Two things NOT to say. Keep it practical and concise. Return ONLY valid JSON with this structure: {"salary_range":"string","script_para1":"string","script_para2":"string","tactics":["string","string","string"],"dont_say":["string","string"]}`;

  try {
    const raw = await llmChat(prompt, { maxTokens: 800, provider: provider, apiKey: apiKey });
    let neg;
    try { neg = JSON.parse(raw); }
    catch(e) {
      const match = raw.match(/\{[\s\S]*\}/);
      neg = match ? JSON.parse(match[0]) : null;
    }
    if (!neg) throw new Error('Could not parse negotiation response.');

    document.getElementById('salaryModalBody').innerHTML = `
      <div class="salary-range-chip">
        <div class="src-label" data-en="Estimated Salary Range (CAD)" data-fr="Fourchette salariale estimée (CAD)">Estimated Salary Range (CAD)</div>
        <div class="src-value">${neg.salary_range || '—'}</div>
      </div>
      <h3 data-en="Negotiation Script" data-fr="Script de négociation">Negotiation Script</h3>
      <p>${neg.script_para1 || ''}</p>
      <p>${neg.script_para2 || ''}</p>
      <h3 data-en="Three Tactics for This Role" data-fr="Trois tactiques pour ce poste">Three Tactics for This Role</h3>
      <ul class="salary-tactics">
        ${(neg.tactics || []).map(t => `<li>${t}</li>`).join('')}
      </ul>
      <h3 data-en="What NOT to Say" data-fr="Ce qu'il ne faut PAS dire">What NOT to Say</h3>
      <ul class="salary-dont">
        ${(neg.dont_say || []).map(d => `<li>${d}</li>`).join('')}
      </ul>`;
    applyLang();
  } catch(err) {
    const isKey = err.message && (err.message.includes('401') || err.message.toLowerCase().includes('auth'));
    const msg = isKey
      ? 'Invalid API key. Check your key in Settings (⚙) and try again.'
      : 'Could not load negotiation strategy. Check your internet connection and try again.';
    document.getElementById('salaryModalBody').innerHTML = '<p style="color:var(--red,#c0392b);font-size:0.92em;">' + msg + '</p>';
  }
}

// ── Print Jobs Table (clean, no UI chrome) ──
function printJobsTable() {
  const isFr = currentLang === 'fr';
  const title = isFr ? 'Mon tableau de candidatures' : 'My Job Applications';
  const headers = isFr
    ? ['Entreprise', 'Poste', 'Score', 'Recommandation', 'Statut', 'Notes']
    : ['Company', 'Role', 'Score', 'Recommendation', 'Status', 'Notes'];

  const rows = jobs.map(j => {
    const a = j.analysis || {};
    return `<tr>
      <td>${a.company || '—'}</td>
      <td>${a.job_title || '—'}</td>
      <td style="text-align:center;font-weight:700">${j.compositeScore || '—'}</td>
      <td>${a.application_recommendation || '—'}</td>
      <td>${j.status || '—'}</td>
      <td style="font-size:0.85em">${(j.notes || '').replace(/</g,'&lt;')}</td>
    </tr>`;
  }).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${title}</title>
<style>
  body{font-family:'Segoe UI',Arial,sans-serif;color:#111;background:#fff;margin:0;padding:24px}
  h1{font-size:1.3em;margin-bottom:16px}
  table{width:100%;border-collapse:collapse;font-size:0.88em}
  th{background:#0F1B2D;color:#fff;padding:8px 10px;text-align:left;font-weight:600}
  td{padding:7px 10px;border-bottom:1px solid #e5e5e5;vertical-align:top}
  tr:nth-child(even){background:#f9f9f9}
  .footer{margin-top:24px;font-size:0.78em;color:#999;text-align:center;border-top:1px solid #e5e5e5;padding-top:12px}
  @media print{body{padding:12px}}
</style></head><body>
  <h1>${title}</h1>
  ${jobs.length ? `<table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>` : `<p>No jobs tracked yet.</p>`}
  <div class="footer">${isFr ? 'Généré par Career Coach — Two Birds Innovation' : 'Generated by Career Coach — Two Birds Innovation'}</div>
</body></html>`;

  const w = window.open('', '_blank');
  if (w) { w.document.write(html); w.document.close(); w.print(); }
}

// ── 6C: Enhanced HTML Report (with Red Flags column and Industry Sector) ──
function exportApplicationsReport() {
  const isFr = currentLang === 'fr';
  const userName = (profile && profile.name) ? profile.name : '';
  const today = new Date().toLocaleDateString(isFr ? 'fr-CA' : 'en-CA', { year: 'numeric', month: 'long', day: 'numeric' });

  const title = isFr
    ? `Rapport de candidatures${userName ? ' — ' + userName : ''} — ${today}`
    : `Job Application Report${userName ? ' — ' + userName : ''} — ${today}`;

  const scoreColour = score => {
    if (typeof score !== 'number') return '#666';
    return score >= 70 ? '#2ECC71' : score >= 45 ? '#F39C12' : '#E74C3C';
  };

  const footer = isFr
    ? 'Généré par Career Coach — Two Birds Innovation'
    : 'Generated by Career Coach — Two Birds Innovation';

  const headers = isFr
    ? ['Entreprise', 'Poste', 'Date ajoutée', 'Statut', 'Score', 'ATS', 'Adéquation', 'Correspondance salariale', 'Risque IA', 'Recommandation', 'Signaux d\'alerte', 'Notes']
    : ['Company', 'Role', 'Date Added', 'Status', 'Score', 'ATS', 'Fit', 'Salary Match', 'AI Risk', 'Recommendation', 'Red Flags', 'Notes'];

  const tableRows = jobs.map(j => {
    const flags = detectRedFlags(j.analysis || {}, j.rawPosting || '');
    const flagsCell = flags.length === 0
      ? `<span style="color:#2ECC71">None</span>`
      : flags.map(f => `<span style="color:#E74C3C;display:block;font-size:0.82em">⚠ ${f.cat}</span>`).join('');
    const sc = j.compositeScore || 0;
    const sector = detectSector(j.analysis?.job_title || '');
    const sectorLabel = sector ? INDUSTRY_INSIGHTS[sector]?.label || '' : '';
    return `<tr>
      <td>${j.analysis?.company || '—'}</td>
      <td>${j.analysis?.job_title || '—'}${sectorLabel ? `<br><span style="font-size:0.78em;color:#888">${sectorLabel}</span>` : ''}</td>
      <td>${j.addedAt?.split('T')[0] || '—'}</td>
      <td>${j.status || '—'}</td>
      <td style="color:${scoreColour(sc)};font-weight:700;text-align:center">${sc}</td>
      <td style="text-align:center">${j.analysis?.ats_score || '—'}</td>
      <td style="text-align:center">${j.analysis?.overall_fit || '—'}</td>
      <td>${j.analysis?.salary_match || '—'}</td>
      <td>${j.analysis?.ai_risk_rating || '—'}</td>
      <td>${j.analysis?.application_recommendation || '—'}</td>
      <td>${flagsCell}</td>
      <td style="font-size:0.85em;color:#555">${(j.notes || '').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</td>
    </tr>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="${isFr ? 'fr' : 'en'}">
<head>
<meta charset="UTF-8">
<title>${title}</title>
<style>
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #111; background: #fff; margin: 0; padding: 32px; }
  h1 { font-size: 1.3em; margin-bottom: 4px; }
  .sub { color: #666; font-size: 0.9em; margin-bottom: 24px; }
  table { width: 100%; border-collapse: collapse; font-size: 0.85em; }
  th { background: #0F1B2D; color: #fff; padding: 9px 10px; text-align: left; font-weight: 600; white-space: nowrap; }
  td { padding: 8px 10px; border-bottom: 1px solid #e5e5e5; vertical-align: top; }
  tr:last-child td { border-bottom: none; }
  tr:nth-child(even) { background: #f9f9f9; }
  .footer { margin-top: 32px; font-size: 0.78em; color: #999; text-align: center; border-top: 1px solid #e5e5e5; padding-top: 14px; }
  .print-btn { display: inline-block; margin-top: 16px; padding: 8px 18px; background: #0F1B2D; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-size: 0.9em; }
  @media print {
    body { padding: 16px; }
    .print-btn { display: none; }
  }
</style>
</head>
<body>
  <h1>${title}</h1>
  <div class="sub">${jobs.length} ${isFr ? 'offres suivies' : 'applications tracked'}</div>
  <button class="print-btn" onclick="window.print()">${isFr ? 'Imprimer' : 'Print'}</button>
  ${jobs.length ? `<br><br><table>
    <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
    <tbody>${tableRows}</tbody>
  </table>` : `<p style="color:#999">${isFr ? 'Aucune offre enregistrée.' : 'No jobs tracked yet.'}</p>`}
  <div class="footer">${footer}</div>
</body>
</html>`;

  const w = window.open('', '_blank');
  if (w) { w.document.write(html); w.document.close(); }
}

// ── 6D: Follow-Up Email Generator ──
let followUpModalJobId = null;

function openFollowUpModal(jobId, type) {
  followUpModalJobId = jobId;
  const job = jobs.find(j => j.id === jobId);
  if (!job) return;
  const a = job.analysis || {};
  const isPostInterview = type === 'post-interview';
  const titleText = `${a.job_title || 'Role'} at ${a.company || 'Company'}`;
  document.getElementById('followUpModalSub').textContent = (isPostInterview ? 'Post-interview thank-you — ' : 'After applying — ') + titleText;
  document.getElementById('followUpModalBody').innerHTML =
    '<div class="salary-modal-loading">Generating your follow-up email…</div>';
  document.getElementById('followUpModalOverlay').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  fetchFollowUpEmail(job, type);
}

function closeFollowUpModal(e) {
  if (e && e.target && e.target.id !== 'followUpModalOverlay' && !e.currentTarget?.classList?.contains('salary-modal-close')) return;
  document.getElementById('followUpModalOverlay').classList.add('hidden');
  document.body.style.overflow = '';
}

async function fetchFollowUpEmail(job, type) {
  const provider = getActiveProvider();
  const providerMeta = PROVIDER_META[provider] || PROVIDER_META.anthropic;
  const apiKey = getActiveApiKey();
  if (providerMeta.needsKey && !apiKey) {
    document.getElementById('followUpModalBody').innerHTML =
      '<p style="color:#c0392b">Please add your API key in Settings (⚙) first.</p>';
    return;
  }
  const a = job.analysis || {};
  const jobTitle = a.job_title || 'the role';
  const company = a.company || 'the company';
  const candidateName = profile && profile.name ? profile.name : 'the candidate';
  const isPostInterview = type === 'post-interview';

  const prompt = isPostInterview
    ? `Write a professional post-interview thank-you email in Canadian English for this job candidate.

Candidate name: ${candidateName}
Role applied for: ${jobTitle} at ${company}
Candidate's key strengths for this role: ${(a.cv_strengths || []).slice(0,3).join(', ')}

Write a 3-paragraph thank-you email:
1. Opening: thank them for the interview, express genuine enthusiasm for the specific role
2. Middle: reinforce one specific strength or skill that came up (or would come up), confirm fit
3. Close: polite call to action, offer to provide anything additional, sign-off

Keep it under 180 words. Professional but warm. No hollow phrases like "I would be a great fit." Canadian English. Subject line on the first line formatted as: Subject: [subject here]`
    : `Write a professional follow-up email in Canadian English for this job candidate who has applied but not yet heard back.

Candidate name: ${candidateName}
Role applied for: ${jobTitle} at ${company}
Days since applying (assume approximately 7-10 business days): ~8

Write a brief, professional 2-paragraph follow-up:
1. Remind them of the application (role, date approximately), confirm continued interest
2. Offer to provide additional information, polite close

Keep it under 120 words. Not desperate, not pushy — just professional follow-through. Canadian English. Subject line on the first line formatted as: Subject: [subject here]`;

  try {
    const raw = await llmChat(prompt, { maxTokens: 400, provider: provider, apiKey: apiKey });
    const escaped = raw.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    document.getElementById('followUpModalBody').innerHTML =
      `<pre style="white-space:pre-wrap;font-family:inherit;font-size:0.9em;line-height:1.65;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:14px;margin-bottom:10px">${escaped}</pre>
      <button onclick="navigator.clipboard.writeText(this.previousElementSibling.textContent).then(()=>{this.textContent='✓ Copied!';setTimeout(()=>this.textContent='📋 Copy',2000)})" style="margin-right:8px;background:transparent;border:1px solid var(--border);border-radius:6px;padding:5px 12px;font-size:0.82em;cursor:pointer">📋 Copy</button>
      <button class="btn-secondary" onclick="openFollowUpModal('${job.id}','${type}')" style="font-size:0.82em">↺ Regenerate</button>`;
  } catch(err) {
    document.getElementById('followUpModalBody').innerHTML =
      '<p style="color:#c0392b">Could not generate email. Check your API key and try again.</p>';
  }
}

// ── 6E: ATS Keyword Analyser ──
let atsModalJobId = null;

function openAtsModal(jobId) {
  atsModalJobId = jobId;
  const job = jobs.find(j => j.id === jobId);
  if (!job) return;
  const titleText = job.title || 'this role';
  document.getElementById('atsModalSub').textContent = titleText + (job.company ? ' · ' + job.company : '');
  document.getElementById('atsModalBody').innerHTML =
    '<div class="salary-modal-loading">Scanning posting for ATS keywords…</div>';
  document.getElementById('atsModalOverlay').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  fetchAtsKeywords(job);
}

function closeAtsModal(e) {
  if (e && e.target && e.target.id !== 'atsModalOverlay' && !e.currentTarget?.classList?.contains('salary-modal-close')) return;
  document.getElementById('atsModalOverlay').classList.add('hidden');
  document.body.style.overflow = '';
}

async function fetchAtsKeywords(job) {
  const provider = getActiveProvider();
  const providerMeta = PROVIDER_META[provider] || PROVIDER_META.anthropic;
  const apiKey = getActiveApiKey();
  if (providerMeta.needsKey && !apiKey) {
    document.getElementById('atsModalBody').innerHTML =
      '<p style="color:#c0392b">Add your API key in Settings to use this feature.</p>';
    return;
  }
  const a = job.analysis || {};
  const cvSummary = profile ? `
Candidate name: ${profile.name || 'Not provided'}
Current/recent role: ${profile.currentRole || 'Not provided'}
CV summary: ${profile.cvText ? profile.cvText.slice(0, 1200) : 'Not provided'}` : 'CV not provided.';

  const prompt = `You are an ATS (applicant tracking system) keyword expert helping a Canadian job seeker optimise their CV for a specific role.

JOB POSTING:
Title: ${job.title || 'Not provided'}
Company: ${job.company || 'Not provided'}
Description: ${job.description ? job.description.slice(0, 1500) : 'Not provided'}

CANDIDATE:
${cvSummary}

Return a JSON object with exactly these fields:
{
  "top_keywords": ["keyword1", "keyword2", ...],
  "matched": ["keyword already in CV"],
  "missing": ["important keyword NOT in CV"],
  "phrases_to_add": ["exact phrase or sentence to insert into CV"],
  "skills_reorder": "One sentence on which skills to list first"
}

Rules:
- top_keywords: 10 most ATS-critical terms from the posting (titles, technologies, certifications, methodologies)
- matched: which of top_keywords are clearly present in the CV (be generous — partial matches count)
- missing: which of top_keywords are absent from the CV
- phrases_to_add: 3 concrete CV bullet points or phrases the candidate could add to close the gap
- skills_reorder: which skill category to lead with given this specific posting
- Canadian English throughout
- Return ONLY the JSON object, no markdown fences`;

  try {
    const raw = await llmChat(prompt, { maxTokens: 600, provider: provider, apiKey: apiKey });
    let data;
    try {
      const jsonStr = raw.replace(/^```json\s*/,'').replace(/^```\s*/,'').replace(/```\s*$/,'').trim();
      data = JSON.parse(jsonStr);
    } catch(parseErr) {
      document.getElementById('atsModalBody').innerHTML =
        `<pre style="white-space:pre-wrap;font-size:0.88em;line-height:1.6">${raw.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</pre>`;
      return;
    }

    const matched  = Array.isArray(data.matched)  ? data.matched  : [];
    const missing  = Array.isArray(data.missing)   ? data.missing  : [];
    const phrases  = Array.isArray(data.phrases_to_add) ? data.phrases_to_add : [];
    const topKw    = Array.isArray(data.top_keywords) ? data.top_keywords : [];
    const reorder  = data.skills_reorder || '';

    const matchedHtml = matched.length
      ? matched.map(k => `<span style="display:inline-block;background:#e8f5e9;color:#2e7d32;border:1px solid #a5d6a7;border-radius:14px;padding:3px 10px;font-size:0.82em;margin:2px;font-weight:600">✓ ${k}</span>`).join('')
      : '<span style="color:var(--muted);font-size:0.88em">None identified — consider adding more detail to your CV.</span>';

    const missingHtml = missing.length
      ? missing.map(k => `<span style="display:inline-block;background:#ffebee;color:#c62828;border:1px solid #ef9a9a;border-radius:14px;padding:3px 10px;font-size:0.82em;margin:2px;font-weight:600">✗ ${k}</span>`).join('')
      : '<span style="color:var(--muted);font-size:0.88em">Strong match — no critical gaps found.</span>';

    const phrasesHtml = phrases.map((p, i) =>
      `<div style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin-bottom:8px;font-size:0.88em;line-height:1.55">
        <span style="font-size:0.75em;font-weight:700;color:var(--muted);display:block;margin-bottom:4px">ADD TO CV ${i+1}</span>
        ${p.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
        <button onclick="navigator.clipboard.writeText(this.previousElementSibling.textContent||'').then(()=>{this.textContent='✓';setTimeout(()=>this.textContent='📋',1500)})" style="float:right;background:transparent;border:1px solid var(--border);border-radius:5px;padding:2px 8px;font-size:0.8em;cursor:pointer;margin-top:2px">📋</button>
      </div>`
    ).join('');

    const coverageScore = topKw.length > 0 ? Math.round((matched.length / topKw.length) * 100) : 0;
    const scoreColour = coverageScore >= 70 ? '#2e7d32' : coverageScore >= 40 ? '#e65100' : '#c62828';

    document.getElementById('atsModalBody').innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;padding:12px 14px;background:var(--bg);border:1px solid var(--border);border-radius:10px">
        <div style="font-size:1.8em;font-weight:800;color:${scoreColour}">${coverageScore}%</div>
        <div>
          <div style="font-weight:700;font-size:0.95em">Keyword coverage</div>
          <div style="font-size:0.82em;color:var(--muted)">${matched.length} of ${topKw.length} ATS keywords already in your CV</div>
        </div>
      </div>

      <h3 style="font-size:0.95em;font-weight:700;margin:0 0 6px">✓ Already in your CV</h3>
      <div style="margin-bottom:14px">${matchedHtml}</div>

      <h3 style="font-size:0.95em;font-weight:700;margin:0 0 6px">✗ Missing — add these</h3>
      <div style="margin-bottom:14px">${missingHtml}</div>

      ${phrases.length ? `<h3 style="font-size:0.95em;font-weight:700;margin:0 0 8px">📝 Suggested CV additions</h3>${phrasesHtml}` : ''}

      ${reorder ? `<div style="background:#e8eaf6;border-left:4px solid #3949ab;border-radius:0 8px 8px 0;padding:10px 12px;font-size:0.88em;margin-top:4px"><strong>Skills reorder tip:</strong> ${reorder.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>` : ''}

      <div style="margin-top:14px">
        <button class="btn-secondary" onclick="openAtsModal('${job.id}')" style="font-size:0.82em">↺ Re-analyse</button>
      </div>`;
  } catch(err) {
    document.getElementById('atsModalBody').innerHTML =
      '<p style="color:#c0392b">Could not analyse keywords. Check your API key and try again.</p>';
  }
}

// ── LinkedIn Profile Optimiser ──
function openLinkedInModal() {
  if (!profile) { alert('Please complete your profile first.'); return; }
  document.getElementById('linkedInModalBody').innerHTML =
    '<div class="salary-modal-loading">Generating your LinkedIn optimisations…</div>';
  document.getElementById('linkedInModalOverlay').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  fetchLinkedInOptimisation();
}

function closeLinkedInModal(e) {
  if (e && e.target && e.target.id !== 'linkedInModalOverlay' && !e.currentTarget?.classList?.contains('salary-modal-close')) return;
  document.getElementById('linkedInModalOverlay').classList.add('hidden');
  document.body.style.overflow = '';
}

async function fetchLinkedInOptimisation() {
  const provider = getActiveProvider();
  const providerMeta = PROVIDER_META[provider] || PROVIDER_META.anthropic;
  const apiKey = getActiveApiKey();
  if (providerMeta.needsKey && !apiKey) {
    document.getElementById('linkedInModalBody').innerHTML =
      '<p style="color:#c0392b">Please add your API key in Settings (⚙) first.</p>';
    return;
  }
  const recentJobs = jobs.filter(j => j.analysis).slice(0, 3)
    .map(j => `${j.analysis.job_title || 'Role'} at ${j.analysis.company || 'Company'}`).join(', ');

  const prompt = `You are a LinkedIn profile expert and Canadian career coach. Optimise this candidate's LinkedIn profile for their target roles.

Candidate CV (first 1200 chars):
${profile.cv.substring(0, 1200)}

Target salary range: $${profile.minSalary}–$${profile.targetSalary} CAD
Open to remote: ${profile.remote} | Hybrid: ${profile.hybrid}
Recent roles they are applying to: ${recentJobs || 'Not yet specified'}
Location: ${profile.location || 'Canada'}

Return a JSON object with no markdown, no code fences:
{
  "headline": "string (max 120 characters — punchy, keyword-rich, value-first)",
  "about": "string (max 400 words — first-person, starts with a hook, ends with a call to action, no buzzwords like 'passionate' or 'synergy')",
  "top_skills": ["skill1", "skill2", "skill3", "skill4", "skill5"],
  "profile_tips": ["tip1 (specific, actionable)", "tip2", "tip3"]
}`;

  try {
    const raw = await llmChat(prompt, { maxTokens: 900, provider: provider, apiKey: apiKey });
    let li;
    try { li = JSON.parse(raw); }
    catch(e) {
      const match = raw.match(/\{[\s\S]*\}/);
      li = match ? JSON.parse(match[0]) : null;
    }
    if (!li) throw new Error('Could not parse LinkedIn response.');

    const escH = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const skills = (li.top_skills || []).map(s => `<span style="display:inline-block;background:var(--teal);color:var(--bg);border-radius:20px;padding:3px 10px;font-size:0.82em;margin:3px 3px 3px 0">${escH(s)}</span>`).join('');
    const tips = (li.profile_tips || []).map(t => `<li style="margin-bottom:6px">${escH(t)}</li>`).join('');

    document.getElementById('linkedInModalBody').innerHTML = `
      <div style="margin-bottom:16px">
        <h3 style="font-size:0.82em;font-weight:700;text-transform:uppercase;letter-spacing:0.4px;color:var(--muted);margin-bottom:6px">Headline (120 chars max)</h3>
        <div style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:12px;font-weight:600;font-size:1em;line-height:1.4">${escH(li.headline || '')}</div>
        <button onclick="navigator.clipboard.writeText(this.previousElementSibling.textContent).then(()=>{this.textContent='✓ Copied!';setTimeout(()=>this.textContent='📋 Copy',2000)})" style="margin-top:6px;background:transparent;border:1px solid var(--border);border-radius:6px;padding:4px 10px;font-size:0.8em;cursor:pointer">📋 Copy</button>
      </div>
      <div style="margin-bottom:16px">
        <h3 style="font-size:0.82em;font-weight:700;text-transform:uppercase;letter-spacing:0.4px;color:var(--muted);margin-bottom:6px">About Section</h3>
        <pre style="white-space:pre-wrap;font-family:inherit;font-size:0.88em;line-height:1.65;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:12px;max-height:220px;overflow-y:auto">${escH(li.about || '')}</pre>
        <button onclick="navigator.clipboard.writeText(this.previousElementSibling.textContent).then(()=>{this.textContent='✓ Copied!';setTimeout(()=>this.textContent='📋 Copy',2000)})" style="margin-top:6px;background:transparent;border:1px solid var(--border);border-radius:6px;padding:4px 10px;font-size:0.8em;cursor:pointer">📋 Copy</button>
      </div>
      <div style="margin-bottom:16px">
        <h3 style="font-size:0.82em;font-weight:700;text-transform:uppercase;letter-spacing:0.4px;color:var(--muted);margin-bottom:8px">Top Skills to Add</h3>
        <div>${skills}</div>
      </div>
      <div>
        <h3 style="font-size:0.82em;font-weight:700;text-transform:uppercase;letter-spacing:0.4px;color:var(--muted);margin-bottom:8px">Profile Tips</h3>
        <ul style="padding-left:1.2rem;font-size:0.88em;line-height:1.6">${tips}</ul>
      </div>
      <button class="btn-secondary" style="margin-top:14px;font-size:0.85em" onclick="fetchLinkedInOptimisation()">↺ Regenerate</button>`;
  } catch(err) {
    document.getElementById('linkedInModalBody').innerHTML =
      '<p style="color:#c0392b">Could not generate LinkedIn optimisations. Check your API key and try again.</p>';
  }
}

// ── 6B: Cover Letter Generator ──
let coverLetterModalJobId = null;

function openCoverLetterModal(jobId) {
  coverLetterModalJobId = jobId;
  const job = jobs.find(j => j.id === jobId);
  if (!job) return;
  const a = job.analysis || {};
  const titleText = `${a.job_title || 'Role'} at ${a.company || 'Company'}`;
  document.getElementById('coverLetterModalSub').textContent = titleText;
  document.getElementById('coverLetterModalBody').innerHTML =
    '<div class="salary-modal-loading">Generating your cover letter…</div>';
  document.getElementById('coverLetterModalOverlay').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  fetchCoverLetter(job);
}

function closeCoverLetterModal(e) {
  if (e && e.target && e.target.id !== 'coverLetterModalOverlay' && !e.currentTarget?.classList?.contains('salary-modal-close')) return;
  document.getElementById('coverLetterModalOverlay').classList.add('hidden');
  document.body.style.overflow = '';
}

async function fetchCoverLetter(job) {
  const provider = getActiveProvider();
  const providerMeta = PROVIDER_META[provider] || PROVIDER_META.anthropic;
  const apiKey = getActiveApiKey();
  if (providerMeta.needsKey && !apiKey) {
    document.getElementById('coverLetterModalBody').innerHTML =
      '<p style="color:#c0392b">Please add your API key in Settings (⚙) first.</p>';
    return;
  }
  const a = job.analysis || {};
  const jobTitle = a.job_title || 'this role';
  const company = a.company || 'the company';
  const toneRef = profile && profile.coverLetter ? `\n\nCandidate's cover letter tone/template preference:\n${profile.coverLetter.substring(0,500)}` : '';
  const prompt = `Write a tailored, professional cover letter for a Canadian job application. Use Canadian English. The letter should be specific to this posting — not generic.

Candidate CV summary:
${profile ? profile.cv.substring(0, 1200) : 'Not provided'}

Target role: ${jobTitle} at ${company}
Key CV strengths relevant to this role: ${(a.cv_strengths || []).join(', ')}
Gaps to address: ${(a.cv_gaps || []).join(', ')}${toneRef}

Job posting excerpt:
${job.rawPosting.substring(0, 1000)}

Write a 3-paragraph cover letter (opening, body, close). Keep it under 300 words. Do not use em dashes. Do not use generic phrases like "I am writing to express my interest" — start with a strong opening sentence that connects the candidate directly to the role. End with a specific call to action. Format as plain text.`;

  try {
    const raw = await llmChat(prompt, { maxTokens: 600, provider: provider, apiKey: apiKey });
    const escaped = raw.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    document.getElementById('coverLetterModalBody').innerHTML =
      `<pre style="white-space:pre-wrap;font-family:inherit;font-size:0.9em;line-height:1.65;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:16px;margin-bottom:12px">${escaped}</pre>
      <button class="btn-salary-neg" onclick="copyCoverLetterText(this)" style="margin-right:8px" data-en="📋 Copy to clipboard" data-fr="📋 Copier dans le presse-papiers">📋 Copy to clipboard</button>
      <button class="btn-secondary" onclick="openCoverLetterModal('${job.id}')" style="font-size:0.85em" data-en="↺ Regenerate" data-fr="↺ Régénérer">↺ Regenerate</button>`;
  } catch(err) {
    document.getElementById('coverLetterModalBody').innerHTML =
      '<p style="color:#c0392b">Could not generate cover letter. Check your API key and try again.</p>';
  }
}

function copyCoverLetterText(btn) {
  const pre = btn.closest('#coverLetterModalBody').querySelector('pre');
  if (!pre) return;
  navigator.clipboard.writeText(pre.textContent).then(() => {
    btn.textContent = '✓ Copied!';
    setTimeout(() => { btn.textContent = '📋 Copy to clipboard'; }, 2000);
  }).catch(() => {
    btn.textContent = 'Copy failed — select text manually';
  });
}

// ── 6C: Interview Prep ──
let interviewModalJobId = null;

function openInterviewModal(jobId) {
  interviewModalJobId = jobId;
  const job = jobs.find(j => j.id === jobId);
  if (!job) return;
  const a = job.analysis || {};
  const titleText = `${a.job_title || 'Role'} at ${a.company || 'Company'}`;
  document.getElementById('interviewModalSub').textContent = titleText;
  document.getElementById('interviewModalBody').innerHTML =
    '<div class="salary-modal-loading">Generating your interview prep…</div>';
  document.getElementById('interviewModalOverlay').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  fetchInterviewPrep(job);
}

function closeInterviewModal(e) {
  if (e && e.target && e.target.id !== 'interviewModalOverlay' && !e.currentTarget?.classList?.contains('salary-modal-close')) return;
  document.getElementById('interviewModalOverlay').classList.add('hidden');
  document.body.style.overflow = '';
}

async function fetchInterviewPrep(job) {
  const provider = getActiveProvider();
  const providerMeta = PROVIDER_META[provider] || PROVIDER_META.anthropic;
  const apiKey = getActiveApiKey();
  if (providerMeta.needsKey && !apiKey) {
    document.getElementById('interviewModalBody').innerHTML =
      '<p style="color:#c0392b">Please add your API key in Settings (⚙) first.</p>';
    return;
  }
  const a = job.analysis || {};
  const jobTitle = a.job_title || 'this role';
  const company = a.company || 'the company';

  const prompt = `You are an expert Canadian career coach. Prepare this candidate for a job interview.

Candidate CV summary (first 1000 chars):
${profile ? profile.cv.substring(0, 1000) : 'Not provided'}

Role: ${jobTitle} at ${company}
CV strengths for this role: ${(a.cv_strengths || []).join(', ')}
CV gaps to address: ${(a.cv_gaps || []).join(', ')}

Job posting excerpt:
${job.rawPosting.substring(0, 800)}

Return a JSON object with exactly this structure — no markdown, no code fences, just raw JSON:
{
  "likely_questions": [
    {"question": "string", "why_asked": "string (1 sentence)", "answer_framework": "string (2-3 sentences using STAR method)"},
    {"question": "string", "why_asked": "string", "answer_framework": "string"},
    {"question": "string", "why_asked": "string", "answer_framework": "string"},
    {"question": "string", "why_asked": "string", "answer_framework": "string"},
    {"question": "string", "why_asked": "string", "answer_framework": "string"}
  ],
  "questions_to_ask": ["string", "string", "string"],
  "key_messages": ["string (one thing to emphasize)", "string", "string"]
}`;

  try {
    const raw = await llmChat(prompt, { maxTokens: 1200, provider: provider, apiKey: apiKey });
    let prep;
    try { prep = JSON.parse(raw); }
    catch(e) {
      const match = raw.match(/\{[\s\S]*\}/);
      prep = match ? JSON.parse(match[0]) : null;
    }
    if (!prep) throw new Error('Could not parse interview prep response.');

    const qs = (prep.likely_questions || []).map((q, i) => `
      <div style="border:1px solid var(--border);border-radius:8px;padding:14px;margin-bottom:10px;">
        <p style="font-weight:700;margin-bottom:4px">${i+1}. ${q.question}</p>
        <p style="font-size:0.82em;color:var(--muted);margin-bottom:6px"><em>Why asked: ${q.why_asked}</em></p>
        <p style="font-size:0.88em;line-height:1.6"><strong>How to answer:</strong> ${q.answer_framework}</p>
      </div>`).join('');

    const ask = (prep.questions_to_ask || []).map(q => `<li style="margin-bottom:6px">${q}</li>`).join('');
    const msgs = (prep.key_messages || []).map(m => `<li style="margin-bottom:4px">${m}</li>`).join('');

    document.getElementById('interviewModalBody').innerHTML = `
      <h3 style="font-size:0.9em;font-weight:700;text-transform:uppercase;letter-spacing:0.4px;color:var(--muted);margin-bottom:12px">Likely Questions &amp; Answer Frameworks</h3>
      ${qs}
      <h3 style="font-size:0.9em;font-weight:700;text-transform:uppercase;letter-spacing:0.4px;color:var(--muted);margin:16px 0 8px">Questions to Ask Them</h3>
      <ul style="padding-left:1.2rem;font-size:0.9em;line-height:1.6">${ask}</ul>
      <h3 style="font-size:0.9em;font-weight:700;text-transform:uppercase;letter-spacing:0.4px;color:var(--muted);margin:16px 0 8px">Key Messages to Land</h3>
      <ul style="padding-left:1.2rem;font-size:0.9em;line-height:1.6">${msgs}</ul>
      <button class="btn-secondary" style="margin-top:12px;font-size:0.85em" onclick="openInterviewModal('${job.id}')" data-en="↺ Regenerate" data-fr="↺ Régénérer">↺ Regenerate</button>`;
  } catch(err) {
    document.getElementById('interviewModalBody').innerHTML =
      '<p style="color:#c0392b">Could not generate interview prep. Check your API key and try again.</p>';
  }
}

// ── Boot ──
init();
