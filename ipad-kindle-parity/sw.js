'use strict';
const VERSION='parasite-kindle-originals-20261122-b2',FILES=["/index.html","/manifest.webmanifest","/orbit/v4.1.0/index.html","/orbit/v4.1.0/samples.js","/orbit/v4.1.0/space-echo.js","/tron/v4.0.0/index.html","/tron/v4.0.0/samples.js","/slice/v1.0.0/index.html","/slice/v1.0.0/h910.js","/slice/v1.0.0/splice.css","/slice/v1.0.0/splice.js"];
const RESPONSE_CACHE=VERSION,offlineFallback='/index.html';
async function status(){const cache=await caches.open(RESPONSE_CACHE);const hits=await Promise.all(FILES.map(u=>cache.match(u)));return {type:'CACHE_PROGRESS',saved:hits.filter(Boolean).length,total:FILES.length,ready:hits.every(Boolean)}}
async function sync(sender){
 const cache=await caches.open(RESPONSE_CACHE);
 for(const file of FILES){
  try{const r=await fetch(new Request(file,{cache:'reload'}));if(!r.ok)throw Error('HTTP '+r.status);await cache.put(file,r.clone());}
  catch(e){if(sender)sender.postMessage({type:'CACHE_ERROR',reason:file+' '+String(e.message).slice(0,90)})}
  if(sender)sender.postMessage(await status());
 }
 return status()
}
self.addEventListener('install',e=>e.waitUntil((async()=>{await sync(null);await self.skipWaiting()})()));
self.addEventListener('activate',e=>e.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(k=>k.startsWith('parasite-kindle-originals-')&&k!==VERSION).map(k=>caches.delete(k)));await self.clients.claim()})()));
self.addEventListener('message',e=>{
 const client=e.source;
 if(e.data?.type==='CHECK_OFFLINE'){e.waitUntil(status().then(s=>client?.postMessage(s)))}
 if(e.data?.type==='SYNC_OFFLINE'){e.waitUntil(sync(client))}
});
self.addEventListener('fetch',e=>{
 const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==self.location.origin)return;
 e.respondWith((async()=>{
  const cache=await caches.open(RESPONSE_CACHE);
  const existing=await cache.match(e.request,{ignoreSearch:false});
  if(existing)return existing;
  try{const response=await fetch(e.request);if(response.ok)cache.put(e.request,response.clone()).catch(()=>{});return response}
  catch(e){if(e.request.mode==='navigate')return (await cache.match(offlineFallback))||Response.error();return Response.error()}
 })());
});
