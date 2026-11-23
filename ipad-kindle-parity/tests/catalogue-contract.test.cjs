'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const toolPattern=/^\/tools\/([a-z0-9-]+)\/v(\d+\.\d+\.\d+)\/index\.html$/;
function validate(c){
 assert.equal(c.version,1,'supported catalogue schema');
 assert.ok(Array.isArray(c.tools),'tools must be array');
 const ids=new Set(),urls=new Set();
 for(const t of c.tools){
  assert.match(t.id,/^[a-z0-9-]+$/);
  assert.ok(typeof t.title==='string'&&t.title.trim());
  assert.ok(typeof t.description==='string'&&t.description.trim());
  assert.match(t.version,/^\d+\.\d+\.\d+$/);
  const match=toolPattern.exec(t.url);
  assert.ok(match,'same-origin versioned tool URL');
  assert.equal(match[1],t.id,'URL ID matches ID');
  assert.equal(match[2],t.version,'URL version matches version');
  assert.ok(!ids.has(t.id),'unique tool ID');
  assert.ok(!urls.has(t.url),'unique tool URL');
  ids.add(t.id);urls.add(t.url);
 }
 return c.tools;
}
const catalogue=JSON.parse(fs.readFileSync(path.join(root,'tools/catalogue.json'),'utf8'));
test('catalogue has valid metadata and versioned URLs',()=>validate(catalogue));
test('all catalogue pages exist',()=>{for(const t of validate(catalogue))assert.ok(fs.existsSync(path.join(root,t.url.slice(1))),t.url)});
test('offline service worker caches all released tool pages',()=>{const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');for(const t of validate(catalogue))assert.ok(sw.includes(t.url),'missing offline path '+t.url)});
test('reject duplicate ID',()=>assert.throws(()=>validate({...catalogue,tools:[catalogue.tools[0],{...catalogue.tools[0],url:'/tools/another/v1.0.0/index.html'}]})));
test('reject external URL',()=>assert.throws(()=>validate({...catalogue,tools:[{...catalogue.tools[0],url:'https://evil.invalid/index.html'}]})));
test('reject mismatched version',()=>assert.throws(()=>validate({...catalogue,tools:[{...catalogue.tools[0],version:'9.9.9'}]})));
test('reject unsupported schema',()=>assert.throws(()=>validate({...catalogue,version:2})));
