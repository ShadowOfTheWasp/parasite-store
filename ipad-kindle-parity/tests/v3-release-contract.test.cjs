'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('catalogue has unique, versioned, local instrument entries with existing files',()=>{
 const c=JSON.parse(read('tools/catalogue.json'));
 assert.equal(c.version,1);
 assert.ok(Array.isArray(c.tools)&&c.tools.length>0);
 const ids=new Set(),urls=new Set();
 for(const t of c.tools){
  assert.match(t.id,/^[a-z0-9-]+$/);
  assert.match(t.version,/^\d+\.\d+\.\d+$/);
  assert.equal(t.url,'/tools/'+t.id+'/v'+t.version+'/index.html');
  assert.ok(!ids.has(t.id),'duplicate id '+t.id);ids.add(t.id);
  assert.ok(!urls.has(t.url),'duplicate URL '+t.url);urls.add(t.url);
  assert.ok(fs.statSync(path.join(root,t.url.slice(1))).isFile());
  assert.ok(typeof t.title==='string'&&t.title.trim());
 }
});
test('service worker precaches every published instrument and uses network-first catalogue',()=>{
 const c=JSON.parse(read('tools/catalogue.json')),sw=read('sw.js');
 for(const t of c.tools)assert.ok(sw.includes(JSON.stringify(t.url)),'missing offline precache '+t.url);
 assert.match(sw,/refreshCatalogue\(cache\)/);
 assert.match(sw,/cache\.put\(CATALOGUE,r\.clone\(\)\)/);
 assert.match(sw,/e\.request\.method!=='GET'/);
});
test('Hub retains accessible composer and in-app instrument navigation',()=>{
 const html=read('index.html');
 assert.match(html,/<textarea[^>]*id="deployBrief"/);
 assert.match(html,/<button[^>]*id="deploySend"/);
 assert.match(html,/<iframe[^>]*id="instrument"/);
 assert.match(html,/aria-label="Instrument navigation"/);
 assert.match(html,/\/tools\/catalogue\.json/);
});
test('no automatic claim of verified audio/device QA in quality gates',()=>{
 const doc=read('PARASITE_V3_QUALITY_GATES.md');
 assert.match(doc,/NOT 9\/10/);
 assert.match(doc,/real.device|Real device/i);
});
