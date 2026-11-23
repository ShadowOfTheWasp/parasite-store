'use strict';
const VERSION='parasite-v3-offline-integrity-20261123-v1',FILES=["/index.html","/manifest.webmanifest","/parasite-v2.css","/parasite-v2.js","/parasite-v2-layout.css","/save-control.js","/parasite-v2-module-layout.js","/tools/catalogue.json","/tools/rta-history/v1.0.0/index.html","/tools/tape-keys/v1.0.0/index.html","/tools/chorus-6/v1.0.0/index.html"];
const RESPONSE_CACHE=VERSION,offlineFallback='/index.html';
const CATALOGUE='/tools/catalogue.json';
const toolPath=/^\/tools\/[a-z0-9-]+\/v[0-9]+\.[0-9]+\.[0-9]+\/index\.html$/;
function cataloguePaths(data){
 if(data?.version!==1||!Array.isArray(data.tools))throw Error('Invalid catalogue');
 const paths=data.tools.map(item=>String(item?.url||''));
 if(paths.some(p=>!toolPath.test(p))||new Set(paths).size!==paths.length)throw Error('Unsafe or duplicate tool path');
 return paths;
}
async function status(){
 const cache=await caches.open(RESPONSE_CACHE);
 const catalogued=await cache.match(CATALOGUE);
 let tools=[];
 try{if(catalogued)tools=cataloguePaths(await catalogued.json())}catch{tools=[]}
 const required=[...new Set([...FILES,...tools])];
 const hits=await Promise.all(required.map(u=>cache.match(u)));
 return {type:'CACHE_PROGRESS',saved:hits.filter(Boolean).length,total:required.length,ready:!!catalogued&&hits.every(Boolean)};
}
async function storeResponse(cache,path){
 const r=await fetch(new Request(path,{cache:'no-store'}));
 if(!r.ok||r.type==='opaque')throw Error(path+' HTTP '+r.status);
 await cache.put(path,r.clone());
}
async function refreshCatalogue(cache){
 const r=await fetch(new Request(CATALOGUE,{cache:'no-store'}));
 if(!r.ok)throw Error('Catalogue HTTP '+r.status);
 const paths=cataloguePaths(await r.clone().json());
 // Commit catalogue only after all listed tools are safely available offline.
 for(const path of paths){if(!(await cache.match(path)))await storeResponse(cache,path)}
 await cache.put(CATALOGUE,r.clone());
 return r;
}
async function sync(sender){
 const cache=await caches.open(RESPONSE_CACHE);
 let failure=null;
 for(const file of FILES.filter(f=>f!==CATALOGUE)){
  try{await storeResponse(cache,file)}
  catch(e){failure=String(e.message);sender?.postMessage({type:'CACHE_ERROR',reason:failure.slice(0,120)})}
  sender?.postMessage(await status());
 }
 try{await refreshCatalogue(cache)}
 catch(e){failure=String(e.message);sender?.postMessage({type:'CACHE_ERROR',reason:failure.slice(0,120)})}
 const result=await status();sender?.postMessage(result);
 return {...result,error:failure};
}
self.addEventListener('install',e=>e.waitUntil((async()=>{await sync(null);await self.skipWaiting()})()));
self.addEventListener('activate',e=>e.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(k=>(k.startsWith('parasite-kindle-originals-')||k.startsWith('parasite-orbit-four-osc-')||k.startsWith('parasite-orbit-strings-')||k.startsWith('parasite-hub-invent-')||k.startsWith('parasite-orbit-clock-16th-')||k.startsWith('parasite-slice-single-presets-')||k.startsWith('parasite-ipad-one-screen-')||k.startsWith('parasite-tron-keyboard-')||k.startsWith('parasite-slice-mpc-16-pad-')||k.startsWith('parasite-hub-deploy-ui-')||k.startsWith('parasite-inline-queue-')||k.startsWith('parasite-nocturne-v2-')||k.startsWith('parasite-spectrum-v2-')||k.startsWith('parasite-hard-unified-v2-')||k.startsWith('parasite-tide-space-bounce-')||k.startsWith('parasite-response-queue-')||k.startsWith('parasite-creator-routefix-')||k.startsWith('parasite-orbit-scrollfix-')||k.startsWith('parasite-native-deploy-')||k.startsWith('parasite-v3-fresh-workshop-')||k.startsWith('parasite-v3-rta-visible-')||k.startsWith('parasite-v3-tapekeys-')||k.startsWith('parasite-v3-library-catalogue-')||k.startsWith('parasite-v3-chorus6-')||k.startsWith('parasite-v3-offline-integrity-'))&&k!==VERSION).map(k=>caches.delete(k)));await self.clients.claim()})()));
self.addEventListener('message',e=>{
 const client=e.source;
 if(e.data?.type==='CHECK_OFFLINE'){e.waitUntil(status().then(s=>client?.postMessage(s)))}
 if(e.data?.type==='SYNC_OFFLINE'){e.waitUntil(sync(client))}
});
self.addEventListener('fetch',e=>{
 const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==self.location.origin||u.pathname.startsWith('/api/')||u.pathname.startsWith('/creator')||u.pathname==='/app.js'||u.pathname==='/style.css')return;
 e.respondWith((async()=>{
  const cache=await caches.open(RESPONSE_CACHE);
  // Installed tools are updated from the published catalogue, not old cache.
  if(u.pathname===CATALOGUE){
   try{return await refreshCatalogue(cache)}
   catch{return (await cache.match(CATALOGUE))||Response.error()}
  }
  const existing=await cache.match(e.request,{ignoreSearch:false});
  if(existing)return existing;
  try{const response=await fetch(e.request);if(response.ok)cache.put(e.request,response.clone()).catch(()=>{});return response}
  catch(e){if(e.request.mode==='navigate')return (await cache.match(offlineFallback))||Response.error();return Response.error()}
 })());
});
