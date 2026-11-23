'use strict';
/* Parasite V2 shell — shared by every existing and future instrument.
   Invoke after a module's document has loaded. Does NOT modify audio processing.
*/
(()=>{
const SPECTRUM=Object.freeze({green:'#c6ff91',amber:'#f6d18b',cyan:'#85e4f9',violet:'#c4a8f7'});
const map={
 orbit:{name:'orbit',tagline:'STRING ENGINE',motif:'orbital'},
 slice:{name:'slice',tagline:'SAMPLE MACHINE',motif:'pads'},
 bounce:{name:'bounce',tagline:'KINETIC MACHINE',motif:'physics'},
 relay:{name:'relay',tagline:'SIGNAL MACHINE',motif:'signals'}
};
function detect(url){
 const s=String(url||'').toLowerCase();
 return Object.keys(map).find(k=>s.includes('/'+k+'/')||(k==='slice'&&s.includes('/slice-dual/')))||'custom';
}
function apply(doc,type){
 if(!doc?.head||!doc.body)return false;
 const unit=map[type]||{name:type||'instrument',tagline:'PARASITE INSTRUMENT LABORATORY',motif:'custom'};
 doc.body.classList.add('parasite-v2-module');
 doc.body.dataset.p2Module=type;
 doc.documentElement.style.setProperty('--p2-accent',SPECTRUM.green);
 Object.entries(SPECTRUM).forEach(([k,v])=>doc.documentElement.style.setProperty('--p2-'+k,v));
 doc.documentElement.style.setProperty('color-scheme','dark');
 if(!doc.querySelector('link[data-parasite-v2]')){
  const link=doc.createElement('link');link.rel='stylesheet';link.href='/parasite-v2.css';link.dataset.parasiteV2='nocturne-2';doc.head.append(link);
 }
 if(!doc.querySelector('meta[name="theme-color"]')){
  const meta=doc.createElement('meta');meta.name='theme-color';meta.content='#060c0b';doc.head.append(meta);
 }
 // A small, passive brand seal; no covering playable controls.
 const old=doc.querySelector('#p2-brand-seal');if(old)old.remove();
 const seal=doc.createElement('div');seal.id='p2-brand-seal';seal.setAttribute('aria-hidden','true');
 seal.style.cssText='position:fixed;right:max(8px,env(safe-area-inset-right));bottom:max(6px,env(safe-area-inset-bottom));z-index:1000;pointer-events:none;font:700 9px -apple-system,sans-serif;letter-spacing:1.3px;color:'+SPECTRUM.green+';opacity:.66;text-shadow:0 1px 12px #000;max-width:180px;text-align:right';
 seal.textContent='PARASITE / '+unit.name.toUpperCase()+' · V2';
 doc.body.append(seal);
 return true;
}
function injectFrame(iframe,type){
 try{
  const d=iframe.contentDocument;if(!d)return false;
  return apply(d,type||detect(iframe.getAttribute('src')));
 }catch(e){return false}
}
function spec(){return Object.freeze({...map})}
window.ParasiteV2=Object.freeze({version:'2.1.0',palette:SPECTRUM,apply,injectFrame,detect,spec});
})();
