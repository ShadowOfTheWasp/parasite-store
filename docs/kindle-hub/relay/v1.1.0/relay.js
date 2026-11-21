'use strict';

const byId = (id) => document.getElementById(id);
const channel = byId('channel');
const language = byId('language');
const mic = byId('mic');
const voiceStatus = byId('voice-status');
const feed = byId('feed');
const partial = byId('partial');
const message = byId('message');
const cueInput = byId('cues');
const alerts = byId('alerts');
const exportButton = byId('export');
const clearButton = byId('clear');
const filters = byId('filters');

const colours = new Map([
  ['Monitors', '#caeb9e'],
  ['Stage', '#8cdcce'],
  ['FOH', '#ecbbd2'],
  ['Show call', '#f1cd88']
]);
const timeFormat = new Intl.DateTimeFormat(undefined, {
  hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
});
const entries = [];
let selected = 'All';
let liveRecognition = null;
let patterns = [];

function parseCues() {
  patterns = [...new Set(cueInput.value.split(',').map((phrase) => phrase.trim()).filter(Boolean))]
    .map((phrase) => {
      const words = phrase.split(/\s+/).map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      return [phrase, new RegExp('(^|[^\\p{L}\\p{N}])' + words.join('\\s+') + '(?=$|[^\\p{L}\\p{N}])', 'iu')];
    });
}

function matchingCues(text) {
  return patterns.filter(([, pattern]) => pattern.test(text)).map(([phrase]) => phrase);
}

function appendText(parent, tag, text, className) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.textContent = text;
  parent.append(element);
  return element;
}

function drawLog({ follow = false } = {}) {
  const scrollPosition = feed.scrollTop;
  const visible = selected === 'All' ? entries : entries.filter((entry) => entry.channel === selected);
  const rows = document.createDocumentFragment();
  if (!visible.length) appendText(rows, 'p', 'Waiting for talkback or a typed note.', 'empty');
  for (const entry of visible) {
    const row = document.createElement('article');
    row.className = 'entry';
    row.style.setProperty('--channel', colours.get(entry.channel));
    const heading = appendText(row, 'div', '', 'entry-head');
    const time = appendText(heading, 'time', timeFormat.format(entry.time));
    time.dateTime = entry.time.toISOString();
    appendText(heading, 'strong', entry.channel);
    appendText(heading, 'span', entry.source);
    const hits = matchingCues(entry.text);
    if (hits.length) {
      row.dataset.hit = '';
      appendText(heading, 'span', hits.join(' · '), 'hit');
    }
    appendText(row, 'p', entry.text);
    if (entry.translation) appendText(row, 'p', entry.translation, 'translation');
    if (entry.action) appendText(row, 'p', 'AI suggestion · ' + entry.action, 'suggestion');
    rows.append(row);
  }
  feed.replaceChildren(rows);
  feed.scrollTop = follow ? feed.scrollHeight : scrollPosition;
  byId('count').textContent = visible.length + (visible.length === 1 ? ' entry' : ' entries');
  const matched = entries.filter((entry) => matchingCues(entry.text).length).length;
  alerts.textContent = matched + (matched === 1 ? ' match' : ' matches');
  exportButton.disabled = clearButton.disabled = !entries.length;
}

function addEntries(newEntries) {
  const follow = feed.scrollHeight - feed.scrollTop - feed.clientHeight < 32;
  for (const entry of newEntries) {
    const text = entry.text.trim();
    if (text) entries.push({ ...entry, text, time: entry.time || new Date() });
  }
  drawLog({ follow });
}

for (const name of ['All', ...colours.keys()]) {
  const button = appendText(filters, 'button', name);
  button.type = 'button';
  button.setAttribute('aria-pressed', String(name === selected));
  button.addEventListener('click', () => {
    selected = name;
    for (const sibling of filters.children) sibling.setAttribute('aria-pressed', String(sibling === button));
    drawLog({ follow: true });
  });
}

channel.addEventListener('change', () => {
  byId('entry-label').textContent = 'Type to ' + channel.value;
});

byId('composer').addEventListener('submit', (event) => {
  event.preventDefault();
  if (!message.value.trim()) return;
  addEntries([{ source: 'Typed', channel: channel.value, text: message.value }]);
  message.value = '';
});

