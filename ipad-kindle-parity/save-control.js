'use strict';
/* PARASITE V2 — one SAVE control, not eight preset slots.
 * Local persistence only. Keep underlying DSP engines completely intact.
 * Existing ParasitePresetBridge hooks persist imported audio and sequencing.
 */
(()=>{
if(window.__parasiteSaveControl)return;window.__parasiteSaveControl=true;
const doc=document;
const moduleId=(window.ParasitePresetBridge?.id||location.pathname.split('/').filter(Boolean).slice(0,2).join('-')||'instrument').replace(/[^\w-]/g,'-');
const storeKey='parasite-v2-saved-'+moduleId;
window.ParasitePresetBank=Object.freeze({getSelected:()=>1});
let working=false;
function capture(){
 const patch={};
 for(const e of doc.querySelectorAll('input[id],select[id],textarea[id]')){
  if(e.closest('#p2-toolbar')||['file','button','submit','password','hidden'].includes(e.type)||e.disabled)continue;
  patch[e.id]=e.type==='checkbox'?!!e.checked:e.value;
 }
 return patch;
}
function applyValues(data){
 for(const [id,val] of Object.entries(data)){
  if(id.startsWith('_'))continue;
  const el=doc.getElementById(id);
  if(!el||el.disabled||['file','password','hidden'].includes(el.type))continue;
  if(el.type==='checkbox')el.checked=!!val;
  else el.value=String(val);
  el.dispatchEvent(new Event('input',{bubbles:true}));
  el.dispatchEvent(new Event('change',{bubbles:true}));
 }
}
function message(text){const t=doc.querySelector('#p2-save-state');if(t)t.textContent=text}
async function save(){
 if(working)return;working=true;
 const button=doc.querySelector('#p2-save');if(button)button.disabled=true;message('SAVING');
 try{
  const patch=capture();
  if(window.ParasitePresetBridge?.beforeSave)await window.ParasitePresetBridge.beforeSave(patch,1);
  localStorage.setItem(storeKey,JSON.stringify({version:2,savedAt:new Date().toISOString(),values:patch}));
  message('SAVED ON THIS DEVICE');
 }catch(e){message('SAVE FAILED');console.error('Parasite save failed',e)}
 finally{working=false;if(button)button.disabled=false}
}
async function restore(){
 try{
  const raw=localStorage.getItem(storeKey);if(!raw)return;
  const saved=JSON.parse(raw);
  if(!saved?.values)return;
  if(window.ParasitePresetBridge?.beforeLoad)await window.ParasitePresetBridge.beforeLoad(saved.values);
  applyValues(saved.values);
  if(window.ParasitePresetBridge?.afterLoad)await window.ParasitePresetBridge.afterLoad(saved.values);
  message('SAVED SOUND RESTORED');
 }catch(e){message('RESTORE UNAVAILABLE');console.error('Parasite restore failed',e)}
}
function install(){
 if(doc.querySelector('#p2-toolbar'))return;
 const unit=doc.body?.dataset?.p2Module||location.pathname.split('/').filter(Boolean)[0]||'instrument';
 const primary=doc.querySelector('main.app > header')||doc.querySelector('main > header');
 const bar=doc.createElement('div');bar.id='p2-toolbar';bar.setAttribute('role','group');bar.setAttribute('aria-label','Parasite module controls');
 const title=doc.createElement('div');title.className='p2-toolbar-title';
 title.innerHTML='<small>PARASITE / NOCTURNE V2</small><strong></strong>';
 title.querySelector('strong').textContent=unit==='slice-dual'?'SLICE':unit.toUpperCase();
 const actions=doc.createElement('div');actions.className='p2-toolbar-actions';
 const status=doc.createElement('span');status.id='p2-save-state';status.textContent='READY';status.setAttribute('role','status');
 const button=doc.createElement('button');button.id='p2-save';button.type='button';button.textContent='SAVE';button.setAttribute('aria-label','Save instrument settings on this device');button.addEventListener('click',save);
 actions.append(status,button);bar.append(title,actions);
 if(primary&&unit!=='slice-dual'){primary.classList.add('p2-original-header');primary.parentElement?.insertBefore(bar,primary)}
 else if(primary&&doc.querySelector('main.app')){primary.append(actions);bar.style.display='none'}
 else {const main=doc.querySelector('main');if(main)main.prepend(bar);else doc.body.prepend(bar)}
 if(doc.body){doc.body.classList.add('p2-unified');doc.body.dataset.p2Module=unit}
 void restore();
}
if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
