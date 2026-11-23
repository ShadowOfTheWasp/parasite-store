'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),catalogue=JSON.parse(fs.readFileSync(path.join(root,'tools/catalogue.json'),'utf8'));
const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
const hub=fs.readFileSync(path.join(root,'index.html'),'utf8');
function validate(c){assert.equal(c.version,1);assert.ok(Array.isArray(c.tools)&&c.tools.length>0);const ids=new Set(),urls=new Set();for(const t of c.tools){assert.match(t.id,/^[a-z0-9-]+$/);assert.ok(!ids.has(t.id),'duplicate ID');ids.add(t.id);assert.match(t.version,/^\d+\.\d+\.\d+$/);assert.equal(t.url,`/tools/${t.id}/v${t.version}/index.html`);assert.ok(!urls.has(t.url),'duplicate URL');urls.add(t.url);assert.ok(fs.existsSync(path.join(root,t.url.slice(1))),'missing instrument: '+t.url)}return true}
validate(catalogue);
assert.match(sw,/refreshCatalogue/);assert.match(sw,/cataloguePaths/);assert.match(hub,/catalogue\.json/);
const dup=structuredClone(catalogue);dup.tools.push({...dup.tools[0]});assert.throws(()=>validate(dup));
const traversal=structuredClone(catalogue);traversal.tools[0].url='/tools/../../secrets';assert.throws(()=>validate(traversal));
const missing=structuredClone(catalogue);missing.tools[0].url='/tools/absent/v1.0.0/index.html';missing.tools[0].id='absent';assert.throws(()=>validate(missing));
const bad=structuredClone(catalogue);bad.version=2;assert.throws(()=>validate(bad));
console.log('PASS: production catalogue contract + 4 negative fixtures (source-level, not browser/device QA)');
