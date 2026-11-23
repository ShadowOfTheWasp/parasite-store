'use strict';
/* Run from repository root: node ipad-kindle-parity/tests/catalogue-contract.test.cjs */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const catalogue=JSON.parse(read('tools/catalogue.json'));
const pattern=/^\/tools\/([a-z0-9-]+)\/v(\d+)\.(\d+)\.(\d+)\/index\.html$/;
function validate(data){
 assert.equal(data.version,1,'catalogue schema version');
 assert.ok(Array.isArray(data.tools)&&data.tools.length,'nonempty catalogue');
 const ids=new Set(),urls=new Set();
 for(const item of data.tools){
  assert.match(item.id,/^[a-z0-9-]+$/);
  assert.ok(typeof item.title==='string'&&item.title.trim());
  assert.match(item.version,/^\d+\.\d+\.\d+$/);
  assert.ok(pattern.test(item.url),'same-origin versioned URL');
  const m=item.url.match(pattern);
  assert.equal(m[1],item.id,'URL slug matches id');
  assert.equal(m.slice(2).join('.'),item.version,'URL version matches metadata');
  assert.ok(!ids.has(item.id),'unique id');assert.ok(!urls.has(item.url),'unique URL');
  ids.add(item.id);urls.add(item.url);
  const relative=item.url.slice(1);
  assert.ok(fs.statSync(path.join(root,relative)).isFile(),'tool page exists: '+relative);
 }
 return true;
}
validate(catalogue);
const sw=read('sw.js'),hub=read('index.html');
assert.ok(sw.includes('refreshCatalogue(cache)'),'service worker refreshes catalogue');
assert.ok(sw.includes('cataloguePaths('),'service worker validates paths');
assert.ok(hub.includes('/tools/catalogue.json'),'hub fetches catalogue');
assert.ok(hub.includes('iframe'),'hub embeds tools');
const invalids=[
 {...catalogue,tools:[...catalogue.tools,catalogue.tools[0]]},
 {...catalogue,tools:[{...catalogue.tools[0],url:'https://evil.example/tool'}]},
 {...catalogue,tools:[{...catalogue.tools[0],version:'9.9.9'}]},
 {...catalogue,tools:[{...catalogue.tools[0],id:'../bad'}]}
];
for(const value of invalids)assert.throws(()=>validate(value));
console.log('PASS: catalogue schema, '+catalogue.tools.length+' versioned local pages, hub/service-worker integration, four negative cases');
