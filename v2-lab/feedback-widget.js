/*
 * Field Feedback Widget
 * Self-contained, dependency-free feedback tool.
 * Drop-in: <script src="feedback-widget.js" defer></script>
 *
 * Behaviour (consent-first, 2026-07-10 rework):
 *   - Floating "Feedback" button (bottom corner).
 *   - Tap it to open a TEXT box. Typing is the default. Nothing listens,
 *     records, or asks for the microphone on open.
 *   - Voice dictation is an explicit opt-in: a button reveals a one-line
 *     explanation, and the microphone is only requested after the person
 *     chooses "Turn on microphone". Spoken words appear as editable text.
 *   - "Point to a spot" is an optional opt-in that lets the person tap a
 *     part of the page to pin a comment. It never arms on its own.
 *   - Discarding non-empty feedback asks for confirmation first.
 *   - Send POSTs a JSON bundle to WIDGET_ENDPOINT; falls back to
 *     localStorage on empty endpoint or failure so nothing is ever lost.
 *
 * No em-dashes. Canadian English.
 */
(function () {
  "use strict";

  // ---- Configuration -------------------------------------------------------
  // Leave "" to run in fallback mode (stores every bundle to localStorage so
  // nothing is ever lost). Set to a URL to POST bundles to your backend.
  var WIDGET_ENDPOINT = "https://field-feedback.twobirdsinnovation.workers.dev/submit";

  var SPEECH_LANG = "en-CA";
  var STORAGE_KEY = "ffw.feedback.bundles";
  var SCHEMA_VERSION = 1;

  // Guard against double-injection.
  if (window.__ffwLoaded) { return; }
  window.__ffwLoaded = true;

  // ---- Self-contained styles (injected once) ------------------------------
  var CSS = [
    ".ffw-root,.ffw-root *{box-sizing:border-box}",
    ".ffw-root{position:fixed;z-index:2147483000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.4;color:#101418}",
    ".ffw-fab{position:fixed;right:18px;bottom:18px;z-index:2147483001;display:inline-flex;align-items:center;gap:8px;padding:12px 16px;border:2px solid #0b3d2e;border-radius:999px;background:#0b6b4f;color:#fff;font-weight:700;font-size:15px;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.28);-webkit-tap-highlight-color:transparent}",
    ".ffw-fab:hover{background:#0a5c44}",
    ".ffw-fab:focus-visible{outline:3px solid #ffd24d;outline-offset:2px}",
    ".ffw-fab-dot{width:10px;height:10px;border-radius:50%;background:#fff;display:inline-block}",
    ".ffw-bar{position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:2147483002;width:min(560px,calc(100vw - 24px));background:#fff;border:2px solid #0b3d2e;border-radius:12px;box-shadow:0 8px 30px rgba(0,0,0,.30);padding:12px 14px}",
    ".ffw-bar-head{display:flex;align-items:center;gap:10px;margin-bottom:8px}",
    ".ffw-bar-title{font-weight:700;flex:1 1 auto}",
    ".ffw-hint{color:#445;font-size:13px}",
    ".ffw-bar-actions{display:flex;gap:8px;margin-top:10px;flex-wrap:wrap}",
    ".ffw-btn{appearance:none;border:2px solid transparent;border-radius:8px;padding:10px 14px;font-weight:700;font-size:14px;cursor:pointer;-webkit-tap-highlight-color:transparent}",
    ".ffw-btn:focus-visible{outline:3px solid #ffd24d;outline-offset:2px}",
    ".ffw-btn-primary{background:#0b6b4f;color:#fff;border-color:#0b3d2e}",
    ".ffw-btn-primary:hover{background:#0a5c44}",
    ".ffw-btn-ghost{background:#fff;color:#101418;border-color:#9aa7a1}",
    ".ffw-btn-ghost:hover{background:#eef2f0}",
    ".ffw-btn-danger{background:#fff;color:#b71c1c;border-color:#e0a1a1}",
    ".ffw-btn-danger:hover{background:#fbeaea}",
    ".ffw-btn-block{width:100%;text-align:left}",
    ".ffw-rec-dot{width:12px;height:12px;border-radius:50%;background:#c62828;animation:ffw-pulse 1.1s ease-in-out infinite;flex:0 0 auto}",
    "@keyframes ffw-pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.35;transform:scale(.8)}}",
    "@media (prefers-reduced-motion: reduce){.ffw-rec-dot{animation:none}}",
    ".ffw-pin{position:absolute;z-index:2147483001;min-width:24px;height:24px;padding:0 6px;border-radius:999px;background:#c62828;color:#fff;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.4);font-weight:800;font-size:13px;line-height:20px;text-align:center;pointer-events:none}",
    ".ffw-arming,.ffw-arming *{cursor:crosshair !important}",
    ".ffw-overlay{position:fixed;inset:0;z-index:2147483003;background:rgba(8,14,12,.55);display:flex;align-items:center;justify-content:center;padding:16px}",
    ".ffw-panel{width:min(620px,100%);max-height:88vh;overflow-y:auto;background:#fff;border:2px solid #0b3d2e;border-radius:14px;box-shadow:0 16px 50px rgba(0,0,0,.4);padding:18px 18px 16px}",
    ".ffw-panel h2{margin:0 0 4px;font-size:19px}",
    ".ffw-panel .ffw-sub{color:#445;margin:0 0 14px;font-size:13px}",
    ".ffw-field-label{font-weight:700;margin:12px 0 6px}",
    ".ffw-review-text{width:100%;min-height:120px;border:1px solid #9aa7a1;border-radius:8px;padding:10px 12px;font:inherit;resize:vertical}",
    ".ffw-opt{margin-top:14px}",
    ".ffw-voice-panel{margin-top:8px;padding:10px 12px;border:1px solid #cdd7d3;border-radius:8px;background:#f4f7f6}",
    ".ffw-voice-explain{margin:0 0 10px;color:#334;font-size:13px}",
    ".ffw-voice-live{display:flex;align-items:center;gap:8px;margin-top:8px;font-size:13px;color:#334;font-weight:600}",
    ".ffw-voice-interim{color:#667;font-style:italic;font-weight:400}",
    ".ffw-point-count{margin-left:10px;font-size:13px;color:#445}",
    ".ffw-pinlist{list-style:none;margin:8px 0 0;padding:0}",
    ".ffw-pinlist li{display:flex;gap:10px;align-items:flex-start;border:1px solid #dde5e2;border-radius:8px;padding:8px 10px;margin-bottom:8px}",
    ".ffw-pinlist .ffw-pin-num{flex:0 0 auto;background:#c62828;color:#fff;border-radius:999px;width:24px;height:24px;line-height:24px;text-align:center;font-weight:800;font-size:13px}",
    ".ffw-pin-body{flex:1 1 auto;min-width:0}",
    ".ffw-pin-text{font-weight:600;word-break:break-word}",
    ".ffw-pin-sel{color:#556;font-size:12px;word-break:break-all;font-family:ui-monospace,Menlo,Consolas,monospace}",
    ".ffw-panel-actions{display:flex;gap:8px;margin-top:18px;flex-wrap:wrap}",
    ".ffw-panel-actions .ffw-btn-primary{flex:1 1 auto}",
    ".ffw-status{margin-top:10px;font-size:13px;font-weight:600}",
    ".ffw-status-ok{color:#0b6b4f}",
    ".ffw-status-warn{color:#b26a00}",
    ".ffw-status-err{color:#b71c1c}"
  ].join("");

  function injectStyles() {
    if (document.getElementById("ffw-styles")) { return; }
    var s = document.createElement("style");
    s.id = "ffw-styles";
    s.textContent = CSS;
    (document.head || document.documentElement).appendChild(s);
  }

  // ---- State ---------------------------------------------------------------
  var state = {
    finalTranscript: "",   // the person's typed + dictated feedback
    pins: [],              // { n, selector, text, rect }
    recognition: null,
    speechSupported: false,
    voiceOn: false,
    pointing: false
  };

  // DOM refs created lazily
  var el = {
    root: null,
    fab: null,
    overlay: null,
    composeText: null,
    voiceInterim: null,
    bar: null,
    pinLayer: null
  };

  // ---- Utilities -----------------------------------------------------------
  function elt(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) { n.className = cls; }
    if (text != null) { n.textContent = text; }
    return n;
  }

  function trim(s) { return (s || "").replace(/\s+/g, " ").trim(); }

  function deviceKind() {
    var w = window.innerWidth || document.documentElement.clientWidth || 0;
    var mobileUA = /Mobi|Android|iPhone|iPad|iPod|Windows Phone/i.test(navigator.userAgent || "");
    return (mobileUA || w < 768) ? "mobile" : "desktop";
  }

  // Build a robust CSS selector path for an element.
  function cssPath(node) {
    if (!(node instanceof Element)) { return ""; }
    if (node.id) {
      var byId = "#" + cssEscape(node.id);
      try {
        if (document.querySelectorAll(byId).length === 1) { return byId; }
      } catch (e) { /* fall through */ }
    }
    var parts = [];
    var cur = node;
    while (cur && cur.nodeType === 1 && cur !== document.documentElement) {
      var seg = cur.nodeName.toLowerCase();
      if (cur.id) {
        seg += "#" + cssEscape(cur.id);
        parts.unshift(seg);
        break;
      }
      var cls = firstStableClass(cur);
      if (cls) { seg += "." + cssEscape(cls); }
      var idx = nthOfType(cur);
      if (idx > 0) { seg += ":nth-of-type(" + idx + ")"; }
      parts.unshift(seg);
      cur = cur.parentElement;
      if (parts.length >= 6) { break; }
    }
    return parts.join(" > ");
  }

  function firstStableClass(node) {
    if (!node.classList || !node.classList.length) { return ""; }
    for (var i = 0; i < node.classList.length; i++) {
      var c = node.classList[i];
      if (c.indexOf("ffw-") === 0) { continue; }
      if (/\d{4,}/.test(c)) { continue; }
      return c;
    }
    return "";
  }

  function nthOfType(node) {
    var parent = node.parentElement;
    if (!parent) { return 0; }
    var same = 0, index = 0;
    var kids = parent.children;
    for (var i = 0; i < kids.length; i++) {
      if (kids[i].nodeName === node.nodeName) {
        same++;
        if (kids[i] === node) { index = same; }
      }
    }
    return same > 1 ? index : 0;
  }

  function cssEscape(s) {
    if (window.CSS && CSS.escape) { return window.CSS.escape(s); }
    return String(s).replace(/[^a-zA-Z0-9_-]/g, function (ch) { return "\\" + ch; });
  }

  // ---- Persistence ---------------------------------------------------------
  function saveLocal(bundle) {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(arr)) { arr = []; }
      arr.push(bundle);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
      return true;
    } catch (e) {
      return false;
    }
  }

  // ---- Context bundle ------------------------------------------------------
  function buildBundle(transcript) {
    return {
      schemaVersion: SCHEMA_VERSION,
      transcript: trim(transcript),
      pins: state.pins.map(function (p) {
        return { n: p.n, selector: p.selector, text: p.text, rect: p.rect };
      }),
      context: {
        url: location.href,
        title: document.title || "",
        referrer: document.referrer || "",
        device: deviceKind(),
        userAgent: navigator.userAgent || "",
        viewport: { width: window.innerWidth || 0, height: window.innerHeight || 0 },
        scroll: { x: window.scrollX || window.pageXOffset || 0, y: window.scrollY || window.pageYOffset || 0 },
        language: navigator.language || "",
        speechUsed: state.speechSupported
      },
      // Backend stamps the authoritative time. This is a client hint only.
      timestamp: null,
      clientTimestamp: new Date().toISOString()
    };
  }

  // ---- Pins ----------------------------------------------------------------
  function ensurePinLayer() {
    if (el.pinLayer && el.pinLayer.isConnected) { return; }
    el.pinLayer = elt("div", "ffw-pin-layer");
    el.pinLayer.style.position = "absolute";
    el.pinLayer.style.top = "0";
    el.pinLayer.style.left = "0";
    el.pinLayer.style.width = "0";
    el.pinLayer.style.height = "0";
    el.pinLayer.style.zIndex = "2147483001";
    document.body.appendChild(el.pinLayer);
  }

  function addPin(target) {
    if (!(target instanceof Element)) { return; }
    ensurePinLayer();
    var rect = target.getBoundingClientRect();
    var n = state.pins.length + 1;
    var pin = {
      n: n,
      selector: cssPath(target),
      text: trim(target.innerText || target.textContent || target.getAttribute("aria-label") || target.getAttribute("alt") || "").slice(0, 240),
      rect: {
        x: Math.round(rect.left + window.scrollX),
        y: Math.round(rect.top + window.scrollY),
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      }
    };
    state.pins.push(pin);

    var marker = elt("div", "ffw-pin", String(n));
    marker.style.left = (pin.rect.x) + "px";
    marker.style.top = (pin.rect.y) + "px";
    marker.setAttribute("data-ffw-pin", String(n));
    el.pinLayer.appendChild(marker);
  }

  function clearPins() {
    state.pins = [];
    if (el.pinLayer) { el.pinLayer.innerHTML = ""; }
  }

  // ---- Speech recognition (opt-in only) ------------------------------------
  function appendToCompose(text) {
    var ta = el.composeText;
    if (!ta) { return; }
    var add = trim(text);
    if (!add) { return; }
    var sep = (ta.value && !/\s$/.test(ta.value)) ? " " : "";
    ta.value += sep + add;
  }

  function makeRecognition() {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { return null; }
    var r = new SR();
    r.lang = SPEECH_LANG;
    r.continuous = true;
    r.interimResults = true;
    r.onresult = function (e) {
      var interim = "";
      for (var i = e.resultIndex; i < e.results.length; i++) {
        var res = e.results[i];
        if (res.isFinal) { appendToCompose(res[0].transcript); }
        else { interim += res[0].transcript; }
      }
      if (el.voiceInterim) { el.voiceInterim.textContent = trim(interim); }
    };
    r.onerror = function (e) {
      if (e && (e.error === "not-allowed" || e.error === "service-not-allowed")) {
        state.speechSupported = false;
      }
    };
    r.onend = function () {
      // Chrome ends after silence; keep going while the person wants voice on.
      if (state.voiceOn && state.recognition) {
        try { state.recognition.start(); } catch (e) { /* already started */ }
      }
    };
    return r;
  }

  function startVoice(liveBox) {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      if (liveBox) {
        liveBox.textContent = "Voice typing is not available in this browser. Please type your feedback above.";
      }
      return;
    }
    state.speechSupported = true;
    state.voiceOn = true;
    state.recognition = makeRecognition();
    try { state.recognition.start(); }
    catch (e) { /* start called twice is harmless */ }
  }

  function stopVoice() {
    state.voiceOn = false;
    if (state.recognition) {
      try { state.recognition.stop(); } catch (e) { /* ignore */ }
      state.recognition = null;
    }
    el.voiceInterim = null;
  }

  // ---- Compose overlay (text-first) ---------------------------------------
  function openCompose() {
    stopVoice();
    removeOverlay();

    var overlay = elt("div", "ffw-overlay");
    var panel = elt("div", "ffw-panel");
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-label", "Share your feedback");

    panel.appendChild(elt("h2", null, "Share your feedback"));
    panel.appendChild(elt("p", "ffw-sub", "Type your feedback below. We read every note. Nothing is sent until you choose Send."));

    // Primary: text box (focused by default).
    var ta = elt("textarea", "ffw-review-text");
    ta.id = "ffw-compose-text";
    ta.setAttribute("aria-label", "Your feedback");
    ta.placeholder = "Type your feedback here.";
    ta.value = state.finalTranscript || "";
    el.composeText = ta;
    panel.appendChild(ta);

    // Opt-in: voice dictation.
    panel.appendChild(buildVoiceOptIn());

    // Opt-in: point to a spot on the page.
    panel.appendChild(buildPointOptIn());

    // Pinned spots so far.
    if (state.pins.length) {
      panel.appendChild(elt("div", "ffw-field-label", "Spots you pointed to (" + state.pins.length + ")"));
      var ul = elt("ul", "ffw-pinlist");
      state.pins.forEach(function (p) {
        var li = elt("li");
        li.appendChild(elt("span", "ffw-pin-num", String(p.n)));
        var body = elt("div", "ffw-pin-body");
        body.appendChild(elt("div", "ffw-pin-text", p.text ? ('"' + p.text + '"') : "(no visible text)"));
        body.appendChild(elt("div", "ffw-pin-sel", p.selector));
        li.appendChild(body);
        ul.appendChild(li);
      });
      panel.appendChild(ul);
    }

    var status = elt("div", "ffw-status");
    status.id = "ffw-compose-status";

    var actions = elt("div", "ffw-panel-actions");
    var sendBtn = elt("button", "ffw-btn ffw-btn-primary", "Send feedback");
    sendBtn.type = "button";
    sendBtn.addEventListener("click", function () {
      state.finalTranscript = ta.value || "";
      sendBundle(sendBtn, status);
    });
    var discardBtn = elt("button", "ffw-btn ffw-btn-danger", "Discard");
    discardBtn.type = "button";
    discardBtn.addEventListener("click", onDiscard);
    actions.appendChild(sendBtn);
    actions.appendChild(discardBtn);

    panel.appendChild(actions);
    panel.appendChild(status);
    overlay.appendChild(panel);
    el.root.appendChild(overlay);
    el.overlay = overlay;
    if (el.fab) { el.fab.style.display = "none"; }
    ta.focus();
  }

  function buildVoiceOptIn() {
    var wrap = elt("div", "ffw-opt");
    var toggle = elt("button", "ffw-btn ffw-btn-ghost ffw-btn-block", "🎤 Speak instead of typing");
    toggle.type = "button";
    toggle.setAttribute("aria-expanded", "false");
    wrap.appendChild(toggle);

    toggle.addEventListener("click", function () {
      // If the explainer is already open, collapse it (mic never armed here).
      var existing = wrap.querySelector(".ffw-voice-panel");
      if (existing) {
        stopVoice();
        wrap.removeChild(existing);
        toggle.setAttribute("aria-expanded", "false");
        toggle.textContent = "🎤 Speak instead of typing";
        return;
      }
      toggle.setAttribute("aria-expanded", "true");

      var vp = elt("div", "ffw-voice-panel");
      // One-line explanation shown BEFORE the microphone is ever requested.
      vp.appendChild(elt("p", "ffw-voice-explain",
        "This turns on your device's microphone so you can speak instead of type. Your words appear as text above that you can edit. The microphone only turns on when you choose Turn on microphone, and nothing is sent until you press Send."));

      var startBtn = elt("button", "ffw-btn ffw-btn-primary", "Turn on microphone");
      startBtn.type = "button";
      var live = elt("div", "ffw-voice-live");
      startBtn.addEventListener("click", function () {
        // Now, and only now, request the microphone.
        vp.innerHTML = "";
        live.appendChild(elt("span", "ffw-rec-dot"));
        var lbl = elt("span", null, "Listening. Speak now, then choose Stop. ");
        var interim = elt("span", "ffw-voice-interim");
        lbl.appendChild(interim);
        live.appendChild(lbl);
        el.voiceInterim = interim;
        var stopBtn = elt("button", "ffw-btn ffw-btn-ghost", "Stop");
        stopBtn.type = "button";
        stopBtn.addEventListener("click", function () {
          stopVoice();
          vp.innerHTML = "";
          vp.appendChild(elt("p", "ffw-voice-explain", "Voice typing stopped. You can edit your feedback above, turn the microphone back on, or send."));
          toggle.textContent = "🎤 Speak instead of typing";
          toggle.setAttribute("aria-expanded", "false");
        });
        vp.appendChild(live);
        vp.appendChild(stopBtn);
        toggle.textContent = "🎤 Microphone is on";
        startVoice(interim);
      });
      vp.appendChild(startBtn);
      wrap.appendChild(vp);
    });

    return wrap;
  }

  function buildPointOptIn() {
    var wrap = elt("div", "ffw-opt");
    var btn = elt("button", "ffw-btn ffw-btn-ghost ffw-btn-block", "📍 Point to a spot on the page (optional)");
    btn.type = "button";
    btn.addEventListener("click", function () {
      // Save the typed text, then let the person tap the page.
      if (el.composeText) { state.finalTranscript = el.composeText.value || ""; }
      stopVoice();
      startPointing();
    });
    wrap.appendChild(btn);
    if (state.pins.length) {
      wrap.appendChild(elt("span", "ffw-point-count", state.pins.length + (state.pins.length === 1 ? " spot pinned" : " spots pinned")));
    }
    return wrap;
  }

  // ---- Point-to-a-spot mode (opt-in) --------------------------------------
  function startPointing() {
    state.pointing = true;
    removeOverlay();
    document.documentElement.classList.add("ffw-arming");

    var bar = elt("div", "ffw-bar");
    bar.setAttribute("role", "region");
    bar.setAttribute("aria-label", "Point to a spot");
    var head = elt("div", "ffw-bar-head");
    head.appendChild(elt("span", "ffw-bar-title", "Tap the part of the page your feedback is about"));
    bar.appendChild(head);
    bar.appendChild(elt("div", "ffw-hint", "Each tap adds a numbered marker. Choose Done when you are finished."));
    var actions = elt("div", "ffw-bar-actions");
    var doneBtn = elt("button", "ffw-btn ffw-btn-primary", "Done");
    doneBtn.type = "button";
    doneBtn.addEventListener("click", stopPointing);
    actions.appendChild(doneBtn);
    bar.appendChild(actions);
    el.root.appendChild(bar);
    el.bar = bar;
  }

  function stopPointing() {
    state.pointing = false;
    document.documentElement.classList.remove("ffw-arming");
    removeBar();
    openCompose();
  }

  // Capture-phase click handler: while pointing, a tap pins the element
  // instead of activating it. Ignores taps on our own UI.
  function onCaptureClick(ev) {
    if (!state.pointing) { return; }
    var t = ev.target;
    if (isOwnUi(t)) { return; }
    ev.preventDefault();
    ev.stopPropagation();
    addPin(t);
  }

  function isOwnUi(node) {
    while (node && node.nodeType === 1) {
      if (node.classList && (
        node.classList.contains("ffw-bar") ||
        node.classList.contains("ffw-fab") ||
        node.classList.contains("ffw-pin") ||
        node.classList.contains("ffw-pin-layer") ||
        node.classList.contains("ffw-overlay"))) {
        return true;
      }
      node = node.parentElement;
    }
    return false;
  }

  function removeBar() {
    if (el.bar && el.bar.parentNode) { el.bar.parentNode.removeChild(el.bar); }
    el.bar = null;
  }

  function removeOverlay() {
    if (el.overlay && el.overlay.parentNode) { el.overlay.parentNode.removeChild(el.overlay); }
    el.overlay = null;
    el.composeText = null;
    el.voiceInterim = null;
  }

  // ---- Discard (confirm before losing non-empty feedback) ------------------
  function onDiscard() {
    var ta = el.composeText;
    var hasText = ta && trim(ta.value);
    if (hasText || state.pins.length) {
      if (!window.confirm("Discard this feedback? Your note will not be saved.")) { return; }
    }
    abortAll();
  }

  function abortAll() {
    stopVoice();
    state.pointing = false;
    document.documentElement.classList.remove("ffw-arming");
    removeBar();
    removeOverlay();
    clearPins();
    state.finalTranscript = "";
    if (el.fab) { el.fab.style.display = ""; }
  }

  // ---- Send ----------------------------------------------------------------
  function sendBundle(btn, statusNode) {
    var bundle = buildBundle(state.finalTranscript);
    if (btn) { btn.disabled = true; btn.textContent = "Sending..."; }

    function done(msg, cls) {
      if (statusNode) {
        statusNode.textContent = msg;
        statusNode.className = "ffw-status " + cls;
      }
      window.setTimeout(function () { abortAll(); }, 1200);
    }

    if (!WIDGET_ENDPOINT) {
      var ok = saveLocal(bundle);
      done(ok
        ? "Saved locally (no endpoint configured). Feedback stored in this browser."
        : "Could not save. Please copy your notes manually.", ok ? "ffw-status-ok" : "ffw-status-err");
      return;
    }

    if (!window.fetch) {
      saveLocal(bundle);
      done("Sent via local fallback (fetch unavailable).", "ffw-status-warn");
      return;
    }

    window.fetch(WIDGET_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bundle),
      keepalive: true
    }).then(function (res) {
      if (res && res.ok) {
        done("Feedback sent. Thank you.", "ffw-status-ok");
      } else {
        saveLocal(bundle);
        done("Server error. Saved locally so nothing is lost.", "ffw-status-warn");
      }
    }).catch(function () {
      saveLocal(bundle);
      done("Network error. Saved locally so nothing is lost.", "ffw-status-warn");
    });
  }

  // ---- Boot ----------------------------------------------------------------
  function buildFab() {
    var fab = elt("button", "ffw-fab");
    fab.type = "button";
    fab.setAttribute("aria-label", "Give feedback");
    fab.appendChild(elt("span", "ffw-fab-dot"));
    fab.appendChild(document.createTextNode("Feedback"));
    fab.addEventListener("click", openCompose);
    el.root.appendChild(fab);
    el.fab = fab;
  }

  function boot() {
    injectStyles();
    var root = elt("div", "ffw-root");
    root.style.position = "static";
    document.body.appendChild(root);
    el.root = root;
    buildFab();
    // Capture-phase so pins win over normal click handlers while pointing.
    document.addEventListener("click", onCaptureClick, true);
    // Public hook for tests / debugging.
    window.FieldFeedback = {
      open: openCompose,
      abort: abortAll,
      getBundle: function () { return buildBundle(state.finalTranscript); },
      getStored: function () {
        try { return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]"); }
        catch (e) { return []; }
      },
      setEndpoint: function (u) { WIDGET_ENDPOINT = u || ""; }
    };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
