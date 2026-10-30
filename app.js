/*
  Foot Rehab: app engine
  ======================
  The exercises live in exercises.js. This file runs them, times them, and keeps history.
  Everything is stored on the phone (localStorage):
    footrehab.settings.v1   settings
    footrehab.history.v1    one record per session
  Add ?speed=20 to the address to run the timers 20x faster when testing.
*/
(function () {
  "use strict";

  var VERSION = "2026-10-30.2";
  var P = window.PROGRAM;
  var app = document.getElementById("app");
  var sheet = document.getElementById("sheet");
  var toastEl = document.getElementById("toast");
  var importInput = document.getElementById("importFile");
  var REST = [0, 0, 0, 0, 0];
  var CIRC = 2 * Math.PI * 96;
  var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var FEEL = { better: "Felt better", same: "Felt the same", worse: "Felt worse" };
  var SPEED = (function () {
    try { var v = parseFloat(new URLSearchParams(location.search).get("speed")); return v > 0 ? v : 1; } catch (e) { return 1; }
  })();

  if (!P || !P.exercises || !P.stages || !P.stages.length) {
    app.innerHTML = '<p class="hint" style="padding-top:24px">The exercise file did not load. Check exercises.js for a typo.</p>';
    return;
  }

  /* ---------- program checks (a typo in exercises.js should not break the app) ---------- */
  Object.keys(P.exercises).forEach(function (id) { P.exercises[id].id = id; });
  P.extras = (P.extras || []).filter(function (x) { return P.exercises[x.id]; });
  P.stages.forEach(function (st) {
    st.exercises = (st.exercises || []).filter(function (id) {
      if (!P.exercises[id]) { console.warn("Unknown exercise id in stage " + st.id + ": " + id); return false; }
      return true;
    });
  });

  /* ---------- small helpers ---------- */
  function $(s) { return document.querySelector(s); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function plural(n, w) { return n + " " + w + (n === 1 ? "" : "s"); }
  function fmtMin(sec) { var m = Math.round(sec / 60); return m < 1 ? "under a minute" : m + " min"; }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function dkey(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function parseKey(k) { var p = k.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function addDays(d, n) { var x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() + n); return x; }
  function mondayOf(d) { return addDays(d, -((d.getDay() + 6) % 7)); }
  function daysBetween(a, b) { return Math.round((parseKey(b) - parseKey(a)) / 86400000); }
  function fmtDay(d) { try { return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }); } catch (e) { return d.toDateString(); } }
  function fmtTime(d) { try { return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }); } catch (e) { return pad(d.getHours()) + ":" + pad(d.getMinutes()); } }
  function telHref(p) { return "tel:" + String(p).replace(/[^0-9+]/g, ""); }

  /* ---------- storage ---------- */
  var KEY_S = "footrehab.settings.v1", KEY_H = "footrehab.history.v1", storageOK = true;
  function load(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }

  var S = Object.assign({
    stage: P.stages[0].id, first: "right", order: "exercise", quick: false,
    sound: true, voice: false, silentOk: true, rest: P.restBetweenSets || 20, reps: {}, holds: {}, extras: {}
  }, load(KEY_S, {}));
  ["reps", "holds", "extras"].forEach(function (k) { if (!S[k] || typeof S[k] !== "object") S[k] = {}; });
  if (!stageById(S.stage)) S.stage = P.stages[0].id;
  P.extras.forEach(function (x) { if (typeof S.extras[x.id] !== "boolean") S.extras[x.id] = !!x.default; });
  function saveS() { save(KEY_S, S); }

  function clean(s) {
    if (!s || typeof s.id !== "string" || typeof s.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s.date)) return null;
    var obj = function (o) { return o && typeof o === "object" && !Array.isArray(o) ? o : {}; };
    return {
      id: s.id, date: s.date, start: String(s.start || s.id), end: s.end ? String(s.end) : null,
      stage: String(s.stage || ""), stageLabel: String(s.stageLabel || ""),
      exercises: Array.isArray(s.exercises) ? s.exercises.map(String) : [],
      names: obj(s.names), need: obj(s.need), done: obj(s.done),
      setsPlanned: +s.setsPlanned || 0, setsDone: +s.setsDone || 0, complete: !!s.complete,
      feel: FEEL[s.feel] ? s.feel : null, app: String(s.app || "")
    };
  }
  var H = load(KEY_H, []);
  H = Array.isArray(H) ? H.map(clean).filter(Boolean) : [];
  function saveH() {
    var ok = save(KEY_H, H);
    if (!ok && storageOK) toast("History could not be saved on this device.");
    storageOK = ok;
    return ok;
  }

  /* ---------- program helpers ---------- */
  function stageById(id) { for (var i = 0; i < P.stages.length; i++) if (P.stages[i].id === id) return P.stages[i]; return null; }
  function stage() { return stageById(S.stage) || P.stages[0]; }
  function sessionExercises() {
    var ids = stage().exercises.slice();
    P.extras.forEach(function (x) { if (S.extras[x.id] && ids.indexOf(x.id) < 0) ids.push(x.id); });
    return ids.map(function (id) { return P.exercises[id]; });
  }
  function perFoot(ex) { return ex.perFoot !== false; }
  function setsOf(ex) { return ex.sets || 1; }
  function setWord(ex) { return ex.setWord || "Set"; }
  function repsOf(ex) {
    var r = ex.reps || 1;
    if (ex.repsRange && typeof S.reps[ex.id] === "number") r = clamp(S.reps[ex.id], ex.repsRange[0], ex.repsRange[1]);
    return r;
  }
  function holdOf(ex) {
    var h = ex.hold || 0;
    if (ex.holdRange && typeof S.holds[ex.id] === "number") h = clamp(S.holds[ex.id], ex.holdRange[0], ex.holdRange[1]);
    return h;
  }
  function restOf(ex) { return typeof ex.rest === "number" ? ex.rest : S.rest; }
  function setupText(ex) { var k = ex.setup || stage().setup; return (P.setups && P.setups[k]) || ""; }
  function feet() { return S.first === "left" ? ["left", "right"] : ["right", "left"]; }
  function footLabel(f) { return f === "both" ? "Both feet" : cap(f) + " foot"; }

  /* ---------- timed cues ---------- */
  function phase(p, ex, tag, rep, reps) {
    return {
      kind: p.kind || "effort", label: p.label || "", text: p.text || "",
      secs: p.secs === "hold" ? holdOf(ex) : (+p.secs || 0),
      toes: p.toes || null, arrow: p.arrow || null, ball: !!p.ball,
      say: p.say || p.label || "", tag: tag || "", rep: rep || 0, reps: reps || 0
    };
  }
  function buildCues(ex) {
    var reps = repsOf(ex), parts = ex.parts || [{ name: "", rep: ex.rep || [] }];
    var out = [{ kind: "prep", label: "Get ready", text: ex.cue || "", secs: 4, tag: ex.cue ? "Key cue" : "", say: "Get ready", toes: null, arrow: null, ball: false, rep: 0, reps: 0 }];
    parts.forEach(function (part) {
      if (part.intro) out.push(phase(part.intro, ex, part.name));
      for (var r = 1; r <= reps; r++) {
        (part.rep || []).forEach(function (p) {
          var c = phase(p, ex, part.name, r, reps);
          if (r === 1 && p.sayFirst) c.say = p.sayFirst;
          out.push(c);
        });
      }
    });
    return out;
  }
  function exSecs(ex) {
    var per = buildCues(ex).reduce(function (a, c) { return a + c.secs; }, 0), sets = setsOf(ex);
    return (per * sets + restOf(ex) * (sets - 1)) * (perFoot(ex) ? 2 : 1);
  }

  /* ---------- session plan ---------- */
  function buildPlan() {
    var exs = sessionExercises(), F = feet(), items = [];
    function addSets(ex, foot, xi, withReady) {
      for (var s = 1; s <= setsOf(ex); s++) {
        if (s === 1) { if (withReady) items.push({ t: "ready", ex: ex, foot: foot, set: 1, xi: xi }); }
        else items.push({ t: "rest", ex: ex, foot: foot, set: s, xi: xi });
        items.push({ t: "run", ex: ex, foot: foot, set: s, xi: xi });
      }
    }
    if (S.order === "foot") {
      F.forEach(function (foot, fi) {
        exs.filter(perFoot).forEach(function (ex) {
          var xi = exs.indexOf(ex);
          if (fi === 0) items.push({ t: "learn", ex: ex, xi: xi });
          addSets(ex, foot, xi, fi > 0);
        });
      });
      exs.filter(function (e) { return !perFoot(e); }).forEach(function (ex) {
        var xi = exs.indexOf(ex);
        items.push({ t: "learn", ex: ex, xi: xi });
        addSets(ex, "both", xi, false);
      });
    } else {
      exs.forEach(function (ex, xi) {
        items.push({ t: "learn", ex: ex, xi: xi });
        if (!perFoot(ex)) { addSets(ex, "both", xi, false); return; }
        F.forEach(function (foot, fi) { addSets(ex, foot, xi, fi > 0); });
      });
    }
    return items;
  }

  /* ---------- history records ---------- */
  var cur = null;
  function newSession() {
    var exs = sessionExercises(), now = new Date(), need = {}, names = {}, planned = 0, st = stage();
    exs.forEach(function (ex) {
      var n = setsOf(ex);
      need[ex.id] = perFoot(ex) ? { right: n, left: n } : { both: n };
      names[ex.id] = ex.name;
      planned += n * (perFoot(ex) ? 2 : 1);
    });
    return {
      id: now.toISOString(), date: dkey(now), start: now.toISOString(), end: null,
      stage: st.id, stageLabel: st.label + " · " + st.name,
      exercises: exs.map(function (e) { return e.id; }), names: names, need: need, done: {},
      setsPlanned: planned, setsDone: 0, complete: false, feel: null, app: VERSION
    };
  }
  function upsert(s) {
    for (var i = 0; i < H.length; i++) if (H[i].id === s.id) { H[i] = s; saveH(); return; }
    H.push(s); saveH();
  }
  function findSession(id) { for (var i = 0; i < H.length; i++) if (H[i].id === id) return H[i]; return null; }
  function recordSet(it) {
    if (!cur) return;
    var d = cur.done[it.ex.id] || (cur.done[it.ex.id] = {});
    d[it.foot] = (d[it.foot] || 0) + 1;
    cur.setsDone += 1;
    cur.end = new Date().toISOString();
    upsert(cur);
  }
  function exercisesDone(s) {
    var n = 0;
    (s.exercises || []).forEach(function (id) {
      var need = s.need[id] || {}, done = s.done[id] || {}, keys = Object.keys(need);
      if (keys.length && keys.every(function (k) { return (+done[k] || 0) >= (+need[k] || 0); })) n++;
    });
    return n;
  }
  function minutesOf(s) {
    var m = Math.round((new Date(s.end) - new Date(s.start)) / 60000);
    return isFinite(m) ? Math.max(1, m) : 0;
  }
  function dayStatus() {
    var m = {};
    H.forEach(function (s) {
      if (!(s.setsDone > 0)) return;
      if (s.complete) m[s.date] = "done"; else if (!m[s.date]) m[s.date] = "part";
    });
    return m;
  }
  function firstDay() {
    var f = null;
    H.forEach(function (s) { if (s.setsDone > 0 && (!f || s.date < f)) f = s.date; });
    return f;
  }

  /* ---------- sound, voice, screen ---------- */
  // iOS treats web-page sound as "ambient" by default, and ambient sound is muted when the phone
  // is on silent. Asking for "playback" (iOS 17+) makes the cues play like a media app instead.
  var actx = null, wakeLock = null, idleTimer = null;
  function setAudioMode() {
    try { if (navigator.audioSession) navigator.audioSession.type = S.silentOk ? "playback" : "auto"; } catch (e) {}
  }
  function initAudio() { // call from a tap: iOS only starts sound in response to one
    setAudioMode();
    try {
      if (!actx) {
        var C = window.AudioContext || window.webkitAudioContext;
        if (C) {
          actx = new C();
          var buf = actx.createBuffer(1, 1, 22050), src = actx.createBufferSource(); // silent blip unlocks output on iOS
          src.buffer = buf; src.connect(actx.destination); src.start(0);
        }
      }
      if (actx && actx.state !== "running") actx.resume();
    } catch (e) {}
    clearTimeout(idleTimer);
  }
  // Let go of the speaker when no session is running, so music from other apps can play again.
  function idleAudio(delay) {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(function () {
      if (view !== "item" && actx && actx.state === "running") { try { actx.suspend(); } catch (e) {} }
    }, delay || 2500);
  }
  function beep(f, d, v) {
    if (!S.sound || !actx) return;
    try {
      if (actx.state !== "running") actx.resume();
      var o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime + 0.01;
      o.type = "sine"; o.frequency.value = f;
      g.gain.setValueAtTime(v || 0.45, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t + d + 0.02);
    } catch (e) {}
  }
  function chime() { beep(660, 0.22); setTimeout(function () { beep(880, 0.32); }, 220); }
  function speak(t) {
    if (!S.voice || !t) return;
    try { var ss = window.speechSynthesis; if (!ss) return; ss.cancel(); ss.speak(new SpeechSynthesisUtterance(t)); } catch (e) {}
  }
  function hush() { try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) {} }
  function lockScreen() {
    try {
      if (navigator.wakeLock && !wakeLock) navigator.wakeLock.request("screen").then(function (l) {
        wakeLock = l; l.addEventListener("release", function () { wakeLock = null; });
      }).catch(function () {});
    } catch (e) {}
  }
  function unlockScreen() { try { if (wakeLock) wakeLock.release(); } catch (e) {} wakeLock = null; }
  function requestPersist() {
    try {
      if (navigator.storage && navigator.storage.persist) navigator.storage.persisted().then(function (p) { if (!p) return navigator.storage.persist(); }).catch(function () {});
    } catch (e) {}
  }
  var toastTimer = null;
  function toast(msg) {
    toastEl.textContent = msg; toastEl.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { toastEl.hidden = true; }, 2600);
  }

  /* ---------- engine ---------- */
  var plan = [], idx = 0, cues = [], ci = 0, cueStart = 0, cueDur = 0, paused = false, pausedRem = 0, timer = null, auto = null;
  var view = "home", settingsOpen = false, pendingDel = null, lastId = null, resumeAfterSheet = false;
  function now() { return performance.now(); }
  function stopTimer() { if (timer) { clearInterval(timer); timer = null; } }
  function clearAuto() {
    if (!auto) return;
    clearInterval(auto.t); auto = null;
    var b = $("#goBtn"); if (b && b.dataset.label) b.textContent = b.dataset.label;
  }

  function paintCue(c) {
    var st = $("#stage"); if (!st) return;
    st.className = "stage k-" + c.kind;
    $("#label").textContent = c.label;
    $("#sub").textContent = c.text;
    $("#tag").textContent = c.tag;
    var d = "";
    if (c.reps > 1) for (var i = 1; i <= c.reps; i++) d += '<i class="d' + (i < c.rep ? " done" : i === c.rep ? " cur" : "") + '"></i>';
    $("#dots").innerHTML = d;
    var it = plan[idx], f = $("#foot");
    if (f && it) f.innerHTML = footSVG({ foot: it.foot, toes: c.toes, arrow: c.arrow, ball: c.ball });
  }
  function paintTime(rem) {
    var n = $("#num"), r = $("#ringfg"); if (!n || !r) return;
    n.textContent = Math.max(1, Math.ceil(rem / 1000));
    var frac = cueDur > 0 ? Math.max(0, Math.min(1, rem / cueDur)) : 0;
    r.style.strokeDashoffset = String(CIRC * (1 - frac));
  }
  function announce(c) { beep(c.kind === "effort" ? 740 : c.kind === "relax" ? 520 : 440, 0.2); speak(c.say); }
  function startCue(i) {
    ci = i; var c = cues[ci]; cueDur = c.secs * 1000; cueStart = now();
    paintCue(c); paintTime(cueDur); announce(c);
  }
  function tick() {
    if (paused || !cues.length) return;
    var t = now(), el = (t - cueStart) * SPEED, skipped = 0;
    while (el >= cueDur) {
      if (ci + 1 >= cues.length) { finishCues(); return; }
      el -= cueDur; ci += 1; cueDur = cues[ci].secs * 1000; cueStart = t - el / SPEED;
      paintCue(cues[ci]);
      if (++skipped < 3) announce(cues[ci]);
    }
    paintTime(cueDur - el);
  }
  function beginTimed(list) { stopTimer(); cues = list; paused = false; startCue(0); timer = setInterval(tick, 100); }
  function setPauseLabel() { var b = $("#pauseBtn"); if (b) b.textContent = paused ? "Resume" : "Pause"; }
  function pause() { if (!timer || paused) return; paused = true; pausedRem = cueDur - (now() - cueStart) * SPEED; hush(); setPauseLabel(); }
  function resume() { if (!timer || !paused) return; paused = false; cueStart = now() - (cueDur - pausedRem) / SPEED; setPauseLabel(); }
  function finishCues() {
    stopTimer();
    var it = plan[idx];
    if (it && it.t === "run") { recordSet(it); chime(); }
    goNext();
  }
  function goNext() {
    stopTimer(); clearAuto();
    idx += 1;
    if (idx >= plan.length) { endSession(true); return; }
    renderItem();
  }
  function startAuto(secs) {
    clearAuto();
    var b = $("#goBtn"); if (!b) return;
    var base = b.textContent, end = now() + secs * 1000 / SPEED;
    b.dataset.label = base;
    function upd() {
      var btn = $("#goBtn"); if (!btn) { clearAuto(); return; }
      var rem = Math.ceil((end - now()) * SPEED / 1000);
      if (rem <= 0) { clearAuto(); goNext(); return; }
      btn.textContent = base + " · " + rem;
    }
    auto = { t: setInterval(upd, 200) };
    upd();
  }

  function startSession() {
    plan = buildPlan(); idx = 0;
    if (!plan.length) { toast("This stage has no exercises yet."); return; }
    initAudio(); requestPersist(); lockScreen();
    if (S.voice) speak("Starting.");
    cur = newSession();
    renderItem();
  }
  function endSession(all) {
    stopTimer(); clearAuto(); unlockScreen(); hush(); sheet.hidden = true;
    var s = cur; cur = null; plan = []; idx = 0;
    if (s && s.setsDone > 0) {
      s.end = new Date().toISOString();
      s.complete = !!all && s.setsDone >= s.setsPlanned;
      upsert(s); lastId = s.id;
      if (all) chime();
      renderDone(s); window.scrollTo(0, 0);
    } else {
      renderHome(); window.scrollTo(0, 0);
    }
    idleAudio(3000);
  }

  /* ---------- foot drawing ---------- */
  var TOE = [[62, 58, 21], [98, 43, 14], [126, 48, 13], [148, 60, 12], [166, 80, 10.5]];
  var FOOT_PATH = "M48 108 C42 140 70 200 72 235 C72 265 88 286 105 286 C125 286 138 266 136 236 C136 200 168 150 176 112 C178 96 170 92 160 92 L72 90 C56 90 48 96 48 108 Z";
  function footSVG(o) {
    o = o || {};
    var foot = o.foot || "right";
    if (foot === "both") return footSVG(Object.assign({}, o, { foot: "left", pair: true })) + footSVG(Object.assign({}, o, { foot: "right", pair: true }));
    var toes = o.toes || REST, arrow = o.arrow || null;
    var dx = arrow === "spread" ? [-10, -4, 2, 8, 13] : [0, 0, 0, 0, 0];
    var s = '<svg viewBox="0 0 200 300" class="foot' + (o.big ? " big" : "") + (o.pair ? " pair" : "") + '" role="img" aria-label="' + foot + ' foot seen from above">';
    s += "<g" + (foot === "left" ? ' transform="translate(200 0) scale(-1 1)"' : "") + ">";
    s += '<path class="fbody" d="' + FOOT_PATH + '"/>';
    s += '<polygon class="tri" points="66,108 164,104 104,262"/>';
    s += '<circle class="tp" cx="66" cy="108" r="7"/><circle class="tp" cx="164" cy="104" r="7"/><circle class="tp" cx="104" cy="262" r="7"/>';
    if (o.ball) s += '<circle class="ball" cx="112" cy="180" r="28"/>';
    if (arrow === "short") s += '<line class="arr" x1="110" y1="128" x2="104" y2="196"/><polygon class="arr" points="104,214 93,194 115,197"/>';
    if (arrow === "spread") s += '<line class="arr" x1="42" y1="52" x2="22" y2="52"/><polygon class="arr" points="14,52 28,44 28,60"/><line class="arr" x1="178" y1="68" x2="192" y2="68"/><polygon class="arr" points="200,68 186,60 186,76"/>';
    for (var i = 0; i < 5; i++) {
      var t = TOE[i], st = toes[i] || 0, x = t[0] + dx[i], y = t[1] + (st === 1 ? -16 : 0);
      if (st === 1) s += '<circle class="ghost" cx="' + t[0] + '" cy="' + t[1] + '" r="' + t[2] + '"/>';
      if (st === 2) s += '<circle class="ghost" cx="' + x + '" cy="' + y + '" r="' + (t[2] + 7) + '"/>';
      s += '<circle class="toe' + (st === 1 ? " up" : st === 2 ? " press" : "") + '" cx="' + x + '" cy="' + y + '" r="' + t[2] + '"/>';
    }
    s += "</g>";
    if (o.labels && !o.pair) {
      var mx = function (x) { return foot === "left" ? 200 - x : x; };
      s += '<text class="flab" x="' + mx(66) + '" y="134">Big toe base</text><text class="flab" x="' + mx(158) + '" y="130">Little toe base</text><text class="flab" x="' + mx(104) + '" y="248">Heel</text>';
    }
    return s + "</svg>";
  }
  function pictureOf(ex, foot, big) {
    var p = ex.picture || {};
    return footSVG({ foot: foot, toes: p.toes, arrow: p.arrow, ball: p.ball, labels: big, big: big });
  }

  /* ---------- shared pieces ---------- */
  function list(items, cls, tag) {
    return "<" + tag + ' class="' + cls + '">' + items.map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("") + "</" + tag + ">";
  }
  function topBar() {
    var pct = Math.round(100 * idx / Math.max(1, plan.length));
    return '<div class="top"><button class="btn ghost" data-act="stop">End session</button><span class="count">Step ' + (idx + 1) + " of " + plan.length +
      '</span></div><div class="prog" aria-hidden="true"><i style="width:' + pct + '%"></i></div>';
  }
  function doseChips(ex) {
    var c = [];
    if (ex.dose) c = ex.dose.slice();
    else {
      var sets = setsOf(ex), reps = repsOf(ex);
      if (sets > 1) c.push(plural(sets, setWord(ex).toLowerCase()));
      if (reps > 1) c.push(reps + " reps" + (ex.parts && ex.parts.length > 1 ? " each position" : ""));
      if (ex.hold) c.push(holdOf(ex) + " s " + (ex.holdLabel || "hold"));
    }
    c.push(perFoot(ex) ? "each foot" : "both feet together");
    return '<ul class="chips">' + c.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>";
  }
  function stepperRow(title, hint, key, val, step) {
    return '<div class="stepper-row"><div><b>' + esc(title) + "</b>" + (hint ? "<small>" + esc(hint) + "</small>" : "") +
      '</div><div class="stepper"><button data-act="adj" data-k="' + key + '" data-d="' + (-step) + '" aria-label="Less">&minus;</button><output>' + val +
      '</output><button data-act="adj" data-k="' + key + '" data-d="' + step + '" aria-label="More">+</button></div></div>';
  }
  function steppers(ex) {
    var h = "";
    if (ex.repsRange) h += stepperRow("Reps per " + setWord(ex).toLowerCase(), "Handout: " + ex.repsRange[0] + " to " + ex.repsRange[1] + ".", "reps:" + ex.id, repsOf(ex), 1);
    if (ex.holdRange) {
      var per = setsOf(ex) > 1 ? " per " + setWord(ex).toLowerCase() : perFoot(ex) ? " per foot" : "";
      h += stepperRow("Seconds" + per, ex.holdHint || "", "hold:" + ex.id, holdOf(ex), ex.holdStep || 5);
    }
    return h;
  }
  function weekInfo(ds) {
    var mon = mondayOf(new Date()), today = dkey(new Date()), n = 0, h = "";
    for (var i = 0; i < 7; i++) {
      var k = dkey(addDays(mon, i)), st = ds[k] || "", cls = "dot";
      if (st === "done") { cls += " done"; n++; } else if (st === "part") cls += " part";
      if (k === today) cls += " today"; else if (k > today) cls += " future";
      h += '<span class="wd"><i class="' + cls + '"></i>' + "MTWTFSS".charAt(i) + "</span>";
    }
    return { count: n, html: '<div class="week" role="img" aria-label="' + n + ' days done this week">' + h + "</div>" };
  }
  function seg(key, opts, val, col) {
    return '<div class="seg' + (col ? " col" : "") + '" role="radiogroup">' + opts.map(function (o) {
      return '<button role="radio" aria-checked="' + (String(val) === String(o[0])) + '" data-act="set" data-k="' + key + '" data-v="' + esc(o[0]) + '"><b>' +
        esc(o[1]) + "</b>" + (o[2] ? "<small>" + esc(o[2]) + "</small>" : "") + "</button>";
    }).join("") + "</div>";
  }
  function toggle(act, key, on, title, hint) {
    return '<button class="opt" data-act="' + act + '" data-k="' + esc(key) + '" aria-pressed="' + !!on + '"><span><b>' + esc(title) + "</b>" +
      (hint ? "<small>" + esc(hint) + "</small>" : "") + '</span><i class="sw" aria-hidden="true"></i></button>';
  }

  /* ---------- screens ---------- */
  function renderHome() {
    view = "home"; stopTimer(); clearAuto(); unlockScreen(); sheet.hidden = true; pendingDel = null;
    var st = stage(), exs = sessionExercises(), total = exs.reduce(function (a, e) { return a + exSecs(e); }, 0);
    var ds = dayStatus(), today = dkey(new Date()), tState = ds[today], wk = weekInfo(ds), fd = firstDay();
    var dayNo = fd ? daysBetween(fd, today) + 1 : 0, weekNo = fd ? Math.floor((dayNo - 1) / 7) + 1 : 0;
    var si = P.stages.indexOf(st), next = P.stages[si + 1];

    var h = '<header><p class="eyebrow">' + (fd ? "Week " + weekNo + " · Day " + dayNo : esc(P.subtitle || "")) + "</p>";
    h += "<h1>" + (tState === "done" ? "Today's session is done" : tState === "part" ? "Part of today's session done" : "Today's session") + "</h1>";
    h += '<p class="lede">' + esc(st.label + " · " + st.name) + " · " + plural(exs.length, "exercise") + " · about " + fmtMin(total) + "</p></header>";
    h += '<div class="stack">';
    h += '<section class="sec"><div class="row"><h3>This week</h3><span class="count">' + wk.count + " of " + P.weeklyTarget + " days</span></div>" + wk.html + "</section>";
    if (fd && next && st.weeks && weekNo > st.weeks[1]) {
      h += '<div class="callout"><h3>Week ' + weekNo + ": check your progress</h3><p class=\"hint\" style=\"margin-top:4px\">" + esc(st.advance || "") +
        " When you're there, switch to " + esc(next.label + " · " + next.name) + " in Settings.</p></div>";
    }
    h += '<section class="sec"><h3>Today\'s exercises</h3><ul class="plan">' + exs.map(function (e) {
      return "<li><span>" + esc(e.name) + "</span><span>" + fmtMin(exSecs(e)) + "</span></li>";
    }).join("") + "</ul></section>";
    h += settingsHTML();
    h += '<div class="callout"><h3>Stop and call ' + (P.office ? "the office" : "your clinician") + ' if you get</h3><p class="hint" style="margin-top:4px">Sharp or increasing pain, new swelling, numbness or tingling, skin irritation, or symptoms that stay worse after exercising.' +
      (P.office ? " " + esc(P.office.name) + ': <a href="' + telHref(P.office.phone) + '">' + esc(P.office.phone) + "</a>" : "") + "</p></div>";
    h += "</div>";
    h += '<div class="fill"></div><div class="bar"><button class="btn sec" data-act="history">History</button><button class="btn pri grow" data-act="start">' +
      (tState === "done" ? "Start another session" : "Start session") + "</button></div>";
    app.innerHTML = h;
  }

  function settingsHTML() {
    var st = stage();
    var summary = cap(S.first) + " foot first · " + (S.order === "foot" ? "one foot at a time" : "exercise by exercise") + " · " + (S.quick ? "quick start" : "full instructions");
    var h = '<details class="settings" id="settings"' + (settingsOpen ? " open" : "") + "><summary><b>Settings</b><span>" + esc(summary) + '</span></summary><div class="inner">';
    h += '<div class="sec"><h3>Stage</h3>' + seg("stage", P.stages.map(function (s) { return [s.id, s.label, s.short || s.name]; }), S.stage) +
      '<p class="hint">' + esc(st.advance || "") + "</p></div>";
    h += '<div class="sec"><h3>Start with which foot?</h3>' + seg("first", [["right", "Right foot"], ["left", "Left foot"]], S.first) + "</div>";
    h += '<div class="sec"><h3>Order</h3>' + seg("order", [["exercise", "Exercise by exercise", "Both feet on one move, then the next move"], ["foot", "One foot at a time", "Every move on one foot, then the other foot"]], S.order, true) + "</div>";
    h += '<div class="sec"><h3>Before each exercise</h3>' + seg("quick", [["0", "Full instructions", "Read the steps, then tap Start"], ["1", "Quick start", "Short preview, then it starts on its own"]], S.quick ? "1" : "0", true) + "</div>";
    h += '<div class="sec"><h3>Cues</h3><div class="opts">' + toggle("sw", "sound", S.sound, "Beeps", "A tone at each change") +
      toggle("sw", "voice", S.voice, "Spoken cues", "Lets you keep your eyes on your foot") +
      toggle("sw", "silentOk", S.silentOk, "Play on silent", "Cues play even when your iPhone is on silent. Can pause music from other apps.") +
      '</div><button class="btn sec" data-act="test" style="width:100%;margin-top:10px">Test sound</button>' +
      '<p class="hint">Still nothing? Turn the volume up with the side buttons, and check that headphones or a car aren\'t connected.</p></div>';
    h += '<div class="sec"><h3>Rest between sets</h3>' + stepperRow("Seconds", "", "rest", S.rest, 5) + "</div>";
    if (P.extras.length) {
      h += '<div class="sec"><h3>Extras</h3><div class="opts">' + P.extras.map(function (x) { return toggle("extra", x.id, S.extras[x.id], x.label, x.hint); }).join("") + "</div></div>";
    }
    return h + "</div></details>";
  }

  function renderLearn(it, full) {
    var ex = it.ex, exs = sessionExercises(), foot = perFoot(ex) ? feet()[0] : "both";
    var startLabel = perFoot(ex) ? "Start " + foot + " foot" : "Start";
    var h = topBar();
    h += '<p class="eyebrow">Exercise ' + (it.xi + 1) + " of " + exs.length + "</p><h1>" + esc(ex.name) + "</h1>";
    if (ex.goal) h += '<p class="lede">' + esc(ex.goal) + "</p>";
    h += doseChips(ex);
    if (full) {
      h += steppers(ex);
      h += '<div class="footwrap">' + pictureOf(ex, foot, true) + '</div><p class="hint" style="text-align:center">Seen from above. Dots mark the tripod.</p>';
      h += '<div class="stack">';
      if (setupText(ex)) h += '<div class="sec"><h3>Set up</h3><p>' + esc(setupText(ex)) + "</p></div>";
      if (ex.steps && ex.steps.length) h += '<div class="sec"><h3>How to do it</h3>' + list(ex.steps, "steps", "ol") + "</div>";
      if (ex.cue) h += '<div class="callout cue"><div class="lab">Key cue</div><p>' + esc(ex.cue) + "</p></div>";
      if (ex.check) h += '<div class="sec"><h3>Check yourself</h3><p>' + esc(ex.check) + "</p></div>";
      if (ex.mistakes && ex.mistakes.length) h += '<div class="sec"><h3>Common mistakes</h3>' + list(ex.mistakes, "bad", "ul") + "</div>";
      if (ex.note) h += '<p class="note">' + esc(ex.note) + "</p>";
      h += "</div>";
      h += '<div class="fill"></div><div class="bar"><button class="btn pri" id="goBtn" data-act="go">' + startLabel + "</button></div>";
    } else {
      h += '<div class="footwrap">' + pictureOf(ex, foot, false) + "</div>";
      if (ex.cue) h += '<div class="callout cue" style="margin-top:16px"><div class="lab">Key cue</div><p>' + esc(ex.cue) + "</p></div>";
      h += '<div class="fill"></div><div class="bar"><button class="btn sec" data-act="more">Instructions</button><button class="btn pri grow" id="goBtn" data-act="go">' + startLabel + "</button></div>";
    }
    app.innerHTML = h;
    if (!full) startAuto(8);
  }

  function prevRunFoot() { for (var i = idx - 1; i >= 0; i--) if (plan[i].t === "run") return plan[i].foot; return null; }
  function renderReady(it) {
    var ex = it.ex, exs = sessionExercises(), pf = prevRunFoot(), switched = pf && pf !== it.foot;
    var h = topBar();
    h += '<p class="eyebrow">Exercise ' + (it.xi + 1) + " of " + exs.length + ": " + esc(ex.name) + "</p>";
    h += '<span class="pill">' + footLabel(it.foot) + "</span>";
    h += '<h1 style="margin-top:12px">' + (switched ? "Switch to your " + it.foot + " foot" : "Ready for your " + it.foot + " foot") + "</h1>";
    h += '<div class="footwrap">' + pictureOf(ex, it.foot, true) + "</div>";
    h += '<div class="stack" style="margin-top:12px">';
    if (setupText(ex)) h += "<p>" + esc(setupText(ex)) + "</p>";
    if (ex.cue) h += '<div class="callout cue"><div class="lab">Key cue</div><p>' + esc(ex.cue) + "</p></div>";
    h += '<details class="more"><summary>Show the steps again</summary>' + list(ex.steps || [], "steps", "ol") + (ex.check ? '<p class="hint">' + esc(ex.check) + "</p>" : "") + "</details></div>";
    h += '<div class="fill"></div><div class="bar"><button class="btn pri" id="goBtn" data-act="go">Start ' + setWord(ex).toLowerCase() + " 1 of " + setsOf(ex) + "</button></div>";
    app.innerHTML = h;
    if (S.quick) startAuto(6);
  }

  function runFrame(pill, where, controls) {
    return topBar() + '<div class="meta">' + pill + '<span class="where">' + where + "</span></div>" +
      '<div id="stage" class="stage k-prep"><div class="ring"><svg viewBox="0 0 220 220" aria-hidden="true"><circle class="trk" cx="110" cy="110" r="96"/>' +
      '<circle id="ringfg" class="fg" cx="110" cy="110" r="96" style="stroke-dasharray:' + CIRC + ';stroke-dashoffset:0"/></svg><div class="num" id="num" aria-hidden="true"></div></div>' +
      '<h2 id="label" aria-live="polite"></h2><p class="tag" id="tag"></p><p class="sub" id="sub"></p><div class="dots" id="dots"></div></div>' +
      '<div class="footwrap" id="foot"></div><div class="fill"></div><div class="bar">' + controls + "</div>";
  }
  function renderRun(it) {
    var ex = it.ex;
    var where = esc(ex.name) + (setsOf(ex) > 1 ? " · " + setWord(ex) + " " + it.set + " of " + setsOf(ex) : "");
    app.innerHTML = runFrame('<span class="pill">' + footLabel(it.foot) + "</span>", where,
      '<button class="btn pri grow" id="pauseBtn" data-act="pause">Pause</button><button class="btn sec" data-act="skip">Skip</button><button class="btn sec" data-act="redo">Redo</button>');
    beginTimed(buildCues(ex));
  }
  function renderRest(it) {
    var ex = it.ex, w = setWord(ex).toLowerCase();
    app.innerHTML = runFrame('<span class="pill rest">Rest</span>', "Next: " + footLabel(it.foot).toLowerCase() + " · " + w + " " + it.set + " of " + setsOf(ex),
      '<button class="btn pri grow" data-act="skip">Skip rest</button><button class="btn sec" id="pauseBtn" data-act="pause">Pause</button>');
    beginTimed([{ kind: "relax", label: "Rest", text: "Shake the foot out, wiggle your toes, and breathe. The next " + w + " starts on its own.", secs: restOf(ex), tag: "", say: "Rest", toes: null, arrow: null, ball: false, rep: 0, reps: 0 }]);
  }
  function renderItem() {
    view = "item";
    var it = plan[idx];
    if (it.t === "learn") renderLearn(it, !S.quick);
    else if (it.t === "ready") renderReady(it);
    else if (it.t === "run") renderRun(it);
    else renderRest(it);
    window.scrollTo(0, 0);
  }

  function renderDone(s) {
    view = "done";
    var total = s.exercises.length, n = exercisesDone(s), wk = weekInfo(dayStatus());
    var h = '<p class="eyebrow">' + (s.complete ? "Session complete" : "Session saved") + "</p>";
    h += "<h1>" + (s.complete ? "All done for today" : n + " of " + plural(total, "exercise") + " done") + "</h1>";
    h += '<p class="lede">' + minutesOf(s) + " min, saved to your history. This week: " + wk.count + " of " + P.weeklyTarget + " days.</p>";
    h += '<div class="stack"><div class="sec">' + wk.html + "</div>";
    h += '<div class="sec"><h3>How does your foot feel now?</h3><div class="seg" role="radiogroup" aria-label="How your foot feels">';
    [["better", "Better"], ["same", "Same"], ["worse", "Worse"]].forEach(function (f) {
      h += '<button role="radio" aria-checked="' + (s.feel === f[0]) + '" data-act="feel" data-v="' + f[0] + '"><b>' + f[1] + "</b></button>";
    });
    h += '</div><p class="hint">Optional. Saved with this session, so you can show the trend at your follow-up.</p></div>';
    if (s.feel === "worse") {
      h += '<div class="callout warn"><h3>If it stays worse</h3><p>Your handout says to stop the exercises and call ' + (P.office ? "the office" : "your clinician") + ' if symptoms stay worse after exercising' +
        (P.office ? ': <a href="' + telHref(P.office.phone) + '"><b>' + esc(P.office.phone) + "</b></a>" : "") + ".</p></div>";
    }
    if (P.afterSession && s.exercises.indexOf("lacrosse-ball") < 0) {
      h += '<div class="callout"><h3>Next</h3><p class="hint" style="margin-top:4px">' + esc(P.afterSession) + "</p></div>";
    }
    h += '</div><div class="fill"></div><div class="bar"><button class="btn sec" data-act="history">History</button><button class="btn pri grow" data-act="home">Done</button></div>';
    app.innerHTML = h;
  }

  function renderHistory() {
    view = "history"; stopTimer(); clearAuto();
    var ds = dayStatus(), wk = weekInfo(ds), today = new Date(), tk = dkey(today), i;
    var sessions = H.filter(function (s) { return s.setsDone > 0; }).sort(function (a, b) { return a.start < b.start ? 1 : -1; });
    var last28 = 0; for (i = 0; i < 28; i++) if (ds[dkey(addDays(today, -i))] === "done") last28++;
    var full = sessions.filter(function (s) { return s.complete; }).length;

    var h = '<div class="top"><button class="btn ghost" data-act="home">&lsaquo; Today</button><span></span></div>';
    h += '<p class="eyebrow" style="margin-top:6px">History</p><h1>Your sessions</h1>';
    h += '<div class="stack">';
    h += '<div class="stats"><div class="stat"><b>' + wk.count + "/" + P.weeklyTarget + '</b><span>days this week</span></div><div class="stat"><b>' + last28 +
      "</b><span>" + (last28 === 1 ? "day" : "days") + ' in the last 4 weeks</span></div><div class="stat"><b>' + full + "</b><span>full " + (full === 1 ? "session" : "sessions") + "</span></div></div>";

    var start = addDays(mondayOf(today), -35), end = addDays(start, 41);
    h += '<section class="sec"><div class="row"><h3>Last 6 weeks</h3><span class="count">' + MON[start.getMonth()] + " " + start.getDate() + " – " + MON[end.getMonth()] + " " + end.getDate() + '</span></div><div class="cal">';
    "MTWTFSS".split("").forEach(function (l) { h += '<span class="h" aria-hidden="true">' + l + "</span>"; });
    for (i = 0; i < 42; i++) {
      var d = addDays(start, i), k = dkey(d), st = ds[k] || "";
      var cls = "c" + (st ? " " + st : "") + (k === tk ? " today" : k > tk ? " future" : "");
      var lab = d.getDate() === 1 ? MON[d.getMonth()] : String(d.getDate());
      h += '<span class="' + cls + '" title="' + esc(fmtDay(d)) + (st === "done" ? ": full session" : st === "part" ? ": partial" : "") + '">' + lab + "</span>";
    }
    h += '</div><div class="legend"><span><i class="done"></i>Full session</span><span><i class="part"></i>Partial</span></div></section>';

    h += '<section class="sec"><h3>Sessions</h3>';
    if (!sessions.length) h += '<p class="empty">No sessions yet. Each set you finish is saved here as you go.</p>';
    else {
      h += '<ul class="sess">';
      sessions.forEach(function (s) {
        var d0 = new Date(s.start), total = s.exercises.length, n = exercisesDone(s);
        h += '<li><div class="row"><span class="when">' + esc(fmtDay(d0)) + '</span><span class="time">' + esc(fmtTime(d0)) + "</span></div>";
        h += '<p class="meta2">' + esc(s.stageLabel) + " · " + minutesOf(s) + " min</p>";
        h += s.complete
          ? '<p class="state ok">All ' + plural(total, "exercise") + " done</p>"
          : '<p class="state part">Partial: ' + n + " of " + plural(total, "exercise") + ", " + s.setsDone + " of " + s.setsPlanned + " sets</p>";
        if (s.feel) h += '<span class="feel' + (s.feel === "worse" ? " worse" : "") + '">' + FEEL[s.feel] + "</span>";
        if (pendingDel === s.id) {
          h += '<div class="confirm"><span>Remove this session?</span><button class="btn sec" data-act="delNo">Keep</button><button class="btn pri" data-act="delYes" data-id="' + esc(s.id) + '">Remove</button></div>';
        } else {
          h += '<button class="linkbtn" data-act="del" data-id="' + esc(s.id) + '">Remove</button>';
        }
        h += "</li>";
      });
      h += "</ul>";
    }
    h += "</section>";
    h += '<section class="sec"><h3>Backup</h3><p class="hint" style="margin-top:0">History lives only on this iPhone, and removing the app from your Home Screen can delete it. Export a backup now and then; you can bring it back with Import.</p>' +
      '<div class="seg" style="margin-top:12px"><button data-act="export"><b>Export backup</b></button><button data-act="import"><b>Import backup</b></button></div></section>';
    h += '<p class="version">' + esc(P.name || "Foot Rehab") + " · version " + VERSION + "</p>";
    h += '</div><div class="fill"></div><div class="bar"><button class="btn pri" data-act="home">Back to today</button></div>';
    app.innerHTML = h;
  }

  /* ---------- backup ---------- */
  function exportHistory() {
    var data = JSON.stringify({ app: "foot-rehab", version: VERSION, exported: new Date().toISOString(), sessions: H }, null, 2);
    var name = "foot-rehab-history-" + dkey(new Date()) + ".json", file = null, can = false;
    try { file = new File([data], name, { type: "application/json" }); can = !!(navigator.canShare && navigator.share && navigator.canShare({ files: [file] })); } catch (e) {}
    if (can) {
      navigator.share({ files: [file], title: "Foot Rehab history" })
        .then(function () { toast("Backup exported"); })
        .catch(function (err) { if (!err || err.name !== "AbortError") downloadFile(data, name); });
      return;
    }
    downloadFile(data, name);
  }
  function downloadFile(data, name) {
    try {
      var url = URL.createObjectURL(new Blob([data], { type: "application/json" })), a = document.createElement("a");
      a.href = url; a.download = name; document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 4000);
      toast("Backup saved");
    } catch (e) {
      try { navigator.clipboard.writeText(data).then(function () { toast("Backup copied to the clipboard"); }, function () { toast("Export did not work on this device"); }); }
      catch (e2) { toast("Export did not work on this device"); }
    }
  }
  importInput.addEventListener("change", function () {
    var f = importInput.files && importInput.files[0];
    if (!f) return;
    var r = new FileReader();
    r.onload = function () {
      try {
        var obj = JSON.parse(String(r.result)), incoming = Array.isArray(obj) ? obj : obj && obj.sessions;
        if (!Array.isArray(incoming)) throw new Error("no sessions");
        var have = {}, added = 0;
        H.forEach(function (s) { have[s.id] = true; });
        incoming.map(clean).forEach(function (s) { if (s && !have[s.id]) { H.push(s); have[s.id] = true; added++; } });
        H.sort(function (a, b) { return a.start < b.start ? -1 : 1; });
        saveH();
        toast(added ? "Imported " + plural(added, "session") : "Nothing new to import");
        renderHistory();
      } catch (e) {
        toast("That file is not a Foot Rehab backup.");
      }
      importInput.value = "";
    };
    r.readAsText(f);
  });

  /* ---------- input ---------- */
  function adjust(key, d) {
    if (key === "rest") { S.rest = clamp((S.rest || 20) + d, 10, 60); }
    else {
      var i = key.indexOf(":"), kind = key.slice(0, i), id = key.slice(i + 1), ex = P.exercises[id];
      if (!ex) return;
      if (kind === "reps" && ex.repsRange) S.reps[id] = clamp(repsOf(ex) + d, ex.repsRange[0], ex.repsRange[1]);
      if (kind === "hold" && ex.holdRange) S.holds[id] = clamp(holdOf(ex) + d, ex.holdRange[0], ex.holdRange[1]);
    }
    saveS();
  }
  function keepScroll(fn) { var y = window.scrollY; fn(); window.scrollTo(0, y); }

  function act(a, b) {
    var k = b ? b.getAttribute("data-k") : null, v = b ? b.getAttribute("data-v") : null, s;
    switch (a) {
      case "set":
        if (k === "quick") S.quick = v === "1"; else if (k === "stage" || k === "first" || k === "order") S[k] = v;
        saveS(); keepScroll(renderHome); break;
      case "sw":
        if (k !== "sound" && k !== "voice" && k !== "silentOk") break;
        S[k] = !S[k]; saveS();
        if (k === "silentOk") setAudioMode();
        if (k === "voice" && S.voice) speak("Spoken cues on.");
        if (k === "sound" && S.sound) beep(660, 0.2);
        keepScroll(renderHome); break;
      case "test":
        if (!S.sound && !S.voice) { toast("Beeps and spoken cues are both off."); break; }
        beep(740, 0.25); setTimeout(function () { beep(520, 0.3); }, 320);
        speak("Sound check.");
        toast("Playing a test sound");
        break;
      case "extra":
        S.extras[k] = !S.extras[k]; saveS(); keepScroll(renderHome); break;
      case "adj":
        adjust(k, parseInt(b.getAttribute("data-d"), 10));
        if (view === "home") keepScroll(renderHome);
        else if (plan[idx] && plan[idx].t === "learn") keepScroll(function () { renderLearn(plan[idx], true); });
        break;
      case "start": startSession(); break;
      case "go": clearAuto(); goNext(); break;
      case "more": clearAuto(); renderLearn(plan[idx], true); window.scrollTo(0, 0); break;
      case "pause": if (paused) resume(); else pause(); break;
      case "skip":
        if (!plan[idx] || !timer) break;
        if (plan[idx].t === "rest" || ci + 1 >= cues.length) { finishCues(); break; }
        paused = false; setPauseLabel(); startCue(ci + 1); break;
      case "redo": stopTimer(); renderItem(); break;
      case "stop":
        clearAuto(); resumeAfterSheet = !!timer && !paused;
        if (resumeAfterSheet) pause();
        sheet.hidden = false;
        var keep = sheet.querySelector('[data-act="stopNo"]'); if (keep) keep.focus();
        break;
      case "stopNo": sheet.hidden = true; if (resumeAfterSheet) resume(); resumeAfterSheet = false; break;
      case "stopYes": resumeAfterSheet = false; endSession(false); break;
      case "home": renderHome(); window.scrollTo(0, 0); break;
      case "history": renderHistory(); window.scrollTo(0, 0); break;
      case "feel":
        s = findSession(lastId);
        if (s) { s.feel = s.feel === v ? null : v; saveH(); keepScroll(function () { renderDone(s); }); }
        break;
      case "del": pendingDel = b.getAttribute("data-id"); keepScroll(renderHistory); break;
      case "delNo": pendingDel = null; keepScroll(renderHistory); break;
      case "delYes":
        var id = b.getAttribute("data-id");
        H = H.filter(function (x) { return x.id !== id; }); saveH(); pendingDel = null;
        keepScroll(renderHistory); toast("Session removed"); break;
      case "export": exportHistory(); break;
      case "import": importInput.click(); break;
    }
  }

  document.addEventListener("click", function (e) {
    if (e.target === sheet) { act("stopNo", null); return; }
    var b = e.target.closest ? e.target.closest("[data-act]") : null;
    if (!b) return;
    initAudio();
    act(b.getAttribute("data-act"), b);
    if (view !== "item") idleAudio();
  });
  document.addEventListener("toggle", function (e) {
    var t = e.target;
    if (!t || !t.classList) return;
    if (t.id === "settings") settingsOpen = t.open;
    if (t.classList.contains("more") && t.open) clearAuto();
  }, true);
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      if (timer && !paused) pause();
      clearAuto(); hush();
    } else if (view === "item") {
      lockScreen();
      try { if (actx && actx.state !== "running") actx.resume(); } catch (e) {}
    } else if (view === "home") {
      keepScroll(renderHome);
    }
  });

  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1")) {
    window.addEventListener("load", function () { navigator.serviceWorker.register("sw.js").catch(function () {}); });
  }

  // Read-only hook used by the automated tests.
  window.__footRehab = function () {
    var it = plan[idx];
    return { view: view, idx: idx, items: plan.length, item: it ? it.t : null, ex: it ? it.ex.id : null, foot: it ? it.foot || null : null, paused: paused, sessions: H.length, auto: !!auto };
  };

  renderHome();
})();
