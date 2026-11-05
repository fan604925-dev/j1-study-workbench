/**
 * 初一学习工作台 - Service Worker
 * ============================================================
 * 策略：HTML/JS/CSS/manifest 网络优先（刷新拿最新），离线回退缓存；
 *       图标与 CDN 白名单缓存优先。
 * ⚠️ 重要：本站与「暑假学习管家」可能部署在同一 origin
 *    （fan604925-dev.github.io），Cache Storage 是按 origin 共享的，
 *    所以 activate 时【只清理 j1- 前缀的旧缓存】，绝不删其他应用的缓存。
 * 版本升级 CheckList：CACHE_NAME 递增（j1-v1 → j1-v2 …）
 *    并与 js/store.js 的 DATA_VERSION 成对升级。
 * ============================================================
 */
const CACHE_NAME = 'j1-v10';

const PRECACHE_FILES = [
  'icons/icon-192.png',
  'icons/icon-512.png',
  'manifest.json'
];

// CDN 白名单（跨域只缓存 GET）
const CDN_HOSTS = ['cdn.tailwindcss.com', 'cdn.jsdelivr.net'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_FILES).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    // 只清理本应用自己的旧缓存（j1- 前缀），不动其他应用
    caches.keys().then(keys =>
      Promise.all(keys.map(k => (k.indexOf('j1-') === 0 && k !== CACHE_NAME) ? caches.delete(k) : null))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);
  const isSameOrigin = url.origin === self.location.origin;
  const isNavigate = e.request.mode === 'navigate' || e.request.destination === 'document';
  const isCdn = CDN_HOSTS.indexOf(url.host) >= 0;

  // 图标 / CDN 静态资源：缓存优先（离线友好），后台更新
  if (/\/icons\//.test(url.pathname) || url.pathname.endsWith('.png') || isCdn) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        const fetchPromise = fetch(e.request).then(resp => {
          if (resp && resp.ok) {
            const clone = resp.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
          }
          return resp;
        }).catch(() => cached);
        return cached || fetchPromise;
      })
    );
    return;
  }

  // 本站 HTML / JS / CSS / manifest：网络优先，离线回退缓存
  if (isSameOrigin) {
    e.respondWith(
      fetch(e.request)
        .then(resp => {
          if (resp.ok) {
            const clone = resp.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
          }
          return resp;
        })
        .catch(() => {
          return caches.match(e.request).then(cached => {
            if (cached) return cached;
            if (isNavigate) return caches.match('index.html');
            return new Response('离线状态，请联网后重试', {
              status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' }
            });
          });
        })
    );
  }
});
