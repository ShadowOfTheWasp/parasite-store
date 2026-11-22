'use strict';

const get=id=>document.getElementById(id);
const editor=get('brief');
const submissionKey='parasite-creator-pending';
const selectedKey='parasite-remote-selected';
const labels={queued:'Queued',building:'Building',deployed:'Ready',needs_input:'Needs your input',blocked:'Needs attention'};
const replies={
  queued:'Your request is saved in the build queue. Requests are checked about once an hour. You can close this page and return later.',
  building:'Your instrument is being built and tested. The release link will appear here after publication is verified.',
  deployed:'Your release is ready. Open the verified link below.',
  needs_input:'More detail is needed before this request can continue. Send a follow-up below.',
  blocked:'This request needs attention. You can send a follow-up below.'
};
let items=[],selected=null,busy=false,loaded=false,refreshing=false,sessionGeneration=0,lastHistory='',lastConversation='';

function local(key,value) {
  try{
    if(value===null)return localStorage.removeItem(key);
    if(value!==undefined)return localStorage.setItem(key,value);
    return localStorage.getItem(key);
  }catch{return undefined;}
}
function status(text){get('status').textContent=text;}
function draftKey(){return 'parasite-remote-draft-'+(selected||'new');}
function current(){return items.find(item=>item.id===selected);}
function pendingBuild(){return ['queued','building'].includes(current()?.state);}
function composedBrief(message){
  const request=current();
  if(!request)return message;
  return request.brief+'\n\nOwner follow-up for request '+request.id+
    (request.release_url?'\nPrevious release '+request.release_url:'')+'\n'+message;
}
function updateDraft(){
  local(draftKey(),editor.value);
  const length=composedBrief(editor.value.trim()).length;
  get('count').textContent=length.toLocaleString('en-GB')+' / 4,000';
  get('count').style.color=length>4000?'var(--warn)':'';
  get('submit').disabled=busy||pendingBuild()||length>4000||editor.value.trim().length<10;
}
async function api(body) {
  const response=await fetch('/api/queue',body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{cache:'no-store'});
  const result=await response.json();
  if(!response.ok)throw Object.assign(new Error(result.error||'Request failed.'),{status:response.status});
  return result;
}
function open(value){
  get('setup').hidden=value;
  get('workspace').hidden=!value;
  get('lock').hidden=!value;
}
function releaseLink(raw){
  try{
    let url;try{url=new URL(raw);}catch{throw Object.assign(new Error('Use your private Hub Remote sign-in link.'),{status:400});}
    if(url.protocol==='https:'&&((url.hostname==='shadowofthewasp.github.io'&&url.pathname.startsWith('/parasite-store/'))||url.hostname==='parasite-kindle.vercel.app'))return url.href;
  }catch{}
}
function message(who,text,time){
  const node=document.createElement('article');
  node.className='message '+(who==='You'?'owner':'remote');
  const byline=document.createElement('span');
  byline.className='byline';
  byline.textContent=who+(time?' · '+new Date(time).toLocaleString('en-GB',{dateStyle:'medium',timeStyle:'short'}):'');
  const content=document.createElement('div');content.textContent=text;
  node.append(byline,content);return node;
}
function showConversation(force=false){
  const request=current();
  const signature=JSON.stringify(request||null);
  if(force||signature!==lastConversation){
    lastConversation=signature;
    const root=get('conversation');root.replaceChildren();
    if(!request){
      const welcome=document.createElement('div');welcome.className='welcome';
      const title=document.createElement('h2');title.textContent='What shall we build?';
      const hint=document.createElement('p');hint.textContent='Describe the sound, controls and colours. Send a build request and follow its progress here.';
      const suggestions=document.createElement('div');suggestions.className='suggestions';
      for(const [name,text] of [
        ['A new instrument','Build a new Parasite instrument called '],
        ['Change an instrument','Update the Parasite instrument called '],
        ['A visual idea','Build a visual musical instrument where ']
      ]){
        const button=document.createElement('button');button.type='button';button.textContent=name;
        button.addEventListener('click',()=>{editor.value=text;updateDraft();editor.focus();});
        suggestions.append(button);
      }
      welcome.append(title,hint,suggestions);root.append(welcome);
    }else{
      root.append(message('You',request.brief,request.created_at));
      const response=message('Hub Remote · '+(labels[request.state]||request.state),replies[request.state]||'Status is being checked.',request.updated_at);
      if(request.note){const note=document.createElement('p');note.textContent=request.note;response.append(note);}
      const href=request.state==='deployed'&&releaseLink(request.release_url);
      if(href){const a=document.createElement('a');a.href=href;a.textContent='Open instrument / download ↗';response.append(a);}
      root.append(response);
    }
  }
  get('followup').hidden=!request;
  get('followup-text').textContent=request?'Following up on this instrument':'';
  editor.disabled=pendingBuild();
  editor.placeholder=pendingBuild()?'This build is in progress. Start a new instrument for another idea.':
    request?'Describe what you want to change…':'Describe your next Parasite instrument…';
  updateDraft();
}
function renderHistory(){
  const signature=JSON.stringify(items.map(x=>[x.id,x.brief,x.state,x.updated_at]));
  if(signature===lastHistory)return;
  lastHistory=signature;
  const root=get('history');root.replaceChildren();
  if(!items.length){const p=document.createElement('p');p.textContent='Your requests will appear here.';root.append(p);}
  for(const item of items){
    const button=document.createElement('button');button.type='button';
    const title=document.createElement('span');title.textContent=item.brief.split('\n')[0].slice(0,85);
    const meta=document.createElement('small');meta.textContent=(labels[item.state]||item.state)+' · '+new Date(item.created_at).toLocaleString('en-GB',{dateStyle:'medium',timeStyle:'short'});
    button.append(title,meta);button.addEventListener('click',()=>select(item.id));root.append(button);
  }
}
function select(id){
  local(draftKey(),editor.value);
  selected=id;
  local(selectedKey,id||'');
  editor.value=local(draftKey())||'';
  get('history-panel').hidden=true;get('history-toggle').setAttribute('aria-expanded','false');
  status('');showConversation(true);
  if(!pendingBuild())editor.focus();
}
async function refresh(){
  if(refreshing)return;
  refreshing=true;
  const generation=sessionGeneration;
  try{
    const result=await api();
    if(generation!==sessionGeneration)return;
    items=result.requests;
    loaded=true;open(true);
    if(selected&&!current()){selected=null;editor.value=local(draftKey())||'';}
    renderHistory();showConversation();showBuildSummary();
    status('Last checked '+new Date().toLocaleTimeString()+' · updates every 5 minutes while open');
  }catch(error){
    if(generation!==sessionGeneration)return;
    if(error.status===401){
      loaded=false;items=[];get('build-summary').textContent='';lastHistory='';lastConversation='';
      get('history').replaceChildren();get('conversation').replaceChildren();open(false);
    }else{
      open(loaded);status('Connection unavailable. Your draft is saved on this phone. Try Refresh when online.');
    }
  }finally{refreshing=false;}
}
async function perform(action,button){
  if(busy)return;
  busy=true;if(button)button.disabled=true;status('');
  try{await action();}
  catch(error){
    if(error.status===401){loaded=false;open(false);}
    status(error.status?error.message:'Could not connect. Your draft is saved. Tap Send to build to retry.');
  }finally{busy=false;if(button)button.disabled=false;updateDraft();}
}
get('unlock').addEventListener('submit',event=>{
  event.preventDefault();
  perform(async()=>{
    await connectLink(get('private-link').value);get('private-link').value='';await refresh();
  },event.submitter);
});
get('brief-form').addEventListener('submit',event=>{
  event.preventDefault();
  perform(async()=>{
    if(pendingBuild())throw new Error('This request is still being built.');
    const text=editor.value.trim(),brief=composedBrief(text);
    if(text.length<10||brief.length>4000)throw Object.assign(new Error('Use at least 10 characters and keep the full brief under 4,000.'),{status:400});
    let pending;try{pending=JSON.parse(local(submissionKey));}catch{}
    const id=pending?.brief===brief?pending.id:crypto.randomUUID();
    local(submissionKey,JSON.stringify({id,brief}));
    const {request}=await api({action:'submit',id,brief});
    local(submissionKey,null);local(draftKey(),null);
    items=[request,...items.filter(item=>item.id!==request.id)];
    selected=request.id;local(selectedKey,selected);
    editor.value=local(draftKey())||'';loaded=true;open(true);
    renderHistory();showConversation(true);showBuildSummary();
  },get('submit'));
});
get('new').addEventListener('click',()=>{if(!busy)select(null);});
get('cancel-followup').addEventListener('click',()=>{if(!busy)select(null);});
get('history-toggle').addEventListener('click',()=>{
  const panel=get('history-panel');panel.hidden=!panel.hidden;
  get('history-toggle').setAttribute('aria-expanded',!panel.hidden);
});
get('refresh').addEventListener('click',()=>perform(refresh,get('refresh')));
get('lock').addEventListener('click',()=>perform(async()=>{
  sessionGeneration++;await api({action:'lock'});
  loaded=false;items=[];get('build-summary').textContent='';get('conversation').replaceChildren();get('history').replaceChildren();open(false);
},get('lock')));
get('install-help').addEventListener('click',()=>get('install-note').hidden=!get('install-note').hidden);
editor.addEventListener('input',updateDraft);
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!busy)refresh();});
selected=local(selectedKey)||null;
editor.value=local(draftKey())||(!selected?(local('parasite-creator-draft')||local('parasite_command_draft_v3')||''):'');
updateDraft();
setInterval(()=>{if(loaded&&!busy&&!document.hidden)refresh();},300000);
if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});
// URL fragments stay out of server access logs and referrer headers.
function privateCode(raw){
 let url;try{url=new URL(raw);}catch{throw Object.assign(new Error('Use your private Hub Remote sign-in link.'),{status:400});}
 if(url.origin!=='https://parasite-creator.vercel.app'||url.pathname!=='/')throw Object.assign(new Error('Use your private Hub Remote sign-in link.'),{status:400});
 const code=new URLSearchParams(url.hash.slice(1)).get('connect');
 if(!code||code.length>90)throw Object.assign(new Error('This sign-in link is incomplete.'),{status:400});
 return code;
}
async function connectLink(raw){await api({action:'unlock',code:privateCode(raw)});}
function showBuildSummary(){
 const counts={queued:0,building:0,needs_input:0,blocked:0};
 for(const item of items)if(Object.prototype.hasOwnProperty.call(counts,item.state))counts[item.state]++;
 const ready=items.filter(x=>x.state==='deployed'&&releaseLink(x.release_url)).sort((a,b)=>new Date(b.updated_at)-new Date(a.updated_at))[0];
 get('build-summary').textContent=counts.building+' building · '+counts.queued+' queued · '+(counts.needs_input+counts.blocked)+' need attention'+(ready?' · Last verified release '+new Date(ready.updated_at).toLocaleString('en-GB'):'');
}
(async()=>{
 const fragment=location.hash;
 if(fragment){
  const incoming=location.href;history.replaceState(null,'',location.pathname+location.search);
  if(new URLSearchParams(fragment.slice(1)).has('connect')){
   try{await connectLink(incoming);}catch(error){status(error.message);open(false);return;}
  }
 }
 refresh();
})();
