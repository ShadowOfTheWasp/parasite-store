(function(){
'use strict';
var SITE='https://shadowofthewasp.github.io/parasite-store/';
var API='https://api.github.com/repos/ShadowOfTheWasp/parasite-store/actions/workflows/';
var checking=false,lastSuccess=null;
function state(run){
 if(!run)return 'No build information';
 if(run.status!=='completed')return 'Build '+run.status.replace(/_/g,' ')+' — publication not yet verified';
 return run.conclusion==='success'?'Build and publication succeeded':('Build '+run.conclusion+' — no release confirmed by this run');
}
async function json(url){
 var controller=new AbortController(),timer=setTimeout(function(){controller.abort();},12000);
 try{var response=await fetch(url+(url.includes('?')?'&':'?')+'t='+Date.now(),{cache:'no-store',signal:controller.signal});if(!response.ok)throw Error('HTTP '+response.status);return await response.json();}finally{clearTimeout(timer);}
}
async function refresh(){
 if(checking||document.hidden)return;checking=true;
 var button=document.getElementById('check-build');if(button)button.disabled=true;
 var results=await Promise.allSettled([json(SITE+'catalogue.json'),json(API+'parasite-pages.yml/runs?branch=main&event=push&per_page=1'),json(SITE+'release.json')]);
 var catalogue=results[0],build=results[1],home=results[2];
 var release=document.getElementById('release-state'),pipeline=document.getElementById('pipeline-state');
 if(catalogue.status==='fulfilled'&&Array.isArray(catalogue.value.units)){
  window.parasiteCatalogue=catalogue.value.units;
  release.textContent='Published instruments: '+catalogue.value.units.map(function(u){return u.title+' '+u.version;}).join(' · ');
  lastSuccess=new Date();
 }else release.textContent='Catalogue check unavailable.'+(lastSuccess?' Last successful check '+lastSuccess.toLocaleTimeString()+'.':' Check Wi-Fi and retry.');
 pipeline.textContent=build.status==='fulfilled'?state(build.value.workflow_runs[0]):'Build pipeline unavailable — status unknown.';
 if(home.status==='fulfilled')pipeline.textContent+=' · Home '+(home.value.versionName||home.value.version)+' available';
 document.getElementById('checked-at').textContent='Checked '+new Date().toLocaleTimeString()+' · checks every 5 minutes while open · private request progress in Invent';
 if(button)button.disabled=false;checking=false;
}
if(typeof module==='object'&&module.exports){module.exports={state:state};return;}
document.getElementById('check-build').addEventListener('click',refresh);
document.addEventListener('visibilitychange',function(){if(!document.hidden)refresh();});
window.addEventListener('online',refresh);
setInterval(refresh,300000);refresh();
})();
