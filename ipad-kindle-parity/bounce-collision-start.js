'use strict';
/* Bounce V2 — choose ROOM COLLISIONS as the INITIAL mode, never autoplay.
   Do not override a subsequent choice made by the player. This adapter keeps
   the original physics/audio engine and its listeners intact. */
(()=>{
if(window.__parasiteBounceCollisionBoot)return;
window.__parasiteBounceCollisionBoot=true;
const d=document;
const norm=s=>String(s||'').trim().replace(/\s+/g,' ').toLowerCase();
const isCollision=s=>/\b(room\s*collision|wall\s*collision|collisions?|physics|bounce\s*room)\b/i.test(s);
const isArp=s=>/\b(arp|arpeggio|arpeggiator)\b/i.test(s);
let done=false,attempts=0,observer=null;
const finish=el=>{
 if(!el)return false;
 done=true;el.dataset.p2BootMode='room-collision';
 d.body?.setAttribute('data-bounce-start-mode','room-collisions');
 observer?.disconnect();
 return true;
};
function selectOption(){
 for(const select of d.querySelectorAll('select')){
  const options=[...select.options];
  const collisions=options.filter(o=>isCollision(o.label+' '+o.textContent+' '+o.value));
  const arps=options.filter(o=>isArp(o.label+' '+o.textContent+' '+o.value));
  if(!collisions.length||!arps.length)continue;
  const chosen=collisions.find(o=>/room|wall/i.test(o.textContent+' '+o.value))||collisions[0];
  if(select.value!==chosen.value){
   select.value=chosen.value;
   select.dispatchEvent(new Event('input',{bubbles:true}));
   select.dispatchEvent(new Event('change',{bubbles:true}));
  }
  return finish(select);
 }
 return false;
}
function selectRadio(){
 const groups=new Map();
 for(const input of d.querySelectorAll('input[type="radio"]')){
  if(!input.name)continue;
  const group=groups.get(input.name)||[];
  group.push(input);groups.set(input.name,group);
 }
 for(const list of groups.values()){
  const title=x=>[x.value,x.id,d.querySelector('label[for="'+CSS.escape(x.id)+'"]')?.textContent,x.closest('label')?.textContent].join(' ');
  const collision=list.find(x=>isCollision(title(x)));
  if(!collision||!list.some(x=>isArp(title(x))))continue;
  if(!collision.checked){collision.checked=true;collision.dispatchEvent(new Event('input',{bubbles:true}));collision.dispatchEvent(new Event('change',{bubbles:true}))}
  return finish(collision);
 }
 return false;
}
function selectButton(){
 const buttons=[...d.querySelectorAll('button,[role="button"]')];
 const collisions=buttons.filter(b=>isCollision([b.textContent,b.getAttribute('aria-label'),b.title,b.dataset.mode].join(' ')));
 const arps=buttons.filter(b=>isArp([b.textContent,b.getAttribute('aria-label'),b.title,b.dataset.mode].join(' ')));
 if(!collisions.length||!arps.length)return false;
 const chosen=collisions.find(b=>/room|wall/i.test(b.textContent+' '+b.dataset.mode))||collisions[0];
 if(chosen.disabled)return false;
 if(chosen.getAttribute('aria-pressed')!=='true'&&!chosen.classList.contains('active')&&!chosen.classList.contains('on'))chosen.click();
 return finish(chosen);
}
function boot(){
 if(done)return;
 attempts++;
 if(selectOption()||selectRadio()||selectButton())return;
 if(attempts>=14){observer?.disconnect();d.body?.setAttribute('data-bounce-mode-check','not-found')}
}
function start(){
 boot();
 if(done)return;
 observer=new MutationObserver(boot);
 observer.observe(d.documentElement,{childList:true,subtree:true});
 let count=0;
 const timer=setInterval(()=>{boot();if(done||++count>=14){clearInterval(timer);observer?.disconnect()}},250);
}
if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
