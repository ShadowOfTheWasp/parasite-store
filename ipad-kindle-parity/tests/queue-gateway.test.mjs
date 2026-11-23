import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/queue.mjs';
const host='parasite-ipad-originals.vercel.app';
function res(){return {code:200,headers:{},status(n){this.code=n;return this},setHeader(k,v){this.headers[k.toLowerCase()]=v;return this},json(x){this.data=x;return this},send(x){this.data=x;return this}}}
async function invoke(method,body,headers={}){const r=res();await handler({method,body,headers:{host,...headers}},r);return r}
const original=globalThis.fetch;
test.after(()=>{globalThis.fetch=original});
test('rejects unsupported method before network',async()=>{globalThis.fetch=()=>{throw Error('unexpected')};const r=await invoke('DELETE');assert.equal(r.code,405);assert.equal(r.headers.allow,'GET, POST')});
test('rejects cross-origin POST',async()=>{globalThis.fetch=()=>{throw Error('unexpected')};assert.equal((await invoke('POST',{x:1},{origin:'https://evil.example'})).code,403)});
test('rejects malformed JSON',async()=>{globalThis.fetch=()=>{throw Error('unexpected')};assert.equal((await invoke('POST','{',{origin:`https://${host}`})).code,400)});
test('rejects oversize request',async()=>{globalThis.fetch=()=>{throw Error('unexpected')};assert.equal((await invoke('POST',{text:'a'.repeat(25001)},{origin:`https://${host}`})).code,413)});
test('forwards GET with owner cookie and no-store',async()=>{let captured;globalThis.fetch=async(u,options)=>{captured={u,options};return new Response(JSON.stringify({requests:[]}),{headers:{'content-type':'application/json'}})};const r=await invoke('GET',undefined,{cookie:'session=test'});assert.equal(r.code,200);assert.equal(r.headers['cache-control'],'private, no-store');assert.equal(captured.options.headers.Cookie,'session=test');assert.equal(captured.options.redirect,'manual')});
test('forwards POST unchanged and upstream rejection',async()=>{let captured;globalThis.fetch=async(u,options)=>{captured=options;return new Response(JSON.stringify({error:'unauthorized'}),{status:401,headers:{'content-type':'application/json'}})};const r=await invoke('POST',{action:'reply',request_id:'abc',reply:'yes'},{origin:`https://${host}`});assert.equal(r.code,401);assert.deepEqual(JSON.parse(captured.body),{action:'reply',request_id:'abc',reply:'yes'})});
test('upstream network failure is 502',async()=>{globalThis.fetch=async()=>{throw Error('offline')};assert.equal((await invoke('GET')).code,502)});
test('oversize upstream response is rejected',async()=>{globalThis.fetch=async()=>new Response('a'.repeat(300001));assert.equal((await invoke('GET')).code,502)});
