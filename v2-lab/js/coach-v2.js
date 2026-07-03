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
  var profile = loadProfile();
  if (profile.cv) $("pCV").value = profile.cv;
  if (profile.minSal) $("pMinSal").value = profile.minSal;
  if (profile.targetSal) $("pTargetSal").value = profile.targetSal;
  if (profile.location) $("pLocation").value = profile.location;
  if (profile.priorities) $("pPriorities").value = profile.priorities;
  if (profile.avoid) $("pAvoid").value = profile.avoid;

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

  $("toStep2").addEventListener("click", function () {
    var cv = $("pCV").value.trim();
    if (!cv) {
      $("profileSavedNote").textContent = "Paste your CV first. The verdict is scored against it.";
      $("pCV").focus();
      return;
    }
    profile = {
      cv: cv,
      minSal: $("pMinSal").value.trim(),
      targetSal: $("pTargetSal").value.trim(),
      location: $("pLocation").value.trim(),
      priorities: $("pPriorities").value.trim(),
      avoid: $("pAvoid").value.trim()
    };
    saveProfile(profile);
    try {
      localStorage.setItem("llm_provider", $("provider").value);
      var k = $("apiKey").value.trim();
      if (k) localStorage.setItem("llm_api_key", k);
    } catch (e) {}
    $("profileSavedNote").textContent = "";
    goStep(2);
  });
  $("backTo1").addEventListener("click", function () { goStep(1); });

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
    setStatus("Sample posting loaded. Get the verdict to see the full analysis. Without an API key you get a built-in sample verdict.", false);
  });

  /* ── Analysis ──────────────────────────────────────────────── */
  function setStatus(msg, isErr) {
    var el = $("statusLine");
    el.textContent = msg;
    el.className = "status-line" + (isErr ? " err" : "");
  }

  var SYSTEM_PROMPT = 'You are a sharp, practical career coach. Analyse the job posting against the candidate profile and return ONLY valid JSON, no markdown, no code fences, exactly this structure: {"job_title":"string","company":"string","ats_score":0,"overall_fit":0,"salary_match":"above target|at target|below target|not specified","application_recommendation":"apply custom|apply generic|skip","recommendation_reason":"string, 2 sentences, plain Canadian English, specific to this posting","cv_strengths":["3 to 5 items"],"cv_gaps":["2 to 4 items"],"next_moves":[{"title":"string","detail":"one sentence"},{"title":"string","detail":"one sentence"},{"title":"string","detail":"one sentence"}]}';

  function buildProfileText() {
    return "Minimum salary: " + (profile.minSal ? "$" + profile.minSal + " CAD" : "not specified") +
      "\nTarget salary: " + (profile.targetSal ? "$" + profile.targetSal + " CAD" : "not specified") +
      "\nLocation and arrangement: " + (profile.location || "not specified") +
      "\nPriorities: " + (profile.priorities || "not specified") +
      "\nHard passes: " + (profile.avoid || "none stated") +
      "\n\nCV:\n" + profile.cv;
  }

  var SAMPLE_VERDICT = {
    job_title: "Senior Product Manager",
    company: "Acme Health Tech",
    ats_score: 82,
    overall_fit: 74,
    salary_match: "at target",
    application_recommendation: "apply custom",
    recommendation_reason: "Your platform and stakeholder experience covers most of the stated requirements, and the salary band overlaps your target. The gap is healthcare domain language, which a custom CV can close.",
    cv_strengths: [
      "Direct roadmap ownership across multiple squads",
      "Shipping record on consumer-scale mobile products",
      "Executive-level communication and quarterly reviews",
      "Mentoring junior product managers"
    ],
    cv_gaps: [
      "No explicit healthcare or regulated-industry vocabulary",
      "SQL and analytics tooling not named on the CV",
      "No A/B testing programme called out"
    ],
    next_moves: [
      { title: "Surface your regulated-industry work", detail: "Rename one CV bullet to use compliance and privacy language the screener will search for." },
      { title: "Name your tools", detail: "Add SQL and your analytics stack to the skills line; the ATS is matching on exact words." },
      { title: "Verify the posting at the source", detail: "Confirm the role on the employer's own careers page before you submit." }
    ],
    _sample: true
  };

  function bandClass(score) {
    return score >= 70 ? "strong" : score >= 45 ? "caution" : "weak";
  }

  function renderVerdict(a, meta) {
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

    var ats = Math.max(0, Math.min(100, a.ats_score || 0));
    var fit = Math.max(0, Math.min(100, a.overall_fit || 0));
    $("mAts").textContent = ats;
    $("mAts").className = "m-value " + bandClass(ats);
    $("mAtsFill").style.width = ats + "%";
    $("mAtsFill").className = "meter-fill " + bandClass(ats);
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

    function fillList(id, items, icon, iconClass) {
      var ul = $(id);
      ul.innerHTML = "";
      (items || []).forEach(function (t) {
        var li = document.createElement("li");
        var ic = document.createElement("span");
        ic.className = "ic " + iconClass;
        ic.textContent = icon;
        li.appendChild(ic);
        li.appendChild(document.createTextNode(t));
        ul.appendChild(li);
      });
    }
    fillList("strengthList", a.cv_strengths, "✓", "yes");
    fillList("gapList", a.cv_gaps, "✗", "no");

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
    goStep(3);
  }

  var lastVerdict = null;

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
        renderVerdict(SAMPLE_VERDICT, meta + " · Sample verdict (no API key set)");
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
      renderVerdict(a, meta);
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
    confirmedLive = false;
    $("aggWarning").classList.add("hidden");
    $("openUrlBtn").hidden = true;
    $("g0Actions").hidden = true;
    $("g0Status").innerHTML = "";
    setStatus("");
    goStep(2);
  });

  $("copyVerdict").addEventListener("click", function () {
    if (!lastVerdict) return;
    var a = lastVerdict;
    var lines = [
      (a.job_title || "Role") + (a.company ? " - " + a.company : ""),
      "Verdict: " + (a.application_recommendation || ""),
      "Why: " + (a.recommendation_reason || ""),
      "ATS match: " + (a.ats_score || 0) + " / Overall fit: " + (a.overall_fit || 0) + " / Salary: " + (a.salary_match || ""),
      "",
      "Strengths:",
      (a.cv_strengths || []).map(function (s) { return "- " + s; }).join("\n"),
      "",
      "Gaps:",
      (a.cv_gaps || []).map(function (s) { return "- " + s; }).join("\n"),
      "",
      "Next moves:",
      (a.next_moves || []).map(function (m, i) { return (i + 1) + ". " + m.title + ": " + m.detail; }).join("\n")
    ];
    var btn = this;
    navigator.clipboard.writeText(lines.join("\n")).then(function () {
      btn.textContent = "Copied";
      setTimeout(function () { btn.textContent = "Copy verdict as text"; }, 1600);
    });
  });

  /* If a profile already exists, land on step 2 (the job is the centre of gravity). */
  if (profile.cv) goStep(2);
}());
