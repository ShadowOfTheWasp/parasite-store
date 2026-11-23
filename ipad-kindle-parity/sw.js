'use strict';
const VERSION='parasite-v3-fresh-workshop-20261123-v1',FILES=["/index.html","/manifest.webmanifest","/parasite-v2.css","/parasite-v2.js","/parasite-v2-layout.css","/save-control.js","/parasite-v2-module-layout.js"];
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
self.addEventListener('activate',e=>e.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(k=>(k.startsWith('parasite-kindle-originals-')||k.startsWith('parasite-orbit-four-osc-')||k.startsWith('parasite-orbit-strings-')||k.startsWith('parasite-hub-invent-')||k.startsWith('parasite-orbit-clock-16th-')||k.startsWith('parasite-slice-single-presets-')||k.startsWith('parasite-ipad-one-screen-')||k.startsWith('parasite-tron-keyboard-')||k.startsWith('parasite-slice-mpc-16-pad-')||k.startsWith('parasite-hub-deploy-ui-')||k.startsWith('parasite-inline-queue-')||k.startsWith('parasite-nocturne-v2-')||k.startsWith('parasite-spectrum-v2-')||k.startsWith('parasite-hard-unified-v2-')||k.startsWith('parasite-tide-space-bounce-')||k.startsWith('parasite-response-queue-')||k.startsWith('parasite-creator-routefix-')||k.startsWith('parasite-orbit-scrollfix-')||k.startsWith('parasite-native-deploy-')||k.startsWith('parasite-v3-fresh-workshop-'))&&k!==VERSION).map(k=>caches.delete(k)));await self.clients.claim()})()));
self.addEventListener('message',e=>{
 const client=e.source;
 if(e.data?.type==='CHECK_OFFLINE'){e.waitUntil(status().then(s=>client?.postMessage(s)))}
 if(e.data?.type==='SYNC_OFFLINE'){e.waitUntil(sync(client))}
});
self.addEventListener('fetch',e=>{
 const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==self.location.origin||u.pathname.startsWith('/api/')||u.pathname.startsWith('/creator')||u.pathname==='/app.js'||u.pathname==='/style.css')return;
 e.respondWith((async()=>{
  const cache=await caches.open(RESPONSE_CACHE);
  const existing=await cache.match(e.request,{ignoreSearch:false});
  if(existing)return existing;
  try{const response=await fetch(e.request);if(response.ok)cache.put(e.request,response.clone()).catch(()=>{});return response}
  catch(e){if(e.request.mode==='navigate')return (await cache.match(offlineFallback))||Response.error();return Response.error()}
 })());
});
