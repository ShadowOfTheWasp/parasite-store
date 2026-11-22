'use strict';
/* Parasite Tron touch keyboard adaptation.
   Reflows the ORIGINAL playable keys: no replacement synth or event rerouting.
*/
(()=>{
 if(window.__parasiteTronKeyboard)return;window.__parasiteTronKeyboard=true;
 const doc=document;
 const css=doc.createElement('style');
 css.textContent=`
 html,body{user-select:none!important;-webkit-user-select:none!important;-webkit-touch-callout:none!important;overscroll-behavior:none!important}
 button,[role=button],.key,.white-key,.black-key,.piano-key,[data-note]{user-select:none!important;-webkit-user-select:none!important;-webkit-touch-callout:none!important;touch-action:none!important}
 input,textarea,[contenteditable=true]{user-select:text!important;-webkit-user-select:text!important}
 .parasite-tron-keys{width:calc(100vw - 22px)!important;max-width:calc(100vw - 22px)!important;min-width:0!important;margin-left:calc(50% - 50vw + 11px)!important;margin-right:0!important;overflow:visible!important;touch-action:none!important;user-select:none!important;-webkit-user-select:none!important;display:flex!important;flex-wrap:nowrap!important;align-items:stretch!important;justify-content:stretch!important;position:relative!important;box-sizing:border-box!important}
 .parasite-tron-keys>.parasite-tron-key{min-width:0!important;max-width:none!important;box-sizing:border-box!important;flex-shrink:1!important;white-space:nowrap!important;user-select:none!important;-webkit-user-select:none!important;-webkit-touch-callout:none!important;touch-action:none!important;position:relative!important}
 .parasite-tron-keys .parasite-tron-key{font-size:0!important;text-shadow:none!important;color:transparent!important}
 .parasite-tron-key .parasite-tron-octave-mark{position:absolute!important;bottom:5px!important;left:50%!important;transform:translateX(-50%)!important;z-index:5!important;font:bold 10px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important;color:#203222!important;pointer-events:none!important;background:#dff0d7c9!important;padding:2px 3px!important;border-radius:4px!important;letter-spacing:0!important;text-transform:none!important;line-height:1!important}
 .parasite-tron-keys .parasite-tron-key *:not(.parasite-tron-octave-mark){font-size:0!important;color:transparent!important;text-shadow:none!important;pointer-events:none!important;user-select:none!important;-webkit-user-select:none!important}
 .parasite-tron-keys .parasite-tron-key:active{filter:brightness(1.14)}
 @media(orientation:landscape){.parasite-tron-keys{width:calc(100vw - 16px)!important;max-width:calc(100vw - 16px)!important;margin-left:calc(50% - 50vw + 8px)!important}}
 `;
 doc.head.append(css);
 // Keep the original sound engine and the original attached keyboard event listeners.
 const keySelectors=['.keyboard .key','.keyboard button','.keys .key','.keys button',
 '#keyboard .key','#keyboard button','#keys .key','#keys button',
 '[id*=keyboard] [data-note]','[class*=keyboard] [data-note]',
 '[id*=piano] button','[class*=piano] button',
 '[data-midi]','[data-note]','.white-key','.black-key','.piano-key'];
 function findKeys(){
  const candidates=[];
  for(const selector of keySelectors){
   const nodes=[...doc.querySelectorAll(selector)].filter(n=>n!==doc.body&&n.getBoundingClientRect().width>1);
   if(nodes.length>=12&&nodes.length<=100)candidates.push(nodes);
  }
  if(!candidates.length)return null;
  candidates.sort((a,b)=>b.length-a.length);
  const keys=candidates[0],parent=keys[0]?.parentElement;
  if(!parent)return null;
  const direct=keys.filter(k=>k.parentElement===parent);
  if(direct.length<12)return null;
  return {parent,keys:direct};
 }
 function noteOf(key,index){
  const raw=[key.dataset.note,key.dataset.midi,key.getAttribute('aria-label'),key.getAttribute('title'),key.textContent].filter(v=>v!==undefined&&v!==null).map(x=>String(x).trim());
  for(const value of raw){
   if(/^\d{2,3}$/.test(value)){const midi=Number(value);if(midi>=12&&midi<=119)return {pitch:midi%12,octave:Math.floor(midi/12)-1}}
   const m=value.match(/\b([A-G])(?:#|♯|b|♭)?\s*([1-5])\b/i);
   if(m){return{pitch:'CDEFGAB'.indexOf(m[1].toUpperCase())===0?0:-1,octave:Number(m[2])}}
  }
  return null;
 }
 function adapt(){
  const result=findKeys();if(!result)return false;
  const {parent,keys}=result;parent.classList.add('parasite-tron-keys');
  const visibleRect=parent.getBoundingClientRect();
  if(visibleRect.width<50)return false;
  keys.forEach((key,index)=>{
   key.classList.add('parasite-tron-key');key.style.setProperty('user-select','none','important');
   key.style.setProperty('-webkit-user-select','none','important');
   const prev=key.querySelector('.parasite-tron-octave-mark');if(prev)prev.remove();
   const note=noteOf(key,index);
   if(note&&note.pitch===0&&note.octave>=1&&note.octave<=5){
    const span=doc.createElement('span');span.className='parasite-tron-octave-mark';span.textContent='C'+note.octave;span.setAttribute('aria-hidden','true');key.append(span);
   }
  });
  // If all key labels are missing usable pitch metadata, don't invent octave names.
  const labels=keys.filter(k=>k.querySelector('.parasite-tron-octave-mark')).length;
  if(!labels){console.warn('Parasite Tron: no reliable C octave labels in original keys')}
  parent.dataset.parasiteTronKeyboard='true';
  return true;
 }
 doc.addEventListener('selectstart',e=>{if(e.target.closest('input,textarea,[contenteditable=true]'))return;e.preventDefault()},true);
 function setup(){if(adapt())return;const observer=new MutationObserver(()=>{if(adapt())observer.disconnect()});observer.observe(doc.body,{subtree:true,childList:true});setTimeout(()=>observer.disconnect(),8000)}
 if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',setup,{once:true});else setup();
 window.addEventListener('resize',adapt);
})();
