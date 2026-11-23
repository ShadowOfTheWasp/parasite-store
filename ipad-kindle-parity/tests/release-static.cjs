'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const catalogue=JSON.parse(read('tools/catalogue.json'));
const html=read('index.html'),sw=read('sw.js');
let passed=0;function test(name,fn){fn();console.log('PASS '+name);passed++}
function inlineScripts(source){return [...source.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).filter(s=>s.trim())}
test('Hub inline JavaScript parses',()=>{const scripts=inlineScripts(html);assert(scripts.length>0);scripts.forEach(s=>new vm.Script(s))});
test('Service worker JavaScript parses',()=>new vm.Script(sw));
test('Catalogue schema and safe versioned paths',()=>{assert.equal(catalogue.version,1);assert(catalogue.tools.length>=3);const ids=new Set(),urls=new Set();for(const t of catalogue.tools){assert.match(t.id,/^[a-z0-9-]+$/);assert.match(t.url,/^\/tools\/[a-z0-9-]+\/v\d+\.\d+\.\d+\/index\.html$/);assert(!ids.has(t.id));assert(!urls.has(t.url));ids.add(t.id);urls.add(t.url);assert.equal(typeof t.title,'string');assert(t.title.trim());assert(fs.statSync(path.join(root,t.url.slice(1))).size>100)}});
test('Every catalogue instrument script parses',()=>{for(const t of catalogue.tools){const source=read(t.url.slice(1));assert.match(source,/<html/i);for(const script of inlineScripts(source))new vm.Script(script)}});
test('All published tools precached for offline use',()=>{for(const t of catalogue.tools)assert(sw.includes(JSON.stringify(t.url)),t.url);assert(sw.includes('refreshCatalogue(cache)'))});
test('Hub opens tools internally without manual pinning',()=>{assert(html.includes('openTool(tool.url,tool.title)'));assert(html.includes("fetch('/tools/catalogue.json'"));assert(!html.includes('data-pinned-tool='))});
test('Authenticated API excluded from service worker caching',()=>{assert(sw.includes("u.pathname.startsWith('/api/')"))});
test('No secrets in public catalogue',()=>{const text=JSON.stringify(catalogue);assert(!/sk-[A-Za-z0-9_-]{20,}|sb_secret_[A-Za-z0-9_-]{12,}|ghp_[A-Za-z0-9]{20,}/.test(text))});
console.log('PASSED '+passed+' static checks. Browser, audio, API and real-device validation are NOT covered.');
