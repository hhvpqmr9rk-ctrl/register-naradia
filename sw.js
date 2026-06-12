// SiteFix offline cache
const CACHE='sitefix-v1';
self.addEventListener('install', e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(['./sitefix.html'])));
  self.skipWaiting();
});
self.addEventListener('activate', e=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(
    keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))
  )));
  self.clients.claim();
});
self.addEventListener('fetch', e=>{
  const url=new URL(e.request.url);
  // Cache only the app page itself; Firebase/CDN requests go to network
  if(url.pathname.endsWith('sitefix.html') || url.pathname.endsWith('/')){
    e.respondWith(
      fetch(e.request).then(r=>{
        const copy=r.clone();
        caches.open(CACHE).then(c=>c.put(e.request, copy));
        return r;
      }).catch(()=>caches.match(e.request))
    );
  }
});
