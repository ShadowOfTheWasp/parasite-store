'use strict';
/* Parasite V2 layout adapter for EXISTING Kindle Bounce/Relay documents.
 * Makes one performance screen; secondary existing controls are moved
 * (not cloned) into accessible <details> to preserve event listeners.
 */
(()=>{
if(window.__parasiteModuleLayout)return;window.__parasiteModuleLayout=true;
const d=document,mode=d.body?.dataset?.p2Module||'';
if(!['bounce','relay'].includes(mode))return;
function adapt(){
 const main=d.querySelector('main');if(!main||main.dataset.p2Adapted)return;
 const children=[...main.children].filter(n=>n.tagName!=='SCRIPT'&&n.id!=='p2-toolbar');
 const lead=mode==='bounce'?(main.querySelector(':scope > .room')||main.querySelector('.room')||main.querySelector('canvas')?.parentElement):(main.querySelector(':scope > .surface')||main.querySelector('.surface')||main.querySelector('.voice')||main.querySelector('.compose'))
 if(!lead)return;
 const surface=lead.closest('.room,.surface')||lead;
 if(surface.parentElement!==main)return;
 main.dataset.p2Adapted='true';
 const intro=surface.previousElementSibling;
 const panel=d.createElement('details');panel.className='p2-advanced';panel.id='p2-more-controls';
 const summary=d.createElement('summary');summary.textContent=mode==='bounce'?'SOUND / BALLS / PHYSICS':'SIGNAL ROUTING / HARDWARE / HISTORY';
 panel.append(summary);
 // Keep a live-performance area visible; move all sibling controls
 // after that area into the collapsible sound-programming drawer.
 const index=[...main.children].indexOf(surface);
 const extras=[...main.children].slice(index+1).filter(el=>el!==panel&&el.id!=='p2-toolbar'&&el.tagName!=='SCRIPT'&&!el.hasAttribute('data-p2-keep'));
 for(const el of extras)panel.append(el);
 if(extras.length)main.append(panel);
 // When the drawer is opened or closed, the instrument retains all
 // original DOM nodes, event handlers, values and audio graph.
}
if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',adapt,{once:true});else adapt();
})();
