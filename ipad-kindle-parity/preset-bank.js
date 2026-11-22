'use strict';
/* Parasite universal eight-slot preset bank.
   Reuse as /preset-bank.js in all future instruments.
   User-created patches require an explicit SAVE gesture; no automatic overwriting.
*/
(()=>{
 if(window.__parasitePresetBank)return;window.__parasitePresetBank=true;
 const doc=document;
 const moduleId=(window.ParasitePresetBridge?.id||location.pathname.split('/').filter(Boolean).slice(0,2).join('-')||'instrument').replace(/[^a-z0-9_-]/gi,'-');
 const key='parasite-v1-presets-'+moduleId;
 const defaults=window.ParasitePresetBridge?.factory||null;
 let slots={};try{slots=JSON.parse(localStorage.getItem(key)||'{}')||{}}catch(e){}
 const defaultForm=()=>{const config={};for(const node of doc.querySelectorAll('input[id],select[id],textarea[id]')){if(node.closest('#parasite-preset-bank')||node.type==='file'||node.type==='button'||node.type==='submit')continue;config[node.id]=node.type==='checkbox'?node.checked:node.value}return config};
 let factory=defaults||defaultForm();
 if(!slots[1])slots[1]={form:factory,kind:'factory',label:window.ParasitePresetBridge?.factoryName||'Factory patch'};
 let selected=1;
 const css=doc.createElement('style');
 css.textContent=`#parasite-preset-bank{position:fixed;z-index:2147483644;right:max(8px,env(safe-area-inset-right));top:max(7px,env(safe-area-inset-top));color:#e6f7e0;font:11px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;pointer-events:none}
 #parasite-preset-bank *{box-sizing:border-box}
 #parasite-preset-bank button{touch-action:manipulation;pointer-events:auto;cursor:pointer;font:inherit}
 #parasite-preset-bank button:focus-visible{outline:2px solid #caff8c;outline-offset:2px}
 #parasite-preset-bank .toggle{display:block;margin-left:auto;padding:11px 15px;border-radius:12px;background:#122719ec;color:#caffab;border:1px solid #63925c;box-shadow:0 2px 22px #000a;font-weight:800}
 #parasite-preset-bank .panel{pointer-events:auto;display:none;margin-top:7px;max-width:min(96vw,510px);padding:13px 14px;border:1px solid #588357;border-radius:16px;background:#0a1a10f6;box-shadow:0 12px 35px #000b;backdrop-filter:blur(15px)}
 #parasite-preset-bank.open .panel{display:block}
 #parasite-preset-bank .title{font-size:11px;color:#baff89;letter-spacing:1.5px;margin:0 0 9px;font-weight:800}
 #parasite-preset-bank .slots{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:5px}
 #parasite-preset-bank .slot{min-width:0;padding:12px 6px;background:#223927;color:#bdd9ba;border:1px solid #456749;border-radius:9px;font-size:14px;font-weight:700}
 #parasite-preset-bank .slot.selected{background:#b8ff86;color:#102518;border-color:#b8ff86}
 #parasite-preset-bank .slot.empty{border-style:dashed;color:#8eae8d}
 #parasite-preset-bank .foot{display:flex;gap:8px;align-items:center;justify-content:space-between;margin-top:11px;flex-wrap:wrap}
 #parasite-preset-bank .foot button{padding:9px 12px;background:#2c4931;border:1px solid #63845c;border-radius:9px;color:#efffe2;font-weight:750}
 #parasite-preset-bank .msg{font-size:11px;color:#afc6ae;flex:1;min-width:140px;line-height:1.45}
 #parasite-preset-bank.inline{position:static;inset:auto;pointer-events:auto;min-width:0;flex:none;display:flex;align-items:center}#parasite-preset-bank.inline .toggle{display:none}#parasite-preset-bank.inline .panel{display:flex;margin:0;padding:3px 4px;border-radius:9px;align-items:center;gap:5px;box-shadow:none;background:#14271b;border-color:#527352;max-width:none}#parasite-preset-bank.inline .title,#parasite-preset-bank.inline .msg{display:none}#parasite-preset-bank.inline .slots{grid-template-columns:repeat(8,minmax(21px,1fr));gap:3px}#parasite-preset-bank.inline .slot{padding:8px 3px;font-size:12px;min-width:21px}#parasite-preset-bank.inline .foot{margin:0;flex:none}#parasite-preset-bank.inline .foot button{padding:7px;font-size:9px;white-space:nowrap} @media(max-width:600px){#parasite-preset-bank{top:auto;bottom:max(8px,env(safe-area-inset-bottom))}#parasite-preset-bank.inline .slots{gap:2px;grid-template-columns:repeat(8,minmax(17px,1fr))}#parasite-preset-bank.inline .slot{min-width:17px;padding:5px 2px}#parasite-preset-bank.inline .panel{gap:2px}#parasite-preset-bank.inline .foot button{padding:6px 3px;font-size:8px}#parasite-preset-bank .slots{gap:3px}#parasite-preset-bank .slot{padding:10px 2px}}
 `;doc.head.append(css);
 const root=doc.createElement('div');root.id='parasite-preset-bank';
 root.innerHTML='<button class="toggle" type="button" aria-expanded="false">PRESETS · 1–8</button><div class="panel"><div class="title">PARASITE · EIGHT USER PRESETS</div><div class="slots" role="group" aria-label="Eight instrument presets"></div><div class="foot"><span class="msg" role="status">1 · Factory patch</span><button type="button" class="save">SAVE TO SLOT</button></div></div>';
 const host=doc.querySelector('main.app > header');
 if(host){root.classList.add('inline');host.append(root);}
 else doc.body.append(root);
 root.classList.add('open');
 const buttons=[],msg=root.querySelector('.msg'),toggle=root.querySelector('.toggle');
 function refresh(){buttons.forEach((b,i)=>{const slot=i+1;b.classList.toggle('selected',slot===selected);b.classList.toggle('empty',!slots[slot]);b.setAttribute('aria-pressed',String(slot===selected));b.title=slots[slot]?(slots[slot].label||'Saved preset'):'Empty preset'})}
 async function apply(form){
  if(!form)return;
  const bridge=window.ParasitePresetBridge;
  if(bridge?.beforeLoad)await bridge.beforeLoad(form);
  for(const [id,v] of Object.entries(form)){const node=doc.getElementById(id);
   if(!node||node.type==='file')continue;
   if(node.type==='checkbox')node.checked=!!v;else node.value=String(v);
   node.dispatchEvent(new Event('input',{bubbles:true}));
   node.dispatchEvent(new Event('change',{bubbles:true}));
  }
  if(bridge?.afterLoad)await bridge.afterLoad(form);
 }
 async function select(n){selected=n;refresh();const entry=slots[n];if(!entry){msg.textContent=n+' · Empty — change settings and tap SAVE TO SLOT';return}
  try{await apply(entry.form);msg.textContent=n+' · '+(entry.label||'Patch loaded')}
  catch(e){msg.textContent='Preset load issue: '+(e?.message||e)}
 }
 root.querySelector('.slots').replaceChildren();
 for(let i=1;i<=8;i++){const b=doc.createElement('button');b.className='slot';b.type='button';b.textContent=String(i);b.setAttribute('aria-label','Load preset '+i);b.onclick=()=>select(i);root.querySelector('.slots').append(b);buttons.push(b)}
 root.querySelector('.save').onclick=async()=>{
  try{const form=defaultForm();
   if(window.ParasitePresetBridge?.beforeSave)await window.ParasitePresetBridge.beforeSave(form,selected);
   slots[selected]={form,label:selected===1?(window.ParasitePresetBridge?.factoryName||'Custom patch'):'User preset '+selected,kind:'user'};
   localStorage.setItem(key,JSON.stringify(slots));refresh();msg.textContent='Saved to slot '+selected+' on this device';
  }catch(e){msg.textContent='Could not save: '+(e?.message||e)}
 };
 toggle.onclick=()=>{const opened=root.classList.toggle('open');toggle.setAttribute('aria-expanded',String(opened))};
 refresh();window.ParasitePresetBank={getSelected:()=>selected,load:select,slots:()=>slots};
})();
