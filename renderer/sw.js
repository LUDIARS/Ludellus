// UniLand PWA service worker。 オフライン優先 (cache-first for static, network-first for dynamic).
// 中央 Web と連携する API 呼び出しは fetch のままパススルー (オフラインなら失敗 → score.js が sync queue に温存)。

const CACHE_VERSION = "uniland-v2";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

// 起動時に precache する基本リソース。
const PRECACHE_URLS = [
  "./",
  "./index.html",
  "./shell.html",
  "./shell.js",
  "./manifest.webmanifest",
  "./icons/uni-icon.svg",
  "./lib/score.js",
  "./lib/theme.css",
  "./lib/uni-character.js",
  "./lib/voice.js",
  "./lib/sound.js",
  "./lib/mobile.js",
  "./lib/render.js",
  "./lib/scene.js",
  "./lib/scene-manager.js",
  "./lib/index.js",
  "./games/uni-tap/scene.js",
  "./games/uni-rain/scene.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS).catch(() => {
      // 一部 URL が無くても全体は失敗させない (templates 等は任意)
    })),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter((k) => !k.startsWith(CACHE_VERSION)).map((k) => caches.delete(k)),
    );
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // 中央 Web API は network-first、 オフライン時はキャッシュも無いので失敗で OK
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(req).catch(() => new Response(JSON.stringify({ offline: true }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      })),
    );
    return;
  }

  // 静的リソース: cache-first、 無ければ network、 取得できたら runtime cache に入れる
  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;
    try {
      const res = await fetch(req);
      if (res.ok && res.type === "basic") {
        const cache = await caches.open(RUNTIME_CACHE);
        cache.put(req, res.clone());
      }
      return res;
    } catch {
      // オフラインで初回アクセスなら fallback
      return caches.match("./index.html") ?? Response.error();
    }
  })());
});
