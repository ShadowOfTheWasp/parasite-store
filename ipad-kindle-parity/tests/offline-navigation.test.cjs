'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'..','sw.js'),'utf8');
async function request(path,{cachedHub=false,cachedTool=false}={}){
 const listeners={};let response;
 const cache={match:async key=>{
  const p=typeof key==='string'?key:new URL(key.url).pathname;
  if(p==='/index.html'&&cachedHub)return new Response('HUB');
  if(p===path&&cachedTool)return new Response('TOOL');
  return undefined;
 },put:async()=>{}};
 const sandbox={self:{location:{origin:'https://example.test'},addEventListener:(n,fn)=>listeners[n]=fn},caches:{open:async()=>cache},fetch:async()=>{throw Error('offline')},Request,Response,URL,console};
 vm.runInNewContext(source,sandbox,{filename:'sw.js'});
 const event={request:new Request('https://example.test'+path),respondWith:p=>{response=p}};
 listeners.fetch(event);assert.ok(response,'fetch must be intercepted');
 return await response;
}
test('missing offline tool never returns cached Hub HTML',async()=>{
 const response=await request('/tools/tape-keys/v1.0.0/index.html',{cachedHub:true});
 assert.equal(response.type,'error');
});
test('ordinary offline navigation can use cached Hub fallback',async()=>{
 const response=await request('/some-page',{cachedHub:true});
 assert.equal(await response.text(),'HUB');
});
test('offline non-navigation missing resource fails closed',async()=>{
 const response=await request('/unavailable.js',{cachedHub:true});
 assert.equal(response.type,'error');
});
test('cached instrument continues to open offline',async()=>{
 const response=await request('/tools/tape-keys/v1.0.0/index.html',{cachedHub:true,cachedTool:true});
 assert.equal(await response.text(),'TOOL');
});
