'use strict';

const get = id => document.getElementById(id);
const editor = get('brief');
const draftKey = 'parasite-creator-draft';
const submissionKey = 'parasite-creator-pending';
const deviceKey = 'parasite-creator-opened';
let busy = false;
let loaded = false;
const labels = {queued:'Queued',building:'Building',deployed:'Deployed',needs_input:'Needs your input',blocked:'Blocked'};

function local(key, value) {
  try {
    if (value === null) return localStorage.removeItem(key);
    if (value !== undefined) return localStorage.setItem(key,value);
    return localStorage.getItem(key);
  } catch {
    return undefined;
  }
}

function setStatus(message) {
  get('status').textContent = message;
}

function setOpen(open) {
  get('setup').hidden = open;
  get('workspace').hidden = !open;
  get('lock').hidden = !open;
}

async function api(body) {
  const response = await fetch('/api/queue',body ? {
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)
  } : {cache:'no-store'});
  const result = await response.json();
  if (!response.ok) throw Object.assign(new Error(result.error),{status:response.status});
  return result;
}

function render(items) {
  const history = get('history');
  history.replaceChildren();
  if (!items.length) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = 'No module requests yet.';
    history.append(empty);
    return;
  }
  for (const item of items) {
    const card = document.createElement('article');
    const details = document.createElement('details');
    const title = document.createElement('summary');
    const line = item.brief.split('\n')[0];
    title.textContent = line.slice(0,76) + (line.length > 76 ? '…' : '');
    const meta = document.createElement('span');
    meta.className = 'meta';
    meta.textContent = (labels[item.state] || item.state) + ' · ' +
      new Date(item.created_at).toLocaleString('en-GB',{dateStyle:'medium',timeStyle:'short'});
    details.append(title,meta);
    const brief = document.createElement('p');
    brief.textContent = item.brief;
    details.append(brief);
    if (item.note) {
      const note = document.createElement('p');
      note.textContent = item.note;
      details.append(note);
    }
    if (item.release_url) {
      try {
        const url = new URL(item.release_url);
        if (url.protocol === 'https:') {
          const link = document.createElement('a');
          link.href = url.href;
          link.textContent = 'View release ↗';
          details.append(link);
        }
      } catch {}
    }
    card.append(details);
    history.append(card);
  }
}

async function refresh() {
  try {
    const {requests} = await api();
    loaded = true;
    local(deviceKey,'1');
    setOpen(true);
    render(requests);
  } catch (error) {
    if (error.status === 401) {
      loaded = false;
      local(deviceKey,null);
      get('history').replaceChildren();
      setOpen(false);
      return;
    }
    setOpen(loaded || local(deviceKey) === '1');
    setStatus('Queue unavailable. You can keep editing a draft and retry when online.');
  }
}

function updateDraft() {
  get('count').textContent = editor.value.length.toLocaleString('en-GB') + ' / 4,000';
  local(draftKey,editor.value);
}
const previous = local(draftKey) ?? local('parasite_command_draft_v3');
if (previous) editor.value = previous.slice(0,4000);
updateDraft();
editor.addEventListener('input',updateDraft);

async function perform(action,button) {
  if (busy) return;
  busy = true;
  if (button) button.disabled = true;
  setStatus('');
  try { await action(); }
  catch (error) { setStatus(error.status ? error.message : 'Could not connect. Your draft is still here. Try again.'); }
  finally { busy = false; if (button) button.disabled = false; }
}
get('unlock').addEventListener('submit',event => {
  event.preventDefault();
  perform(async () => {
    await api({action:'unlock',code:get('code').value});
    get('code').value = '';
    await refresh();
    if (loaded) editor.focus();
  },event.submitter);
});
get('brief-form').addEventListener('submit',event => {
  event.preventDefault();
  perform(async () => {
    const brief = editor.value.trim();
    let pending;
    try { pending = JSON.parse(local(submissionKey)); } catch {}
    const id = pending?.brief === brief ? pending.id : crypto.randomUUID();
    local(submissionKey,JSON.stringify({id,brief}));
    await api({action:'submit',id,brief});
    local(submissionKey,null);
    if (editor.value.trim() === brief) {
      editor.value = '';
      updateDraft();
    }
    await refresh();
    setStatus(loaded ? 'Module request queued.' : 'Module request queued. Refresh to see its status.');
  },get('submit'));
});
get('refresh').addEventListener('click',() => perform(refresh,get('refresh')));
get('lock').addEventListener('click',() => perform(async () => {
  await api({action:'lock'});
  loaded = false;
  local(deviceKey,null);
  get('history').replaceChildren();
  setOpen(false);
}));
document.addEventListener('visibilitychange',() => {
  if (!document.hidden && loaded) perform(refresh);
});
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
refresh();
