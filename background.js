// Service worker — runs in the background to update the toolbar badge
// and fire notifications when items come due.

importScripts('later.js');

const ALARM_NAME = 'later-check';

function scheduleAlarm() {
  chrome.alarms.create(ALARM_NAME, {
    delayInMinutes: 0.1,
    periodInMinutes: 1
  });
}

chrome.runtime.onInstalled.addListener(() => {
  scheduleAlarm();
  updateBadge();
});

chrome.runtime.onStartup.addListener(() => {
  scheduleAlarm();
  updateBadge();
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== ALARM_NAME) return;
  await checkItems();
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === 'items-changed') {
    updateBadge();
  }
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes[LATER_STORAGE_KEY]) {
    updateBadge();
  }
});

async function updateBadge() {
  const items = await getItems();
  const now = Date.now();
  const due = items.filter(it => !it.done && it.remindAt <= now).length;
  if (due > 0) {
    chrome.action.setBadgeText({ text: String(due) });
    chrome.action.setBadgeBackgroundColor({ color: '#D85A30' });
  } else {
    chrome.action.setBadgeText({ text: '' });
  }
}

async function checkItems() {
  const items = await getItems();
  const now = Date.now();
  let changed = false;

  for (const it of items) {
    if (it.done) continue;
    // Fire notification if item is due AND we haven't notified for this
    // particular remindAt value yet.
    if (it.remindAt <= now && (!it.notifiedAt || it.notifiedAt < it.remindAt)) {
      it.notifiedAt = now;
      changed = true;

      const options = {
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: 'Later — time to come back',
        message: it.why || 'Saved item is due',
        priority: 1
      };
      if (it.url) options.contextMessage = domain(it.url);

      try {
        await chrome.notifications.create('later-' + it.id, options);
      } catch (e) { /* ignore notification failures */ }
    }
  }

  if (changed) await setItems(items);
  updateBadge();
}

chrome.notifications.onClicked.addListener(async (notifId) => {
  if (!notifId.startsWith('later-')) return;
  const id = notifId.slice(6);
  const items = await getItems();
  const it = items.find(x => x.id === id);
  if (it && it.url) {
    chrome.tabs.create({ url: normalizeUrl(it.url) });
  } else {
    chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
  }
  chrome.notifications.clear(notifId);
});
