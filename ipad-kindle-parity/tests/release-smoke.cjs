#!/usr/bin/env node
// Parasite V3 deterministic release smoke checks; no network or secrets.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const html=read('index.html'),sw=read('sw.js'),catalogue=JSON.parse(read('tools/catalogue.json'));
const failures=[];let passed=0;
function check(name,fn){try{fn();passed++;console.log('PASS '+name)}catch(e){failures.push(name+': '+e.message);console.error('FAIL '+name+': '+e.message)}}
function inlineJS(source){const scripts=[...source.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).filter(Boolean);assert.ok(scripts.length,'missing inline JS');return scripts}
check('Hub inline JS parses',()=>inlineJS(html).forEach(s=>new vm.Script(s)));
check('Service worker parses',()=>new vm.Script(sw));
check('Catalogue schema and unique versioned paths',()=>{
 assert.equal(catalogue.version,1);assert.ok(Array.isArray(catalogue.tools)&&catalogue.tools.length>0);
 const ids=new Set(),urls=new Set();
 for(const t of catalogue.tools){
  assert.match(t.id,/^[a-z0-9-]+$/);assert.ok(!ids.has(t.id),'duplicate id '+t.id);ids.add(t.id);
  assert.match(t.url,/^\/tools\/[a-z0-9-]+\/v\d+\.\d+\.\d+\/index\.html$/);
  assert.ok(!urls.has(t.url),'duplicate url '+t.url);urls.add(t.url);
  assert.ok(t.title&&t.description&&t.version,'missing metadata');
  const src=read(t.url.slice(1));assert.match(src,/<html\b/i);
  inlineJS(src).forEach(s=>new vm.Script(s));
 }
});
check('Hub uses published catalogue and internal tool launch',()=>{
 assert.match(html,/fetch\(['"]\/tools\/catalogue\.json['"]/);
 assert.match(html,/function openTool\(/);
 assert.match(html,/openTool\(tool\.url,tool\.title\)/);
 assert.match(html,/<iframe[^>]*id="instrument"/);
});
check('Offline cache contains catalogue and all published tools',()=>{
 assert.match(sw,/tools\/catalogue\.json/);
 for(const t of catalogue.tools)assert.ok(sw.includes(t.url),'missing offline asset '+t.url);
});
check('Service worker enforces catalogue integrity',()=>{
 assert.match(sw,/catalogue\.json/);
 assert.match(sw,/cache\.put|put\(/);
});
check('No client-side hardcoded API credentials',()=>{
 assert.doesNotMatch(html,/SUPABASE_SERVICE_ROLE_KEY\s*[:=]\s*['"][^'"]+/i);
 assert.doesNotMatch(html,/sk_(?:live|test)_[A-Za-z0-9]{16,}/);
});
console.log(JSON.stringify({passed,failed:failures.length,failures},null,2));
if(failures.length)process.exitCode=1;
