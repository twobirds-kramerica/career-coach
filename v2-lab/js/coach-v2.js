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
      toggle.textContent = dark ? "Light mode" : "Dark mode";
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

  function syncProviderUI() {
    var isLocal = $("provider").value === "ollama";
    $("keyField").classList.toggle("hidden", isLocal);
    $("noKeyNote").classList.toggle("hidden", !isLocal);
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

  /* ── Gate 0: aggregator detection (reused from v1 app.js) ──── */
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
      el.innerHTML = '<span class="chip chip-caution">Aggregator</span>';
    } else if (confirmedLive) {
      el.innerHTML = '<span class="chip chip-strong">Confirmed live</span>';
    } else {
      el.innerHTML = '<span class="chip chip-neutral">Unverified</span>';
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
    setStatus("Sample posting loaded. Get the verdict to see the full analysis. Without an API key you get a built-in sample verdict.", false);
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

  function bandClass(score) {
    return score >= 70 ? "strong" : score >= 45 ? "caution" : "weak";
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
    $("mAts").className = "m-value " + bandClass(ats);
    $("mAtsFill").style.width = ats + "%";
    $("mAtsFill").className = "meter-fill " + bandClass(ats);
    var ghost = $("mAtsGhost");
    if (ghost) {
      ghost.style.width = (kw.rows.length ? kw.potential : ats) + "%";
      ghost.className = "meter-fill ghost " + bandClass(kw.rows.length ? kw.potential : ats);
    }
    $("mAtsNote").textContent = kw.rows.length && kw.potential > kw.now
      ? kw.potential + " is reachable with honest wording edits alone."
      : (kw.rows.length ? "The exact-word edits are already in place." : "");
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
    var g0 = agg ? "Aggregator source" : (confirmedLive ? "Link confirmed live" : (url ? "Link unverified" : "No link provided"));
    var meta = new Date().toLocaleDateString("en-CA") + " · Gate zero: " + g0;

    var provider = "anthropic";
    var apiKey = "";
    try {
      provider = localStorage.getItem("llm_provider") || "anthropic";
      apiKey = localStorage.getItem("llm_api_key") || "";
    } catch (e) {}

    var needsKey = provider !== "ollama";
    if (needsKey && !apiKey) {
      if (jobText.indexOf("Acme Health Tech") !== -1) {
        renderVerdict(SAMPLE_VERDICT, meta + " · Sample verdict (no API key set)", jobText);
        return;
      }
      setStatus("Add an API key in step 1 (AI provider and key), or switch to Ollama to run locally.", true);
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
      } else if (msg.indexOf("429") !== -1 || /rate/i.test(msg)) {
        setStatus("Rate limit reached. Wait a moment and try again.", true);
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
      "ATS keyword match: " + kw.now + (kw.potential > kw.now ? " (reachable with honest edits: " + kw.potential + ")" : "") +
        " / Overall fit: " + (a.overall_fit || 0) + " / Salary: " + (a.salary_match || "")
    ];
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

  /* If a profile already exists, land on step 2 (the job is the centre of gravity). */
  if (profile.cv) goStep(2);
}());
