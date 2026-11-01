const CACHE_VERSION = 'rakaez-pwa-v6';
const APP_SHELL = [
  '/index.html', '/about.html', '/contact.html', '/services.html', '/rental.html',
  '/recruitment.html', '/workers.html', '/request.html', '/offline.html',
  '/manifest.webmanifest', '/css/styles.css', '/css/brand-lockup.css',
  '/css/design-enhancements.css', '/css/theme-palettes.css', '/css/mobile.css',
  '/css/navbar-glass.css', '/css/footer-polish.css', '/css/pwa.css', '/css/pwa-app.css',
  '/js/main.js', '/js/motion.js', '/js/rental-announcement.js',
  '/js/supabase-config.js', '/js/supabase-client.js', '/js/support-chat.js',
  '/js/pwa.js', '/js/app-shell.js', '/assets/images/logo-mark-refined.png',
  '/assets/images/home-promo-recruitment.jpg', '/assets/images/home-promo-workers.jpg',
  '/assets/images/home-promo-rental.jpg',
  '/assets/images/pwa-192.png', '/assets/images/pwa-512.png',
  '/assets/images/pwa-maskable-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_VERSION).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('rakaez-pwa-') && key !== CACHE_VERSION).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(response => {
      if (response.ok) caches.open(CACHE_VERSION).then(cache => cache.put(request, response.clone()));
      return response;
    }).catch(async () => (await caches.match(request)) || (await caches.match('/offline.html')) || caches.match('/index.html')));
    return;
  }

  event.respondWith(caches.match(request).then(cached => {
    if (cached) return cached;
    return fetch(request).then(response => {
      if (response.ok && response.type === 'basic') caches.open(CACHE_VERSION).then(cache => cache.put(request, response.clone()));
      return response;
    });
  }));
});

self.addEventListener('push', event => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {} } catch { payload = { body: event.data?.text() || '' } }
  const title = String(payload.title || 'الركائز البشرية للاستقدام').slice(0, 80);
  const options = {
    body: String(payload.body || 'لديك تحديث جديد من الركائز البشرية للاستقدام.').slice(0, 240),
    icon: '/assets/images/pwa-192.png',
    badge: '/assets/images/pwa-192.png',
    dir: 'rtl',
    lang: 'ar',
    tag: String(payload.tag || 'rakaez-update').slice(0, 80),
    renotify: false,
    data: { url: typeof payload.url === 'string' && payload.url.startsWith('/') && !payload.url.startsWith('//') ? payload.url : '/index.html' }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/index.html', self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windows => {
    const existing = windows.find(client => new URL(client.url).origin === self.location.origin);
    if (existing) return existing.navigate(target).then(() => existing.focus());
    return self.clients.openWindow(target);
  }));
});
