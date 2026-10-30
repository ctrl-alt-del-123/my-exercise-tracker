/*
  Foot Rehab service worker.
  App files: network first, so a published change shows up the next time the app opens online;
  the saved copy is used when the phone is offline or the network is slow (over 3 seconds).
  Fonts: saved copy first.
  Bump CACHE when the list of app files changes.
*/
var CACHE = "foot-rehab-v2";
var CORE = ["./", "./index.html", "./app.js", "./exercises.js", "./manifest.webmanifest",
  "./icons/icon-180.png", "./icons/icon-192.png", "./icons/icon-512.png"];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(CORE); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function fromCache(req) {
  return caches.match(req, { ignoreSearch: true }).then(function (r) {
    return r || (req.mode === "navigate" ? caches.match("./index.html") : undefined);
  });
}

function networkFirst(req) {
  return new Promise(function (resolve) {
    var settled = false;
    function done(r) { if (!settled && r) { settled = true; resolve(r); } }
    var slow = setTimeout(function () { fromCache(req).then(done); }, 3000);
    fetch(new Request(req.url, { cache: "no-cache", credentials: "same-origin" })).then(function (res) {
      clearTimeout(slow);
      if (res && res.ok) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
      }
      done(res);
    }).catch(function () {
      clearTimeout(slow);
      fromCache(req).then(function (r) { if (!settled) { settled = true; resolve(r || Response.error()); } });
    });
  });
}

function cacheFirst(req) {
  return caches.match(req).then(function (r) {
    return r || fetch(req).then(function (res) {
      if (res && (res.ok || res.type === "opaque")) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
      }
      return res;
    });
  });
}

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  if (url.origin === self.location.origin) e.respondWith(networkFirst(req));
  else if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") e.respondWith(cacheFirst(req));
});
