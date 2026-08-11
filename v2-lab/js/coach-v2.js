/* ============================================================================
   Career Coach v2 lab · landing + core coaching flow
   Reuses (from live v1 app.js): aggregator/ATS domain lists, detectAggregator,
   the analysis system prompt shape, and the demo posting. LLM calls go through
   js/llm-provider.js (BYOK portability layer, unchanged).
   ========================================================================== */
(function () {
  "use strict";

  /* ── Theme toggle (both pages) ─────────────────────────────── */
  var THEME_KEY = "cc-v2-theme";
  var root = document.documentElement;
  var toggle = document.getElementById("themeToggle");

  function syncToggle() {
    var dark = root.getAttribute("data-theme") === "dark";
    if (toggle) {
      var word = document.getElementById("themeWord");
      if (word) { word.textContent = dark ? "Light mode" : "Dark mode"; }
      else { toggle.textContent = dark ? "Light mode" : "Dark mode"; }
      toggle.setAttribute("aria-pressed", String(dark));
    }
  }
  if (toggle) {
    toggle.addEventListener("click", function () {
      var dark = root.getAttribute("data-theme") === "dark";
      if (dark) { root.removeAttribute("data-theme"); }
      else { root.setAttribute("data-theme", "dark"); }
      try { localStorage.setItem(THEME_KEY, dark ? "light" : "dark"); } catch (e) {}
      syncToggle();
    });
    syncToggle();
  }

  /* Landing page has no app panels; stop here if so. */
  if (!document.getElementById("panel-profile")) return;

  /* ── State ─────────────────────────────────────────────────── */
  var PROFILE_KEY = "cc-v2-profile";
  var $ = function (id) { return document.getElementById(id); };

  function loadProfile() {
    try { return JSON.parse(localStorage.getItem(PROFILE_KEY)) || {}; }
    catch (e) { return {}; }
  }
  function saveProfile(p) {
    try { localStorage.setItem(PROFILE_KEY, JSON.stringify(p)); } catch (e) {}
  }

  /* ── Flow navigation ───────────────────────────────────────── */
  var panels = ["panel-profile", "panel-job", "panel-verdict"];
  function goStep(n) { /* 1-based */
    panels.forEach(function (id, i) {
      $(id).classList.toggle("hidden", i !== n - 1);
    });
    $("flowFill").style.width = (n * 33.34) + "%";
    $("flowCount").textContent = "Step " + n + " of 3";
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  /* ── Step 1: profile + BYOK ────────────────────────────────── */
  function getChecked(cls) {
    return Array.prototype.slice
      .call(document.querySelectorAll("input." + cls + ":checked"))
      .map(function (el) { return el.value; });
  }
  function setChecked(cls, vals) {
    vals = vals || [];
    Array.prototype.forEach.call(document.querySelectorAll("input." + cls), function (el) {
      el.checked = vals.indexOf(el.value) !== -1;
    });
  }
  function currentCurrency() {
    var el = document.querySelector('input[name="cur"]:checked');
    return el ? el.value : "CAD";
  }
  function updateCurrencyHints(cur) {
    var t = "($ " + cur + ")";
    if ($("minSalHint")) $("minSalHint").textContent = t;
    if ($("targetSalHint")) $("targetSalHint").textContent = t;
  }
  function gatherProfile() {
    return {
      cv: $("pCV").value.trim(),
      minSal: $("pMinSal").value.trim(),
      targetSal: $("pTargetSal").value.trim(),
      currency: currentCurrency(),
      location: $("pLocation").value.trim(),
      arrangement: getChecked("arr"),
      priorities: getChecked("pri"),
      prioritiesOther: $("pPrioritiesOther").value.trim(),
      avoid: $("pAvoid").value.trim()
    };
  }

  var profile = loadProfile();
  if (profile.cv) $("pCV").value = profile.cv;
  if (profile.minSal) $("pMinSal").value = profile.minSal;
  if (profile.targetSal) $("pTargetSal").value = profile.targetSal;
  if (profile.location) $("pLocation").value = profile.location;
  setChecked("arr", profile.arrangement);
  setChecked("pri", profile.priorities);
  if (profile.prioritiesOther) $("pPrioritiesOther").value = profile.prioritiesOther;
  if (profile.avoid) $("pAvoid").value = profile.avoid;

  var startCur = profile.currency || "CAD";
  var startCurEl = document.querySelector('input[name="cur"][value="' + startCur + '"]');
  if (startCurEl) startCurEl.checked = true;
  updateCurrencyHints(startCur);

  try {
    var savedProvider = localStorage.getItem("llm_provider");
    if (savedProvider) $("provider").value = savedProvider;
    var savedKey = localStorage.getItem("llm_api_key");
    if (savedKey) $("apiKey").value = savedKey;
  } catch (e) {}

  function providerNeedsKey(p) {
    return p !== "ollama" && p !== "builtin";
  }
  function syncProviderUI() {
    var p = $("provider").value;
    $("keyField").classList.toggle("hidden", !providerNeedsKey(p));
    $("noKeyNote").classList.toggle("hidden", p !== "ollama");
  }
  $("provider").addEventListener("change", syncProviderUI);
  syncProviderUI();

  /* ── Session-loss safeguard: autosave in-progress state ──────
     Fits the existing localStorage architecture with the least new
     surface: everything typed is persisted as it is entered, so a
     reload or accidental navigation restores the form. A beforeunload
     warning (below) is a backstop for content not yet acted on. */
  var dirty = false;
  function markDirty() { dirty = true; }
  function autosaveProfile() {
    profile = gatherProfile();
    saveProfile(profile);
  }
  var saveTimer;
  var panelProfile = $("panel-profile");
  panelProfile.addEventListener("input", function () {
    markDirty();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(autosaveProfile, 400);
  });
  panelProfile.addEventListener("change", function () { autosaveProfile(); });

  Array.prototype.forEach.call(document.querySelectorAll('input[name="cur"]'), function (el) {
    el.addEventListener("change", function () { updateCurrencyHints(currentCurrency()); });
  });

  $("toStep2").addEventListener("click", function () {
    var cv = $("pCV").value.trim();
    if (!cv) {
      $("profileSavedNote").textContent = "Paste your CV first. The verdict is scored against it.";
      $("pCV").focus();
      return;
    }
    profile = gatherProfile();
    saveProfile(profile);
    try {
      localStorage.setItem("llm_provider", $("provider").value);
      var k = $("apiKey").value.trim();
      if (k) localStorage.setItem("llm_api_key", k);
    } catch (e) {}
    $("profileSavedNote").textContent = "";
    dirty = false;
    goStep(2);
  });
  $("backTo1").addEventListener("click", function () { goStep(1); });

  /* ── File upload: drag-and-drop + button (plain text only) ──── */
  var MAX_UPLOAD = 200 * 1024;
  function wireUpload(fileInput, uploadBtn, dropZone, targetEl, onDone, replaceLabel) {
    function handle(file) {
      if (!file) return;
      var name = (file.name || "").toLowerCase();
      var textLike = /\.(txt|md|markdown|text|csv|log)$/.test(name) ||
        (file.type && file.type.indexOf("text") === 0);
      if (!textLike) {
        window.alert("We keep everything in your browser, so we can only read plain-text files (.txt or .md). For a PDF or Word file, open it and paste the text in.");
        return;
      }
      if (file.size > MAX_UPLOAD) {
        window.alert("That file is larger than 200 KB. Please paste the relevant text instead.");
        return;
      }
      // Guard against silently overwriting existing content. Autosave persists
      // the overwrite shortly after, so there is no practical undo window.
      var existing = String(targetEl.value || "").trim();
      if (existing.length > 20) {
        var prompt = replaceLabel || "Replace the current text with the dropped file?";
        if (!window.confirm(prompt)) return;
      }
      var reader = new FileReader();
      reader.onload = function () {
        targetEl.value = String(reader.result || "");
        markDirty();
        if (onDone) onDone();
      };
      reader.readAsText(file);
    }
    if (uploadBtn && fileInput) {
      uploadBtn.addEventListener("click", function () { fileInput.click(); });
      fileInput.addEventListener("change", function () {
        if (fileInput.files && fileInput.files[0]) handle(fileInput.files[0]);
        fileInput.value = "";
      });
    }
    if (dropZone) {
      ["dragenter", "dragover"].forEach(function (ev) {
        dropZone.addEventListener(ev, function (e) { e.preventDefault(); dropZone.classList.add("drag"); });
      });
      ["dragleave", "dragend"].forEach(function (ev) {
        dropZone.addEventListener(ev, function () { dropZone.classList.remove("drag"); });
      });
      dropZone.addEventListener("drop", function (e) {
        e.preventDefault();
        dropZone.classList.remove("drag");
        var dt = e.dataTransfer;
        if (dt && dt.files && dt.files[0]) handle(dt.files[0]);
      });
    }
  }
  wireUpload($("cvFile"), $("cvUploadBtn"), $("cvDrop"), $("pCV"), function () { autosaveProfile(); }, "Replace your current CV text with the dropped file?");

  /* ── Posting-link check: job-board detection (reused from v1 app.js).
     Client-side only. This matches the URL against a known job-board list;
     it does NOT fetch the posting or verify it is live. Do not describe it
     to the user as verification. ──────────────────────────────────────── */
  var AGGREGATOR_DOMAINS = [
    "jobgether.com", "bebee.com", "indeed.com", "ziprecruiter.com",
    "jobted.com", "glassdoor.com", "monster.ca", "monster.com",
    "careerbuilder.ca", "careerbuilder.com", "simplyhired.ca", "simplyhired.com",
    "talent.com", "jooble.org", "eluta.ca", "workopolis.com", "adzuna.ca"
  ];
  var ATS_DOMAINS = [
    "greenhouse.io", "lever.co", "workday.com", "taleo.net",
    "smartrecruiters.com", "icims.com", "myworkdayjobs.com", "applytojob.com",
    "ashbyhq.com"
  ];
  function detectAggregator(url) {
    if (!url) return null;
    try {
      var host = new URL(url).hostname.replace(/^www\./, "");
      if (ATS_DOMAINS.some(function (d) { return host.indexOf(d) !== -1; })) return null;
      var match = null;
      AGGREGATOR_DOMAINS.some(function (d) {
        if (host.indexOf(d) !== -1) { match = d; return true; }
        return false;
      });
      return match;
    } catch (e) { return null; }
  }

  var confirmedLive = false;
  function setG0Status() {
    var url = $("jobUrl").value.trim();
    var el = $("g0Status");
    if (!url) { el.innerHTML = ""; return; }
    var agg = detectAggregator(url);
    if (agg) {
      el.innerHTML = '<span class="chip chip-caution">Job board, not the employer</span>';
    } else if (confirmedLive) {
      el.innerHTML = '<span class="chip chip-strong">Confirmed live</span>';
    } else {
      el.innerHTML = '<span class="chip chip-neutral">Not opened yet</span>';
    }
  }

  $("jobUrl").addEventListener("input", function () {
    var url = this.value.trim();
    confirmedLive = false;
    $("g0Confirm").setAttribute("aria-pressed", "false");
    var agg = detectAggregator(url);
    $("aggWarning").classList.toggle("hidden", !agg);
    if (agg) {
      var jobText = $("jobText").value || "";
      var firstLine = jobText.trim().split("\n")[0] || "this role";
      $("aggSearchLink").href = "https://www.google.ca/search?q=" +
        encodeURIComponent(firstLine.slice(0, 80) + " careers site");
    }
    $("openUrlBtn").hidden = !url;
    $("g0Actions").hidden = !url || !!agg;
    setG0Status();
  });
  $("openUrlBtn").addEventListener("click", function () {
    var url = $("jobUrl").value.trim();
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  });
  $("g0Confirm").addEventListener("click", function () {
    confirmedLive = !confirmedLive;
    this.setAttribute("aria-pressed", String(confirmedLive));
    setG0Status();
  });

  /* ── Demo posting (reused from v1 app.js) ──────────────────── */
  var DEMO_JOB = "Senior Product Manager - Acme Health Tech\n" +
    "Location: Toronto, ON (Hybrid, 2 days/week in office)\n" +
    "Salary: $110,000-$130,000 CAD + bonus + RRSP matching\n\n" +
    "About the Role:\n" +
    "Acme Health Tech is a fast-growing digital health company building software for primary care clinics across Canada. We're looking for an experienced Senior Product Manager to lead our patient-facing mobile product.\n\n" +
    "Responsibilities:\n" +
    "- Own the product roadmap for our patient engagement platform (iOS + Android)\n" +
    "- Lead discovery, prioritisation, and delivery across 2 squads\n" +
    "- Define success metrics and run regular A/B tests and user research\n" +
    "- Collaborate with regulatory and clinical teams on provincial health data requirements\n" +
    "- Present quarterly roadmap reviews to the executive team\n" +
    "- Mentor junior PMs on the team\n\n" +
    "Requirements:\n" +
    "- 5+ years of product management experience in a software company\n" +
    "- Experience in healthcare, health-tech, or regulated industries preferred\n" +
    "- Strong data analysis skills: comfortable with SQL and product analytics tools\n" +
    "- Track record of shipping mobile products used by 10,000+ users\n" +
    "- Excellent communication with technical and non-technical stakeholders\n\n" +
    "Why Join Us:\n" +
    "- Mission-driven company improving healthcare access for Canadians\n" +
    "- Flexible hybrid work, comprehensive benefits, 4 weeks vacation";

  $("demoBtn").addEventListener("click", function () {
    $("jobText").value = DEMO_JOB;
    saveJob();
    setStatus("Sample posting loaded. Get the verdict to see the full analysis.", false);
  });

  /* ── Job posting: persistence + file upload ────────────────── */
  var JOB_KEY = "cc-v2-job";
  function saveJob() {
    try {
      localStorage.setItem(JOB_KEY, JSON.stringify({ url: $("jobUrl").value, text: $("jobText").value }));
    } catch (e) {}
  }
  try {
    var savedJob = JSON.parse(localStorage.getItem(JOB_KEY) || "{}");
    if (savedJob.text) $("jobText").value = savedJob.text;
    if (savedJob.url) $("jobUrl").value = savedJob.url;
  } catch (e) {}
  $("jobText").addEventListener("input", function () { markDirty(); saveJob(); });
  $("jobUrl").addEventListener("input", saveJob);
  wireUpload($("jobFile"), $("jobUploadBtn"), $("jobDrop"), $("jobText"), function () { saveJob(); }, "Replace the current job posting text with the dropped file?");

  /* beforeunload backstop: warn only when there is entered content
     that has not yet been acted on (autosave already persists it). */
  window.addEventListener("beforeunload", function (e) {
    var hasContent = $("pCV").value.trim() || $("jobText").value.trim();
    if (dirty && hasContent) { e.preventDefault(); e.returnValue = ""; return ""; }
  });

  /* ── Analysis ──────────────────────────────────────────────── */
  function setStatus(msg, isErr) {
    var el = $("statusLine");
    el.textContent = msg;
    el.className = "status-line" + (isErr ? " err" : "");
  }

  var SYSTEM_PROMPT = 'You are a sharp, practical career coach. Compare the job posting against the candidate profile and CV in three passes. ' +
    'PASS 1: extract the requirements the posting itself states, from its requirements or qualifications section; if none is labelled, infer up to 6 from the responsibilities. Keep each requirement short (max 12 words) and use the posting\'s own wording. Mark each as "must" (stated as required) or "nice" (preferred, an asset, or inferred). ' +
    'PASS 2: judge each requirement against the CV only: "met" means clear evidence on the CV (name the line), "partial" means adjacent or implied evidence but not in the posting\'s words, "missing" means no evidence. Never invent CV content. ' +
    'PASS 3: list the exact keywords and short phrases an applicant tracking system would match on for this posting (skills, tools, methods, credentials, domain terms): 8 to 14 items, spelled exactly as the posting spells them. For each keyword set "claimable" true only if the CV shows real evidence the candidate has that skill even though the exact word is absent from the CV; otherwise false. ' +
    'Return ONLY valid JSON, no markdown, no code fences, exactly this structure: ' +
    '{"job_title":"string","company":"string","overall_fit":0,"salary_match":"above target|at target|below target|not specified","application_recommendation":"apply custom|apply generic|skip","recommendation_reason":"2 or 3 sentences, plain Canadian English, specific to this posting and this CV","requirements":[{"requirement":"string","priority":"must|nice","status":"met|partial|missing","evidence":"one sentence naming the CV line that meets it, or exactly what is absent"}],"keywords":[{"term":"string","claimable":false}],"gap_actions":[{"gap":"string","cv_fix":"string","beyond_cv":"string"}],"next_moves":[{"title":"string","detail":"one sentence"},{"title":"string","detail":"one sentence"},{"title":"string","detail":"one sentence"}]} ' +
    'Rules: every evidence line and the recommendation_reason must be specific to THIS posting and THIS CV; quote or closely paraphrase both. gap_actions: one item per missing or partial requirement, up to 5; cv_fix must name the CV section and the wording to add, and may only claim what the CV supports; beyond_cv is a general, honest direction for closing the gap for real (for example a short course or certification area, a volunteer angle, or a side project to build), never a named course, provider, price, or promised outcome; use an empty string when a CV edit alone covers it. If the posting text looks truncated (very short, or it ends with "see more"), say so plainly in recommendation_reason and be conservative.';

  function buildProfileText() {
    var cur = profile.currency || "CAD";
    var arr = (profile.arrangement && profile.arrangement.length)
      ? profile.arrangement.join(", ") : "not specified";
    var pri = (profile.priorities && profile.priorities.length) ? profile.priorities.slice() : [];
    if (profile.prioritiesOther) pri.push(profile.prioritiesOther);
    var priStr = pri.length ? pri.join(", ") : "not specified";
    return "Minimum salary: " + (profile.minSal ? "$" + profile.minSal + " " + cur : "not specified") +
      "\nTarget salary: " + (profile.targetSal ? "$" + profile.targetSal + " " + cur : "not specified") +
      "\nPreferred location: " + (profile.location || "not specified") +
      "\nWork arrangement: " + arr +
      "\nWhat matters most: " + priStr +
      "\nHard passes: " + (profile.avoid || "none stated") +
      "\n\nCV:\n" + profile.cv;
  }

  var SAMPLE_VERDICT = {
    job_title: "Senior Product Manager",
    company: "Acme Health Tech",
    overall_fit: 74,
    salary_match: "at target",
    application_recommendation: "apply custom",
    recommendation_reason: "The posting asks for product management depth, mobile shipping record, and stakeholder communication, and a CV like yours typically covers those outright. The gap is healthcare and regulated-industry vocabulary plus named analytics tools, and both are wording problems a custom CV can close.",
    requirements: [
      { requirement: "5+ years of product management experience", priority: "must", status: "met", evidence: "Sample judgment: senior product roles across the CV cover the stated experience bar." },
      { requirement: "Experience in healthcare, health-tech, or regulated industries", priority: "nice", status: "missing", evidence: "No healthcare, health-tech, or regulated-industry language appears on the CV." },
      { requirement: "Strong data analysis skills: SQL and product analytics tools", priority: "must", status: "partial", evidence: "Data-informed decisions are implied, but SQL and specific analytics tools are not named." },
      { requirement: "Track record of shipping mobile products used by 10,000+ users", priority: "must", status: "met", evidence: "Sample judgment: shipped consumer-scale mobile products with stated user counts." },
      { requirement: "Excellent communication with technical and non-technical stakeholders", priority: "must", status: "met", evidence: "Executive reviews and cross-team delivery on the CV evidence this directly." }
    ],
    keywords: [
      { term: "product management", claimable: false },
      { term: "product roadmap", claimable: true },
      { term: "mobile", claimable: false },
      { term: "SQL", claimable: true },
      { term: "product analytics", claimable: true },
      { term: "A/B tests", claimable: true },
      { term: "user research", claimable: false },
      { term: "healthcare", claimable: false },
      { term: "regulated industries", claimable: false },
      { term: "stakeholders", claimable: true },
      { term: "mentor", claimable: false }
    ],
    gap_actions: [
      { gap: "Healthcare and regulated-industry vocabulary", cv_fix: "Reword one summary or experience bullet to use compliance and privacy language you have genuinely earned, for example privacy-regulated data handling, only if it is true of your work.", beyond_cv: "If the gap is real, a short course or certification in health informatics or privacy compliance builds it credibly, and a volunteer product role with a health organisation counts as experience." },
      { gap: "SQL and analytics tools not named", cv_fix: "Add SQL and your actual analytics stack by name to the skills line; the screening software matches exact words, not implications.", beyond_cv: "" },
      { gap: "A/B testing not called out", cv_fix: "If you have run experiments, name one in a results bullet with the metric it moved; if not, leave it out.", beyond_cv: "Running a small experiment on a side project gives you an honest line here within weeks." }
    ],
    next_moves: [
      { title: "Make the honest keyword edits first", detail: "The amber rows in the keyword table are skills you already have; add the exact words and your match score rises before anything else changes." },
      { title: "Close the healthcare wording gap", detail: "One reworded bullet using compliance and privacy language addresses the posting's preferred requirement." },
      { title: "Verify the posting at the source", detail: "Confirm the role on the employer's own careers page before you invest the tailoring time." }
    ],
    _sample: true
  };

  /* ── Keyword counting: computed here, never by the AI ────────
     The model extracts the terms; this code counts them in both
     texts, so every number shown is verifiable against the inputs. */
  function countTerm(text, term) {
    if (!text || !term) return 0;
    var esc = String(term).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    var re = new RegExp("(^|[^A-Za-z0-9])" + esc + "(?=$|[^A-Za-z0-9])", "gi");
    var m = String(text).match(re);
    return m ? m.length : 0;
  }
  function scoreKeywords(keywords, jobText, cvText) {
    var rows = [];
    (keywords || []).forEach(function (k) {
      var term = (k && k.term) ? String(k.term).trim() : "";
      if (!term) return;
      var inPosting = countTerm(jobText, term);
      var inCv = countTerm(cvText, term);
      var status = inCv > 0 ? "have" : (k.claimable ? "claimable" : "gap");
      rows.push({ term: term, inPosting: Math.max(inPosting, 1), inCv: inCv, status: status });
    });
    var total = rows.length;
    var have = rows.filter(function (r) { return r.status === "have"; }).length;
    var claimable = rows.filter(function (r) { return r.status === "claimable"; }).length;
    var order = { claimable: 0, gap: 1, have: 2 };
    rows.sort(function (a, b) {
      return (order[a.status] - order[b.status]) || (b.inPosting - a.inPosting);
    });
    return {
      rows: rows,
      now: total ? Math.round((have / total) * 100) : 0,
      potential: total ? Math.round(((have + claimable) / total) * 100) : 0
    };
  }

  /* 75+ is the stated target band (the Jobscan-validated goal line the UI
     shows the user); colours align with it so a green number never sits
     below the printed target. */
  function bandClass(score) {
    return score >= 75 ? "strong" : score >= 45 ? "caution" : "weak";
  }

  /* Prioritized, specific fixes — the score is never shown as a bare number.
     Order: honest keyword edits first (largest, cheapest lift), then the
     per-requirement CV fixes the model named, then the salary trade-off. */
  function buildFixList(a, kw) {
    var fixes = [];
    var claimable = kw.rows.filter(function (r) { return r.status === "claimable"; })
      .map(function (r) { return r.term; });
    if (claimable.length) {
      var shown = claimable.slice(0, 4).join(", ");
      var more = claimable.length > 4 ? " and " + (claimable.length - 4) + " more" : "";
      fixes.push("Add the posting's exact words for skills you already have: " + shown + more +
        (kw.potential > kw.now ? ". This alone moves your score from " + kw.now + " to " + kw.potential + "." : "."));
    }
    (a.gap_actions || []).forEach(function (g) {
      if (fixes.length >= 5 || !g.cv_fix) return;
      fixes.push((g.gap ? g.gap + " — " : "") + g.cv_fix);
    });
    if (fixes.length < 5 && a.salary_match === "below target") {
      fixes.push("The posting's stated pay reads below your target. Decide whether the trade-off is worth it before you spend the tailoring time.");
    }
    return fixes.slice(0, 5);
  }

  function renderVerdict(a, meta, jobText) {
    $("repRole").textContent = (a.job_title || "Role") + (a.company ? " · " + a.company : "");
    $("repMeta").textContent = meta;

    var rec = a.application_recommendation || "skip";
    var chip = $("verdictChip");
    var word = $("verdictWord");
    if (rec === "apply custom") {
      chip.className = "chip chip-strong"; chip.textContent = "Apply custom";
      word.textContent = "Worth a tailored package.";
    } else if (rec === "apply generic") {
      chip.className = "chip chip-caution"; chip.textContent = "Apply generic";
      word.textContent = "Apply, but save your energy.";
    } else {
      chip.className = "chip chip-weak"; chip.textContent = "Skip";
      word.textContent = "Your time is worth more.";
    }
    $("verdictReason").textContent = a.recommendation_reason || "";

    /* ATS score is computed here from the keyword table, not taken
       from the model, so the number always matches the rows shown. */
    var kw = scoreKeywords(a.keywords, jobText || "", profile.cv || "");
    var ats = kw.rows.length ? kw.now : Math.max(0, Math.min(100, a.ats_score || 0));
    var fit = Math.max(0, Math.min(100, a.overall_fit || 0));
    $("mAts").textContent = ats;
    $("mAts").className = "sp-value " + bandClass(ats);
    $("mAtsFill").style.width = ats + "%";
    $("mAtsFill").className = "meter-fill " + bandClass(ats);
    var ghost = $("mAtsGhost");
    if (ghost) {
      ghost.style.width = (kw.rows.length ? kw.potential : ats) + "%";
      ghost.className = "meter-fill ghost " + bandClass(kw.rows.length ? kw.potential : ats);
    }
    /* Before/after forecast: shown only when honest edits would move the score */
    var improves = kw.rows.length && kw.potential > kw.now;
    $("mAtsArrow").hidden = !improves;
    $("mAtsAfterCol").hidden = !improves;
    if (improves) {
      $("mAtsAfter").textContent = kw.potential;
      $("mAtsAfter").className = "sp-value " + bandClass(kw.potential);
    }
    $("mAtsNote").textContent = improves
      ? "The forecast counts only the amber keywords: skills your CV already proves, reworded in the posting's vocabulary. No invention required."
      : (kw.rows.length ? "The exact-word edits are already in place." : "");

    /* Prioritized fix list under the primary score */
    var fixes = buildFixList(a, kw);
    var fixList = $("fixList");
    fixList.innerHTML = "";
    fixes.forEach(function (f) {
      var li = document.createElement("li");
      li.textContent = f;
      fixList.appendChild(li);
    });
    $("fixFirstBlock").hidden = !fixes.length;
    $("mFit").textContent = fit;
    $("mFit").className = "m-value " + bandClass(fit);
    $("mFitFill").style.width = fit + "%";
    $("mFitFill").className = "meter-fill " + bandClass(fit);

    var salMap = { "above target": [90, "strong", "Above target"], "at target": [70, "strong", "At target"], "below target": [30, "weak", "Below target"], "not specified": [50, "caution", "Not specified"] };
    var sal = salMap[a.salary_match] || salMap["not specified"];
    $("mSal").textContent = sal[2];
    $("mSal").className = "m-value " + sal[1];
    $("mSal").style.fontSize = "1.15rem";
    $("mSalFill").style.width = sal[0] + "%";
    $("mSalFill").className = "meter-fill " + sal[1];

    /* Requirements scorecard: the posting's own asks, judged one by one */
    var reqMap = {
      met:     { icon: "✓", cls: "req-met",     word: "Met" },
      partial: { icon: "~", cls: "req-partial", word: "Partial" },
      missing: { icon: "✗", cls: "req-missing", word: "Missing" }
    };
    var reqList = $("reqList");
    reqList.innerHTML = "";
    var reqs = a.requirements || [];
    reqs.forEach(function (r) {
      var st = reqMap[r.status] || reqMap.missing;
      var li = document.createElement("li");
      li.className = "req " + st.cls;
      var ic = document.createElement("span");
      ic.className = "req-ic";
      ic.textContent = st.icon;
      ic.setAttribute("aria-hidden", "true");
      var body = document.createElement("div");
      var head = document.createElement("div");
      head.className = "req-head";
      var b = document.createElement("b");
      b.textContent = r.requirement || "";
      head.appendChild(b);
      var pr = document.createElement("span");
      pr.className = "req-pill" + (r.priority === "must" ? " must" : "");
      pr.textContent = r.priority === "must" ? "Must-have" : "Nice-to-have";
      head.appendChild(pr);
      var srWord = document.createElement("span");
      srWord.className = "sr-only";
      srWord.textContent = st.word + ".";
      head.appendChild(srWord);
      body.appendChild(head);
      var p = document.createElement("p");
      p.textContent = r.evidence || "";
      body.appendChild(p);
      li.appendChild(ic);
      li.appendChild(body);
      reqList.appendChild(li);
    });
    var met = reqs.filter(function (r) { return r.status === "met"; }).length;
    $("reqSummary").textContent = reqs.length
      ? "You meet " + met + " of the " + reqs.length + " requirements this posting states."
      : "";
    $("reqBlock").classList.toggle("hidden", !reqs.length);

    /* Keyword table: counts computed from the actual texts */
    var kwStatus = {
      have:      { cls: "kw-have",      label: "In your CV" },
      claimable: { cls: "kw-claimable", label: "You have it; add the words" },
      gap:       { cls: "kw-gap",       label: "Real gap" }
    };
    var kwBody = $("kwBody");
    kwBody.innerHTML = "";
    kw.rows.forEach(function (r) {
      var st = kwStatus[r.status];
      var tr = document.createElement("tr");
      var tdTerm = document.createElement("td");
      tdTerm.className = "kw-term";
      tdTerm.textContent = r.term;
      var tdPost = document.createElement("td");
      tdPost.className = "kw-num";
      tdPost.textContent = r.inPosting + "×";
      var tdCv = document.createElement("td");
      tdCv.className = "kw-num" + (r.inCv === 0 ? " zero" : "");
      tdCv.textContent = r.inCv + "×";
      var tdSt = document.createElement("td");
      var pill = document.createElement("span");
      pill.className = "kw-pill " + st.cls;
      pill.textContent = st.label;
      tdSt.appendChild(pill);
      tr.appendChild(tdTerm); tr.appendChild(tdPost); tr.appendChild(tdCv); tr.appendChild(tdSt);
      kwBody.appendChild(tr);
    });
    $("kwSummary").textContent = kw.rows.length
      ? kw.now + " of 100 keyword match today. Add the exact words for skills you already have (the amber rows) and it reaches " + kw.potential + "."
      : "";
    $("kwBlock").classList.toggle("hidden", !kw.rows.length);

    /* Closing the gaps: the CV edit plus the honest longer play */
    var gapsEl = $("gapActions");
    gapsEl.innerHTML = "";
    var gapActions = a.gap_actions || [];
    gapActions.forEach(function (g) {
      var div = document.createElement("div");
      div.className = "gap-action";
      var b = document.createElement("b");
      b.textContent = g.gap || "";
      div.appendChild(b);
      if (g.cv_fix) {
        var p1 = document.createElement("p");
        var s1 = document.createElement("span");
        s1.className = "ga-tag";
        s1.textContent = "On the CV: ";
        p1.appendChild(s1);
        p1.appendChild(document.createTextNode(g.cv_fix));
        div.appendChild(p1);
      }
      if (g.beyond_cv) {
        var p2 = document.createElement("p");
        var s2 = document.createElement("span");
        s2.className = "ga-tag";
        s2.textContent = "Beyond the CV: ";
        p2.appendChild(s2);
        p2.appendChild(document.createTextNode(g.beyond_cv));
        div.appendChild(p2);
      }
      gapsEl.appendChild(div);
    });
    $("gapBlock").classList.toggle("hidden", !gapActions.length);

    var moves = $("movesList");
    moves.innerHTML = "";
    (a.next_moves || []).forEach(function (m) {
      var div = document.createElement("div");
      div.className = "move";
      var inner = document.createElement("div");
      var b = document.createElement("b");
      b.textContent = m.title || "";
      var p = document.createElement("p");
      p.textContent = m.detail || "";
      inner.appendChild(b);
      inner.appendChild(p);
      div.appendChild(inner);
      moves.appendChild(div);
    });

    lastVerdict = a;
    lastKw = kw;
    lastJobText = jobText || "";
    lastGen = null;
    $("genOutput").hidden = true;
    $("cvOut").textContent = "";
    $("clOut").textContent = "";
    setGenStatus("");
    syncGenGate();
    dirty = false;
    goStep(3);
  }

  var lastVerdict = null;
  var lastKw = null;

  $("analyseBtn").addEventListener("click", function () {
    var jobText = $("jobText").value.trim();
    if (!jobText) { setStatus("Paste a job posting first.", true); return; }

    var url = $("jobUrl").value.trim();
    var agg = detectAggregator(url);
    var g0 = agg ? "job board, not the employer" : (confirmedLive ? "you confirmed the link is live" : (url ? "link not opened" : "no link provided"));
    var meta = new Date().toLocaleDateString("en-CA") + " · Posting link: " + g0;

    var provider = "builtin";
    var apiKey = "";
    try {
      provider = localStorage.getItem("llm_provider") || "builtin";
      apiKey = localStorage.getItem("llm_api_key") || "";
    } catch (e) {}

    if (providerNeedsKey(provider) && !apiKey) {
      if (jobText.indexOf("Acme Health Tech") !== -1) {
        renderVerdict(SAMPLE_VERDICT, meta + " · Sample verdict (no API key set)", jobText);
        return;
      }
      setStatus("Add an API key in step 1 (Advanced), or switch the provider back to Built-in.", true);
      return;
    }

    setStatus("Analysing. This takes about ten seconds.", false);
    $("analyseBtn").disabled = true;

    llmChat("CANDIDATE PROFILE:\n" + buildProfileText() + "\n\nJOB POSTING:\n" + jobText, {
      system: SYSTEM_PROMPT, maxTokens: 1500, provider: provider, apiKey: apiKey
    }).then(function (raw) {
      var a;
      try { a = JSON.parse(raw); }
      catch (e) {
        var m = raw.match(/\{[\s\S]*\}/);
        a = m ? JSON.parse(m[0]) : null;
      }
      if (!a) throw new Error("The AI returned an unreadable response. Try again.");
      setStatus("");
      renderVerdict(a, meta, jobText);
    }).catch(function (err) {
      var msg = String(err && err.message || err);
      if (msg.indexOf("401") !== -1 || /auth/i.test(msg)) {
        setStatus("That API key was rejected. Check it in step 1 and try again.", true);
      } else if (msg.indexOf("429") !== -1 || /rate|capacity/i.test(msg)) {
        setStatus("The free built-in AI has hit its fair-use limit. Try again in an hour, or add your own API key in step 1 (Advanced) for unlimited use.", true);
      } else {
        setStatus("Analysis failed: " + msg, true);
      }
    }).then(function () {
      $("analyseBtn").disabled = false;
    });
  });

  $("analyseAnother").addEventListener("click", function () {
    $("jobText").value = "";
    $("jobUrl").value = "";
    saveJob();
    confirmedLive = false;
    $("aggWarning").classList.add("hidden");
    $("openUrlBtn").hidden = true;
    $("g0Actions").hidden = true;
    $("g0Status").innerHTML = "";
    setStatus("");
    goStep(2);
  });

  function buildVerdictText() {
    var a = lastVerdict;
    if (!a) return "";
    var kw = lastKw || { rows: [], now: 0, potential: 0 };
    var statusWord = { met: "MET", partial: "PARTIAL", missing: "MISSING" };
    var kwWord = { have: "in your CV", claimable: "you have it; add the words", gap: "real gap" };
    var out = [
      (a.job_title || "Role") + (a.company ? " - " + a.company : ""),
      "Verdict: " + (a.application_recommendation || ""),
      "Why: " + (a.recommendation_reason || ""),
      "Keyword match score: " + kw.now + " out of 100 (target band: 75+ = strongly aligned)" +
        (kw.potential > kw.now ? " — reachable with honest edits: " + kw.potential : ""),
      "Overall fit: " + (a.overall_fit || 0) + " / Salary signal: " + (a.salary_match || "")
    ];
    var fixes = buildFixList(a, kw);
    if (fixes.length) {
      out.push("", "Fix these first, in order:");
      fixes.forEach(function (f, i) { out.push((i + 1) + ". " + f); });
    }
    if (a.requirements && a.requirements.length) {
      out.push("", "Requirements scorecard (the posting's own asks):");
      a.requirements.forEach(function (r) {
        out.push("- [" + (statusWord[r.status] || "MISSING") + "] " + (r.requirement || "") +
          " (" + (r.priority === "must" ? "must-have" : "nice-to-have") + "): " + (r.evidence || ""));
      });
    }
    if (kw.rows.length) {
      out.push("", "Keywords (times in posting vs times in your CV):");
      kw.rows.forEach(function (r) {
        out.push("- " + r.term + ": " + r.inPosting + "x in posting, " + r.inCv + "x in CV (" + kwWord[r.status] + ")");
      });
    }
    if (a.gap_actions && a.gap_actions.length) {
      out.push("", "Closing the gaps:");
      a.gap_actions.forEach(function (g) {
        out.push("- " + (g.gap || ""));
        if (g.cv_fix) out.push("  On the CV: " + g.cv_fix);
        if (g.beyond_cv) out.push("  Beyond the CV: " + g.beyond_cv);
      });
    }
    out.push("", "Next moves:");
    out.push((a.next_moves || []).map(function (m, i) { return (i + 1) + ". " + m.title + ": " + m.detail; }).join("\n"));
    return out.join("\n");
  }

  $("copyVerdict").addEventListener("click", function () {
    if (!lastVerdict) return;
    var btn = this;
    navigator.clipboard.writeText(buildVerdictText()).then(function () {
      btn.textContent = "Copied";
      setTimeout(function () { btn.textContent = "Copy"; }, 1600);
    });
  });

  $("downloadVerdict").addEventListener("click", function () {
    if (!lastVerdict) return;
    var a = lastVerdict;
    var base = ((a.job_title || "verdict") + " " + (a.company || ""))
      .replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase();
    var blob = new Blob([buildVerdictText()], { type: "text/plain;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = (base || "career-coach-verdict") + ".txt";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  });

  /* ══════════════════════════════════════════════════════════════
     Generation layer: tailored CV + cover letter (the paid part).
     Free/paid split per the 2026-07-11 pricing research: triage
     (everything above this block) stays free; document generation
     runs on the user's own key at no charge, or on the built-in
     provider against a $5-for-15 generation pack.
     ════════════════════════════════════════════════════════════ */
  var CREDITS_KEY = "cc-v2-credits";
  var lastJobText = "";
  var lastGen = null;

  function loadCredits() {
    try { return JSON.parse(localStorage.getItem(CREDITS_KEY)) || { remaining: 0 }; }
    catch (e) { return { remaining: 0 }; }
  }
  function saveCredits(c) {
    try { localStorage.setItem(CREDITS_KEY, JSON.stringify(c)); } catch (e) {}
  }
  function activeProvider() {
    try { return localStorage.getItem("llm_provider") || "builtin"; } catch (e) { return "builtin"; }
  }
  function canGenerate() {
    var p = activeProvider();
    if (p !== "builtin") return true;      /* BYOK or local: their key, their machine */
    return loadCredits().remaining > 0;    /* built-in: paid generation pack */
  }
  function syncGenGate() {
    if (!$("genGate")) return;
    var p = activeProvider();
    var allowed = canGenerate();
    $("genGate").hidden = allowed;
    $("genActions").hidden = !allowed;
    var note = "";
    if (allowed && p === "builtin") {
      var r = loadCredits().remaining;
      note = r + " generation" + (r === 1 ? "" : "s") + " left on your pack.";
    } else if (allowed) {
      note = "Runs on your own key. No charge from us.";
    }
    $("genCreditsNote").textContent = note;
  }
  $("provider").addEventListener("change", syncGenGate);

  function setGenStatus(msg, isErr) {
    var el = $("genStatus");
    el.textContent = msg;
    el.className = "status-line" + (isErr ? " err" : "");
  }

  var GEN_SYSTEM = 'You are a sharp, practical career coach producing application documents. Using ONLY the candidate\'s CV and profile, tailor a CV and write a cover letter for the specific job posting. ' +
    'HARD RULE: never invent employers, job titles, dates, credentials, metrics, or skills that are not in the CV. You may reword, reorder, and reprioritize real CV content into the posting\'s vocabulary; you may not add anything the CV does not support. ' +
    'TAILORED CV: plain Markdown, single column. Start with a # line for the candidate\'s name and keep whatever contact lines the CV has (never invent contact details). Use ## section headings (for example Professional Summary, Core Skills, Experience, Education). Bullets use "-". Lead with the content most relevant to this posting, and use the posting\'s exact keyword phrasing wherever the CV genuinely supports the skill. ' +
    'COVER LETTER: 3 or 4 short paragraphs in plain Canadian English, specific to this posting and this CV. Confident and factual; no affirmation-style filler, no gushing. Start at the salutation (no date, no inside address). Sign off with the candidate\'s name from the CV. ' +
    'Return the two documents in exactly this format, nothing before or after:\n' +
    '=== TAILORED CV ===\n(the CV markdown)\n=== COVER LETTER ===\n(the cover letter markdown)';

  $("generateBtn").addEventListener("click", function () {
    if (!lastVerdict) return;
    if (!canGenerate()) { syncGenGate(); return; }
    var provider = activeProvider();
    var apiKey = "";
    try { apiKey = localStorage.getItem("llm_api_key") || ""; } catch (e) {}
    if (providerNeedsKey(provider) && !apiKey) {
      setGenStatus("Add an API key in step 1 (Advanced) first.", true);
      return;
    }
    setGenStatus("Building your documents. This takes twenty to thirty seconds.", false);
    $("generateBtn").disabled = true;

    llmChat(
      "CANDIDATE PROFILE:\n" + buildProfileText() +
      "\n\nJOB POSTING:\n" + lastJobText +
      "\n\nANALYSIS CONTEXT (from the verdict, for emphasis only — not CV content):\n" +
      (lastVerdict.recommendation_reason || ""),
      { system: GEN_SYSTEM, maxTokens: 4000, provider: provider, apiKey: apiKey }
    ).then(function (raw) {
      var afterCv = raw.split(/===\s*TAILORED CV\s*===/i);
      var rest = afterCv.length > 1 ? afterCv[1] : raw;
      var parts = rest.split(/===\s*COVER LETTER\s*===/i);
      var cv = (parts[0] || "").trim();
      var cl = (parts[1] || "").trim();
      if (!cv || !cl) throw new Error("The AI returned an unexpected format. Try again.");
      $("cvOut").textContent = cv;
      $("clOut").textContent = cl;
      lastGen = { cv: cv, cl: cl };
      $("genOutput").hidden = false;
      if (provider === "builtin") {
        var c = loadCredits();
        c.remaining = Math.max(0, (c.remaining || 0) - 1);
        saveCredits(c);
      }
      syncGenGate();
      setGenStatus("Done. Read both documents before you send anything.", false);
    }).catch(function (err) {
      var msg = String(err && err.message || err);
      if (msg.indexOf("401") !== -1 || /auth/i.test(msg)) {
        setGenStatus("That API key was rejected. Check it in step 1 and try again.", true);
      } else if (msg.indexOf("429") !== -1 || /rate|capacity/i.test(msg)) {
        setGenStatus("The provider is rate limiting right now. Wait a minute and try again.", true);
      } else {
        setGenStatus("Generation failed: " + msg, true);
      }
    }).then(function () {
      $("generateBtn").disabled = false;
    });
  });

  function genFileBase(suffix) {
    var a = lastVerdict || {};
    var base = ((a.job_title || "role") + " " + (a.company || ""))
      .replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase();
    return (base || "career-coach") + "-" + suffix;
  }
  function downloadText(name, text, mime) {
    var blob = new Blob([text], { type: mime + ";charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }
  function copyGen(btn, text) {
    navigator.clipboard.writeText(text).then(function () {
      var old = btn.textContent;
      btn.textContent = "Copied";
      setTimeout(function () { btn.textContent = old; }, 1600);
    });
  }

  /* Minimal Markdown → HTML for the ATS-safe print view. Input is escaped
     first; only headings, bullets, bold, and paragraphs are recognised. */
  function escHtml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function mdToHtml(md) {
    var lines = escHtml(md).split("\n");
    var html = [];
    var inUl = false;
    function closeUl() { if (inUl) { html.push("</ul>"); inUl = false; } }
    lines.forEach(function (l) {
      var t = l.trim();
      if (/^###\s+/.test(t)) { closeUl(); html.push("<h3>" + t.replace(/^###\s+/, "") + "</h3>"); }
      else if (/^##\s+/.test(t)) { closeUl(); html.push("<h2>" + t.replace(/^##\s+/, "") + "</h2>"); }
      else if (/^#\s+/.test(t)) { closeUl(); html.push("<h1>" + t.replace(/^#\s+/, "") + "</h1>"); }
      else if (/^[-*]\s+/.test(t)) {
        if (!inUl) { html.push("<ul>"); inUl = true; }
        html.push("<li>" + t.replace(/^[-*]\s+/, "") + "</li>");
      }
      else if (t === "") { closeUl(); }
      else { closeUl(); html.push("<p>" + t + "</p>"); }
    });
    closeUl();
    return html.join("\n").replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
  }

  /* ATS-safe print template: single column, standard fonts, no tables,
     no text boxes, no graphics. Exported via the browser's own
     Print → Save as PDF — no PDF library, no server. */
  var PRINT_CSS =
    "body{font-family:Arial,Helvetica,sans-serif;font-size:11pt;line-height:1.45;color:#111;max-width:7.5in;margin:0 auto;padding:0.55in 0.5in;}" +
    "h1{font-size:16pt;margin:0 0 4pt;}" +
    "h2{font-size:11.5pt;text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid #999;padding-bottom:2pt;margin:14pt 0 6pt;}" +
    "h3{font-size:11pt;margin:10pt 0 3pt;}" +
    "p{margin:0 0 7pt;}ul{margin:3pt 0 8pt 16pt;padding:0;}li{margin:0 0 3pt;}" +
    ".no-print{text-align:center;margin:26pt 0;}" +
    ".no-print button{font:600 12pt Arial,Helvetica,sans-serif;padding:8pt 18pt;cursor:pointer;}" +
    "@media print{.no-print{display:none;}body{padding:0;}}";

  function openPrintView(title, md) {
    var w = window.open("", "_blank");
    if (!w) {
      setGenStatus("Your browser blocked the print window. Allow pop-ups for this page and try again.", true);
      return;
    }
    w.document.write(
      '<!DOCTYPE html><html lang="en-CA"><head><meta charset="utf-8">' +
      "<title>" + escHtml(title) + "</title><style>" + PRINT_CSS + "</style></head><body>" +
      mdToHtml(md) +
      '<div class="no-print"><button type="button" onclick="window.print()">Print / save as PDF</button></div>' +
      "</body></html>"
    );
    w.document.close();
  }

  $("copyCv").addEventListener("click", function () { if (lastGen) copyGen(this, lastGen.cv); });
  $("copyCl").addEventListener("click", function () { if (lastGen) copyGen(this, lastGen.cl); });
  $("dlCvMd").addEventListener("click", function () { if (lastGen) downloadText(genFileBase("cv") + ".md", lastGen.cv, "text/markdown"); });
  $("dlClMd").addEventListener("click", function () { if (lastGen) downloadText(genFileBase("cover-letter") + ".md", lastGen.cl, "text/markdown"); });
  $("printCv").addEventListener("click", function () { if (lastGen) openPrintView("Tailored CV", lastGen.cv); });
  $("printCl").addEventListener("click", function () { if (lastGen) openPrintView("Cover letter", lastGen.cl); });

  /* If a profile already exists, land on step 2 (the job is the centre of gravity). */
  if (profile.cv) goStep(2);
}());
