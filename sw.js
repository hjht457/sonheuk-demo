// 서비스워커 — 한 번 열어 본 뒤엔 오프라인에서도 뜬다.
//  assets/* : 파일명에 해시가 있어 캐시 우선.  그 외(index 등): 네트워크 우선, 실패 시 캐시.
//  빌드마다 CACHE 이름이 바뀌어(tools/postbuild.mjs) 옛 캐시는 activate 때 지운다.
const CACHE = 'sonheuk-20260927073042';
const SHELL = ['./', './index.html', './manifest.webmanifest'];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.includes('/assets/')) {
    e.respondWith(caches.open(CACHE).then(async (c) => {
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) c.put(req, res.clone());
      return res;
    }));
    return;
  }
  // 그 외(index 등): 캐시가 있으면 먼저 내주고 뒤에서 새로 받아 둔다(stale-while-revalidate).
  // 학원 와이파이가 느려도 두 번째 방문부터는 기다림이 없다. 대신 배포 직후 한 번은 옛 화면이 뜨고,
  // 그 사이 새 버전을 받아 두므로 다음에 열면 최신이다.
  e.respondWith(caches.open(CACHE).then(async (c) => {
    const hit = await c.match(req, { ignoreSearch: true });
    const net = fetch(req).then((res) => { if (res.ok) c.put(req, res.clone()); return res; });
    if (hit) { e.waitUntil(net.catch(() => {})); return hit; }
    return net;
  }));
});
