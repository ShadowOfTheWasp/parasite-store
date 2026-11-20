'use strict';

const get = id => document.getElementById(id);
let email = '';
let previewMember = false;
let busy = false;
let state;

async function api(action, data) {
  const path = '/api/member?action=' + encodeURIComponent(action);
  const response = await fetch(path, data ? {
    method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data)
  } : {cache:'no-store'});
  if (!response.ok) {
    const {error} = await response.json().catch(() => ({}));
    throw new Error(error || 'Membership is temporarily unavailable.');
  }
  return response.json();
}

function notify(message) {
  get('notice').textContent = message;
}

function display(id, visible) {
  get(id).hidden = !visible;
}

function renderReleases(releases) {
  const root = get('releases');
  root.replaceChildren();
  for (const item of releases) {
    const article = document.createElement('article');
    article.className = 'release card';
    const heading = document.createElement('h3');
    heading.textContent = item.title;
    article.append(heading);
    const button = document.createElement('button');
    button.textContent = previewMember ? 'Preview download' : 'Download APK';
    button.addEventListener('click', () => perform(async () => {
      if (previewMember) return notify('Preview only. Member downloads are disabled here.');
      const {url} = await api('download', {id:item.id});
      location.assign(url);
    }));
    article.append(button);
    root.append(article);
  }
  if (!releases.length) {
    root.textContent = 'Member releases will appear here when published.';
  }
}

function render() {
  const preview = state.mode === 'preview';
  const member = state.member || previewMember;
  get('mode').textContent = preview ? 'PREVIEW · NO CHARGES' : 'STRIPE TEST MODE';
  display('mode', preview || state.mode === 'test');
  display('email-form', !preview && !state.signedIn && !email);
  display('code-form', !preview && !state.signedIn && Boolean(email));
  display('preview', preview && !previewMember);
  display('checkout', state.signedIn && !member && !state.needsBilling);
  display('billing', state.signedIn && state.hasCustomer);
  display('signout', state.signedIn || previewMember);
  display('library', member);
  display('offer', !member);
  get('state-title').textContent = member ? 'Membership active' : 'Parasite Membership';
  get('state-detail').textContent = member ? 'Your member instruments are available below.' :
    state.needsBilling ? 'Open Billing to review your existing subscription.' :
    preview ? 'Preview the member experience. No payment or email is collected.' :
    'Billed monthly. Manage or cancel your subscription from this hub.';
  if (member) renderReleases(previewMember ? [{id:'preview',title:'Tape Flute · Sample listing'}] : state.releases);
}

async function refresh() {
  state = await api('status');
  render();
}

async function perform(action) {
  if (busy) return;
  busy = true;
  notify('');
  try { await action(); }
  catch (error) { notify(error.message); }
  finally { busy = false; }
}

get('email-form').addEventListener('submit', event => {
  event.preventDefault();
  perform(async () => {
    const address = get('email').value.trim();
    await api('code', {email:address});
    email = address;
    render();
    get('code').focus();
    notify('Enter the sign-in code from your email.');
  });
});
get('code-form').addEventListener('submit', event => {
  event.preventDefault();
  perform(async () => {
    await api('verify', {email, code:get('code').value.trim()});
    email = '';
    get('code').value = '';
    await refresh();
  });
});
get('change-email').addEventListener('click', () => { email = ''; get('code').value = ''; render(); });
get('preview').addEventListener('click', () => { previewMember = true; render(); });
get('signout').addEventListener('click', () => perform(async () => {
  if (previewMember) previewMember = false;
  else await api('signout', {});
  await refresh();
}));
for (const [button, action] of [['checkout','checkout'], ['billing','portal']]) {
  get(button).addEventListener('click', () => perform(async () => {
    const {url} = await api(action, {});
    location.assign(url);
  }));
}
perform(async () => {
  await refresh();
  const result = new URLSearchParams(location.search).get('checkout');
  if (result === 'complete' && !state.member) notify('Payment confirmation is pending. Reload to check membership status.');
  if (result === 'cancelled') notify('Checkout closed. You can return to checkout from this page.');
});
