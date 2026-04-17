// Shared data layer + helpers.
// Loaded via <script> in popup.html and dashboard.html, and via
// importScripts('later.js') in the background service worker.

const LATER_STORAGE_KEY = 'later:items';

async function getItems() {
  try {
    const r = await chrome.storage.local.get(LATER_STORAGE_KEY);
    return r[LATER_STORAGE_KEY] || [];
  } catch (e) {
    console.error('getItems failed', e);
    return [];
  }
}

async function setItems(items) {
  try {
    await chrome.storage.local.set({ [LATER_STORAGE_KEY]: items });
  } catch (e) {
    console.error('setItems failed', e);
  }
}

function uid() {
  return 'i_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function computeRemind(pref) {
  const now = new Date();
  const d = new Date(now);
  switch (pref) {
    case '1h':
      d.setHours(d.getHours() + 1);
      break;
    case 'today':
      d.setHours(18, 0, 0, 0);
      if (d <= now) d.setTime(now.getTime() + 60 * 60 * 1000);
      break;
    case 'tomorrow':
      d.setDate(d.getDate() + 1);
      d.setHours(9, 0, 0, 0);
      break;
    case '3d':
      d.setDate(d.getDate() + 3);
      break;
    case 'week':
      d.setDate(d.getDate() + 7);
      break;
    default:
      d.setDate(d.getDate() + 1);
      d.setHours(9, 0, 0, 0);
  }
  return d.getTime();
}

function fmtRelative(ts) {
  const diff = ts - Date.now();
  const abs = Math.abs(diff);
  const min = Math.round(abs / 60000);
  const hr = Math.round(abs / 3600000);
  const day = Math.round(abs / 86400000);
  const past = diff < 0;
  let core;
  if (min < 60) core = min + 'm';
  else if (hr < 24) core = hr + 'h';
  else if (day < 30) core = day + 'd';
  else core = new Date(ts).toLocaleDateString();
  return past ? core + ' overdue' : 'in ' + core;
}

function normalizeUrl(url) {
  if (!url) return '';
  if (!/^https?:\/\//i.test(url)) return 'https://' + url;
  return url;
}

function domain(url) {
  try {
    return new URL(normalizeUrl(url)).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function groupItems(items) {
  const now = Date.now();
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  const weekEnd = now + 7 * 86400000;
  const g = { overdue: [], today: [], week: [], later: [], done: [] };
  for (const it of items) {
    if (it.done) g.done.push(it);
    else if (it.remindAt < now) g.overdue.push(it);
    else if (it.remindAt <= todayEnd.getTime()) g.today.push(it);
    else if (it.remindAt <= weekEnd) g.week.push(it);
    else g.later.push(it);
  }
  g.overdue.sort((a, b) => a.remindAt - b.remindAt);
  g.today.sort((a, b) => a.remindAt - b.remindAt);
  g.week.sort((a, b) => a.remindAt - b.remindAt);
  g.later.sort((a, b) => a.remindAt - b.remindAt);
  g.done.sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
  return g;
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