byId('cue-form').addEventListener('submit', (event) => {
  event.preventDefault();
  parseCues();
  drawLog();
});

byId('demo').addEventListener('click', () => {
  addEntries([
    { channel: 'Monitors', text: 'Can I get more lead vocal in mix four?' },
    { channel: 'Stage', text: 'Backline change is complete.' },
    { channel: 'FOH', text: 'House system ready.' },
    { channel: 'Show call', text: 'Stand by for the opening cue.' }
  ].map((entry) => ({ ...entry, source: 'Demo' })));
});

clearButton.addEventListener('click', () => {
  if (!window.confirm('Clear all entries from this session?')) return;
  entries.length = 0;
  drawLog();
});

exportButton.addEventListener('click', () => {
  const rows = [['Time (UTC)', 'Channel', 'Source', 'Transcript', 'Keywords', 'Translation', 'AI suggestion']];
  for (const entry of entries) {
    rows.push([entry.time.toISOString(), entry.channel, entry.source, entry.text, matchingCues(entry.text).join(', '), entry.translation || '', entry.action || '']);
  }
  const csv = rows.map((row) => row.map((value) => {
    const cell = /^[\s]*[=+@-]|^[\t\r\n]/.test(value) ? "'" + value : value;
    return '"' + cell.replaceAll('"', '""') + '"';
  }).join(',')).join('\r\n') + '\r\n';
  const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'relay-show-log-' + new Date().toISOString().slice(0, 10) + '.csv';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
});

function setVoiceStatus(text, className = '') {
  voiceStatus.textContent = text;
  voiceStatus.className = 'tag ' + className;
}

function releaseMic(recognition, text, className) {
  if (liveRecognition !== recognition) return;
  liveRecognition = null;
  mic.textContent = 'Start mic';
  mic.disabled = false;
  mic.dataset.live = 'false';
  channel.disabled = language.disabled = false;
  partial.hidden = true;
  partial.textContent = '';
  setVoiceStatus(text, className);
}

function hideMic() {
  if (!liveRecognition) return;
  const recognition = liveRecognition;
  releaseMic(recognition, 'Mic off');
  try {
    recognition.abort();
  } catch {
    // The browser may have already ended this session.
  }
}

const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (!Recognition) {
  mic.disabled = true;
  setVoiceStatus('Voice unavailable in this browser', 'problem');
}

mic.addEventListener('click', () => {
  if (liveRecognition) {
    mic.disabled = true;
    setVoiceStatus('Stopping mic');
    try {
      liveRecognition.stop();
    } catch {
      releaseMic(liveRecognition, 'Mic off');
    }
    return;
  }
  if (!Recognition) return;

  const recognition = new Recognition();
  liveRecognition = recognition;
  recognition.lang = language.value;
  recognition.continuous = true;
  recognition.interimResults = true;
  channel.disabled = language.disabled = true;
  mic.textContent = 'Stop mic';
  mic.dataset.live = 'true';
  setVoiceStatus('Starting mic');
  recognition.onstart = () => {
    if (liveRecognition === recognition && !mic.disabled) setVoiceStatus('Listening', 'live');
  };
  recognition.onresult = (event) => {
    if (liveRecognition !== recognition) return;
    const final = [];
    const pending = [];
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      if (result.isFinal) final.push({ source: 'Voice', channel: channel.value, text: result[0].transcript });
      else pending.push(result[0].transcript.trim());
    }
    partial.textContent = pending.join(' ');
    partial.hidden = !partial.textContent;
    if (final.length) addEntries(final);
  };
  recognition.onerror = (event) => {
    const errors = {
      'not-allowed': 'Microphone or speech permission denied',
      'service-not-allowed': 'Speech service unavailable',
      'audio-capture': 'No microphone available',
      'network': 'Speech service needs a connection',
      'no-speech': 'No speech detected. Start mic to retry.'
    };
    releaseMic(recognition, errors[event.error] || 'Voice session ended. Start mic to retry.', 'problem');
  };
  recognition.onend = () => releaseMic(recognition, 'Mic off');
  try {
    recognition.start();
  } catch {
    releaseMic(recognition, 'Could not start the microphone', 'problem');
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) hideMic();
});
window.addEventListener('pagehide', hideMic);
parseCues();
drawLog();
