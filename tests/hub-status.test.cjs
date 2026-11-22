process.chdir(require('node:path').resolve(__dirname,'..'));
const {JSDOM}=require('jsdom');
const assert=require('node:assert/strict'),fs=require('node:fs');
const {state}=require('../docs/kindle-hub/build-status.js');
assert.match(state({status:'in_progress'}),/not yet verified/);
assert.match(state({status:'completed',conclusion:'failure'}),/no release confirmed/);
assert.match(state({status:'completed',conclusion:'success'}),/succeeded/);
const tick=()=>new Promise(r=>setTimeout(r,10));
const row=(id,state,url)=>({id,state,brief:'Synthetic local test instrument',created_at:'2026-11-22T12:00:00Z',updated_at:'2026-11-22T13:00:00Z',release_url:url});
(async()=>{
 // Authenticated remote: private-link sign-in, private queue summary, no unsolicited submissions.
 let rows=[row('a','queued'),row('b','building'),row('c','blocked'),row('d','deployed','https://parasite-kindle.vercel.app/orbit/v4.0.0/')];
 const dom=new JSDOM(fs.readFileSync('creator/index.html','utf8'),{url:'https://parasite-creator.vercel.app/#connect=LOCAL-TEST-NOT-A-CREDENTIAL',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window,requests=[],timers=[];
 w.setInterval=(f,t)=>{timers.push({f,t});return 1;};
 w.fetch=async(url,options)=>{requests.push(options?.body&&JSON.parse(options.body));return {ok:true,json:async()=>options?.method==='POST'?{ok:true}:{requests:rows}};};
 w.eval(fs.readFileSync('creator/app.js','utf8'));await tick();
 assert.equal(w.location.hash,'');assert.equal(requests[0].action,'unlock');
 assert.equal(w.document.getElementById('workspace').hidden,false);
 assert.match(w.document.getElementById('build-summary').textContent,/1 building · 1 queued · 1 need attention/);
 assert.equal(w.document.getElementById('code'),null);assert.equal(timers[0].t,300000);
 w.document.querySelectorAll('#history button')[3].click();assert.equal(w.document.querySelector('#conversation a').href,rows[3].release_url);
 rows[3].release_url='https://evil.example/x';w.document.getElementById('refresh').click();await tick();assert.equal(w.document.querySelector('#conversation a'),null);
 w.document.getElementById('lock').click();await tick();assert.equal(w.document.getElementById('workspace').hidden,true);assert.equal(w.document.getElementById('build-summary').textContent,'');
 assert(!requests.some(x=>x?.action==='submit'));
 dom.window.close();
 // Public hub: polling updates catalogue mappings but never reloads a playing frame.
 const hub=new JSDOM(fs.readFileSync('docs/kindle-hub/index.html','utf8'),{url:'https://parasite-kindle.vercel.app/',runScripts:'outside-only',pretendToBeVisual:true});
 const h=hub.window,intervals=[];h.AbortController=AbortController;h.scrollTo=()=>{};
 h.setInterval=(f,t)=>{intervals.push({f,t});return 1;};
 let failure=false;
 h.fetch=async url=>{if(failure)throw Error('offline');return {ok:true,json:async()=>url.includes('catalogue')?{units:[{package:'studio.parasite.orbit4',title:'Orbit',version:'4.0.0',playUrl:'https://parasite-kindle.vercel.app/orbit/v4.0.0/'}]}:url.includes('release.json')?{versionName:'9.0.0'}:{workflow_runs:[{status:'completed',conclusion:'success'}]}};};
 const inline=h.document.querySelector('script:not([src])').textContent;h.eval(inline);h.eval(fs.readFileSync('docs/kindle-hub/build-status.js','utf8'));await tick();
 assert.equal(intervals[0].t,300000);assert.match(h.document.getElementById('release-state').textContent,/Orbit 4.0.0/);
 h.document.querySelector('[data-unit=orbit]').click();const frame=h.document.getElementById('instrument');const current=frame.src;
 intervals[0].f();await tick();assert.equal(frame.src,current);assert.equal(h.document.getElementById('player').className,'active');
 failure=true;intervals[0].f();await tick();assert.match(h.document.getElementById('release-state').textContent,/unavailable/);assert.match(h.document.getElementById('pipeline-state').textContent,/unknown/);assert.equal(frame.src,current);
 h.close();console.log('PASS: private-link auth, redacted lock, queue summary, trusted releases, 5-minute polling, failure states and uninterrupted instrument frame');
})().catch(e=>{console.error(e);process.exit(1)});
