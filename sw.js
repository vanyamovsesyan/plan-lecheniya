/* Service worker для «Плана лечения».
 *
 * Задача одна: после первого открытия приложение должно запускаться БЕЗ СЕТИ. В кабинете может не
 * ловить, и обычная веб-страница там просто не откроется — весь смысл офлайнового приложения
 * пропал бы на ровном месте.
 *
 * Стратегия — «сначала кэш, обновление в фоне». Запуск всегда мгновенный и всегда работает, а
 * свежая версия подтягивается следом и применяется со следующего открытия. Отставание на один
 * запуск — сознательная плата за то, что приложение никогда не встречает врача белым экраном.
 *
 * ВАЖНО при выпуске новой версии: подними CACHE_VERSION, иначе телефоны продолжат отдавать старое.
 */
const CACHE_VERSION = 'plan-lecheniya-v1';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      // addAll падает целиком, если хоть один файл не скачался; кладём по одному, чтобы
      // отсутствие иконки не оставило приложение вообще без кэша.
      .then((cache) => Promise.all(ASSETS.map((url) => cache.add(url).catch(() => null))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((n) => n !== CACHE_VERSION).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if(req.method !== 'GET') return;
  // Чужие домены не трогаем: у приложения их нет, но если появятся — пусть идут своим путём.
  if(new URL(req.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req).then((res) => {
        if(res && res.status === 200 && res.type === 'basic'){
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => null);

      // Есть в кэше — отдаём сразу, сеть догоняет в фоне.
      if(cached) return cached;
      // Нет в кэше и нет сети — для перехода по адресу отдаём главную страницу, чтобы
      // приложение всё равно открылось, а не показало ошибку браузера.
      return network.then((res) => res || caches.match('./index.html'));
    })
  );
});
