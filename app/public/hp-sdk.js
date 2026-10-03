/*!
 * Hanif Play SDK v1 — runs inside a game iframe and talks to the hub (parent window) over postMessage.
 * The hub injects this automatically into every game's HTML, so existing games work with zero changes.
 * Games that want more can call the `hp` global (see docs in ROADMAP §5).
 *
 *   hp.loading.done()            tell the hub the first playable frame is up
 *   hp.gameplay.start()/stop()   mark real gameplay (drives playtime; menus/cutscenes can call stop)
 *   hp.on("pause"|"resume", fn)  hub opened/closed its Guide overlay
 *   hp.event.track(name, props)  light analytics event (hub decides where it goes)
 *   hp.paused                    true while the Guide overlay is open
 *
 * Protocol: JSON messages {hp:1, t:<type>, ...}. Hub only accepts messages from the game frame it created.
 * When the origins are split (play.<brand>) this upgrades to a MessageChannel handshake; the `hp` API stays the same.
 */
(function () {
  "use strict";
  if (window.hp) return;
  var inFrame = window.parent && window.parent !== window;
  var PARENT = location.origin; // same-origin today; becomes the hub origin allowlist later
  var listeners = { pause: [], resume: [] };
  var api;

  function send(t, data) {
    if (!inFrame) return;
    var m = { hp: 1, t: t };
    if (data) for (var k in data) m[k] = data[k];
    try { window.parent.postMessage(m, PARENT); } catch (e) {}
  }

  // ---- audio: track every AudioContext so the hub can pause sound while the Guide is open
  var ctxs = [];
  ["AudioContext", "webkitAudioContext"].forEach(function (n) {
    var Orig = window[n];
    if (!Orig || Orig.__hp) return;
    var Wrapped = function (opts) {
      var c = new Orig(opts);
      ctxs.push(c);
      return c;
    };
    Wrapped.prototype = Orig.prototype;
    Wrapped.__hp = true;
    try { window[n] = Wrapped; } catch (e) {}
  });

  var mutedByHub = [];
  function setPaused(p) {
    api.paused = p;
    ctxs.forEach(function (c) { try { p ? c.suspend() : c.resume(); } catch (e) {} });
    if (p) {
      mutedByHub = [];
      document.querySelectorAll("audio,video").forEach(function (el) {
        if (!el.muted && !el.paused) { el.pause(); mutedByHub.push(el); }
      });
    } else {
      mutedByHub.forEach(function (el) { try { el.play(); } catch (e) {} });
      mutedByHub = [];
    }
    // most games already pause on blur/focus — reuse that instead of requiring game changes
    try { window.dispatchEvent(new Event(p ? "blur" : "focus")); } catch (e) {}
    (listeners[p ? "pause" : "resume"] || []).slice().forEach(function (f) { try { f(); } catch (e) {} });
  }

  // ---- activity: input events never reach the parent window, so forward a throttled ping
  var lastPing = 0;
  function activity() {
    var now = Date.now();
    if (now - lastPing < 4000) return;
    lastPing = now;
    send("activity");
  }
  ["pointerdown", "keydown", "touchstart", "wheel"].forEach(function (ev) {
    window.addEventListener(ev, activity, { capture: true, passive: true });
  });

  // ---- escape hatch: keyboard + gamepad can always open the hub's Guide overlay
  window.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && e.shiftKey) { e.preventDefault(); send("guide"); }
  }, true);
  var padHeld = false;
  setInterval(function () {
    var pads = navigator.getGamepads ? navigator.getGamepads() : [];
    var hit = false, moved = false;
    for (var i = 0; i < pads.length; i++) {
      var g = pads[i];
      if (!g) continue;
      var b = g.buttons;
      if ((b[16] && b[16].pressed) || (b[8] && b[8].pressed && b[9] && b[9].pressed)) hit = true; // Guide, or Back+Start
      for (var j = 0; j < b.length; j++) if (b[j].pressed) moved = true;
      for (var a = 0; a < g.axes.length; a++) if (Math.abs(g.axes[a]) > 0.5) moved = true;
    }
    if (moved) activity();
    if (hit && !padHeld) send("guide");
    padHeld = hit;
  }, 120);

  // ---- tiny fps probe so QA bots (and the future Ready Gate) can read performance without touching game code
  var frames = 0, fps = 0, t0 = performance.now();
  (function loop() {
    frames++;
    var t = performance.now();
    if (t - t0 >= 1000) { fps = Math.round((frames * 1000) / (t - t0)); frames = 0; t0 = t; }
    requestAnimationFrame(loop);
  })();

  api = {
    version: 1,
    ready: false,
    paused: false,
    standalone: !inFrame,
    loading: {
      done: function () { api.ready = true; send("loaded"); },
    },
    gameplay: {
      start: function () { send("gameplay", { on: true }); },
      stop: function () { send("gameplay", { on: false }); },
    },
    event: {
      track: function (name, props) { send("event", { name: String(name).slice(0, 64), props: props || {} }); },
    },
    progress: {
      /** hp.progress.report("ch2") or hp.progress.report({ milestone: "ch2" }) */
      report: function (m) { send("progress", { milestone: String((m && m.milestone) || m).slice(0, 64) }); },
    },
    achievement: {
      unlock: function (id) { send("achievement", { id: String(id).slice(0, 64) }); },
    },
    stat: {
      increment: function (name, n) { send("stat", { name: String(name).slice(0, 40), n: Number(n) || 1 }); },
    },
    on: function (name, fn) { if (listeners[name]) listeners[name].push(fn); },
    off: function (name, fn) { var l = listeners[name]; if (l) { var i = l.indexOf(fn); if (i >= 0) l.splice(i, 1); } },
    guide: function () { send("guide"); },
  };
  window.hp = api;
  window.__hp = { get ready() { return api.ready; }, stats: function () { return { fps: fps }; } };

  window.addEventListener("message", function (e) {
    if (e.source !== window.parent || e.origin !== PARENT) return;
    var d = e.data;
    if (!d || d.hp !== 1) return;
    if (d.t === "pause") setPaused(true);
    else if (d.t === "resume") setPaused(false);
  });

  send("hello", { v: 1, sdk: "1.0.0" });
  if (document.readyState === "complete") api.loading.done();
  else window.addEventListener("load", function () { api.loading.done(); });
})();
