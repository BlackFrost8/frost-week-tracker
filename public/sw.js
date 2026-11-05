/* Offline shell for the planner.
 *
 * The data was always offline-first (localStorage, mirrored to the account),
 * but the page itself needed the network to open — so on a phone in a
 * basement classroom, the app that holds your week would not start. This
 * keeps the last good build on the device:
 *
 * - Pages: network first, falling back to the cached shell when offline, so a
 *   deploy is picked up on the next online launch.
 * - /assets/*: cache first. Vite names them by content hash, so a cached copy
 *   is correct forever; each online launch drops the ones the current build
 *   no longer references.
 * - Other same-origin files and the Google Fonts CSS/files: served from
 *   cache, refreshed in the background.
 * - Everything else (Firebase, Google APIs) is never touched.
 */

const SHELL = 'frost-shell-v1';
const ASSETS = 'frost-assets-v1';
const FONTS = 'frost-fonts-v1';
const KEEP = [SHELL, ASSETS, FONTS];
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

const scopeUrl = new URL(self.registration.scope);
const shellUrl = new URL('./', scopeUrl).href;

/** Every hashed asset the given index.html loads. */
function assetsIn(html) {
  const found = new Set();
  for (const m of html.matchAll(/(?:src|href)="([^"]*assets\/[^"]+)"/g)) {
    found.add(new URL(m[1], scopeUrl).href);
  }
  return [...found];
}

async function cacheShell(response) {
  const html = await response.clone().text();
  const shell = await caches.open(SHELL);
  await shell.put(shellUrl, response.clone());
  const assets = await caches.open(ASSETS);
  const wanted = assetsIn(html);
  await Promise.all(
    wanted.map(async (url) => {
      if (!(await assets.match(url))) await assets.add(url);
    }),
  );
  // Drop what the previous builds left behind.
  const wantedSet = new Set(wanted);
  for (const req of await assets.keys()) {
    if (!wantedSet.has(req.url)) await assets.delete(req);
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    fetch(shellUrl, { cache: 'no-cache' })
      .then((res) => (res.ok ? cacheShell(res) : undefined))
      .catch(() => {})
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !KEEP.includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function networkFirstPage(request) {
  try {
    const res = await fetch(request);
    // Only the app's own entry page is the shell; privacy.html and friends
    // are cached like any other file.
    const url = new URL(request.url);
    if (res.ok && (url.href === shellUrl || url.pathname.endsWith('/index.html'))) {
      cacheShell(res.clone()).catch(() => {});
    } else if (res.ok) {
      const shell = await caches.open(SHELL);
      shell.put(request, res.clone()).catch(() => {});
    }
    return res;
  } catch (err) {
    const shell = await caches.open(SHELL);
    return (await shell.match(request, { ignoreSearch: true })) || (await shell.match(shellUrl)) || Promise.reject(err);
  }
}

async function cacheFirst(request) {
  const assets = await caches.open(ASSETS);
  const hit = await assets.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) assets.put(request, res.clone()).catch(() => {});
  return res;
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  const refresh = fetch(request)
    .then((res) => {
      if (res.ok || res.type === 'opaque') cache.put(request, res.clone()).catch(() => {});
      return res;
    })
    .catch(() => hit);
  return hit || refresh;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (FONT_HOSTS.includes(url.hostname)) {
    event.respondWith(staleWhileRevalidate(request, FONTS));
    return;
  }
  if (url.origin !== scopeUrl.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstPage(request));
  } else if (url.pathname.includes('/assets/')) {
    event.respondWith(cacheFirst(request));
  } else if (url.pathname.endsWith('/sw.js')) {
    return;
  } else {
    event.respondWith(staleWhileRevalidate(request, SHELL));
  }
});
