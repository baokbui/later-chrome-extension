// Popup script — runs each time the toolbar icon is clicked.

async function init() {
  // Auto-fill URL with the current tab (skip chrome:// pages).
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url && !/^chrome[-a-z]*:\/\//.test(tab.url)) {
      document.getElementById('url').value = tab.url;
    }
  } catch (e) { /* ignore */ }

  await render();
  document.getElementById('why').focus();
}

async function render() {
  const items = await getItems();
  const el = document.getElementById('list');
  if (!items.length) {
    el.innerHTML = '<div class="empty">Nothing saved yet.<br/>The current tab is already filled in — just tell future-you <em>why</em>.</div>';
    return;
  }
  const g = groupItems(items);
  el.innerHTML = [
    renderSection('Overdue', g.overdue),
    renderSection('Today', g.today),
    renderSection('This week', g.week),
    renderSection('Later', g.later),
    g.done.length ? renderSection('Archive', g.done.slice(0, 3)) : ''
  ].join('');
}

function renderSection(label, list) {
  if (!list.length) return '';
  return '<div class="sec">'
    + '<p class="sec-label">' + label + ' · ' + list.length + '</p>'
    + list.map(renderCard).join('')
    + '</div>';
}

function renderCard(it) {
  const url = normalizeUrl(it.url);
  const isOverdue = !it.done && it.remindAt < Date.now();
  const urlPart = url
    ? '<a class="link" href="' + esc(url) + '" target="_blank" rel="noopener">' + esc(domain(it.url)) + '</a>'
    : '';
  const duePart = it.done
    ? '<span class="due done">Done</span>'
    : '<span class="due ' + (isOverdue ? 'late' : '') + '">' + fmtRelative(it.remindAt) + '</span>';
  const actions = it.done
    ? '<button data-act="undone" data-id="' + it.id + '">Restore</button>'
      + '<button data-act="del" data-id="' + it.id + '">Delete</button>'
    : '<button data-act="done" data-id="' + it.id + '">Done</button>'
      + '<button data-act="snooze-day" data-id="' + it.id + '">+1d</button>'
      + '<button data-act="snooze-week" data-id="' + it.id + '">+1w</button>'
      + '<button data-act="del" data-id="' + it.id + '">Delete</button>';
  return '<div class="card ' + (it.done ? 'done-card' : '') + '">'
    + '<p class="why">' + (esc(it.why) || '<em>(no reason)</em>') + '</p>'
    + '<div class="meta">' + urlPart + duePart + '</div>'
    + '<div class="actions">' + actions + '</div>'
    + '</div>';
}

document.getElementById('add-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const urlEl = document.getElementById('url');
  const whyEl = document.getElementById('why');
  const whenEl = document.getElementById('when');
  const url = urlEl.value.trim();
  const why = whyEl.value.trim();
  if (!why && !url) { whyEl.focus(); return; }

  const items = await getItems();
  items.push({
    id: uid(),
    url: url,
    why: why,
    createdAt: Date.now(),
    remindAt: computeRemind(whenEl.value),
    done: false,
    doneAt: null,
    notifiedAt: 0
  });
  await setItems(items);
  urlEl.value = '';
  whyEl.value = '';
  await render();
  chrome.runtime.sendMessage({ type: 'items-changed' }).catch(() => {});
});

document.addEventListener('click', async (e) => {
  const t = e.target;
  if (!t) return;

  if (t.id === 'open-dashboard') {
    chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
    return;
  }

  if (t.dataset && t.dataset.act) {
    const items = await getItems();
    const act = t.dataset.act;
    const id = t.dataset.id;

    if (act === 'del') {
      const filtered = items.filter(x => x.id !== id);
      await setItems(filtered);
    } else {
      const it = items.find(x => x.id === id);
      if (!it) return;
      if (act === 'done') { it.done = true; it.doneAt = Date.now(); }
      else if (act === 'undone') { it.done = false; it.doneAt = null; it.notifiedAt = 0; }
      else if (act === 'snooze-day') { it.remindAt = Date.now() + 86400000; it.notifiedAt = 0; }
      else if (act === 'snooze-week') { it.remindAt = Date.now() + 7 * 86400000; it.notifiedAt = 0; }
      await setItems(items);
    }
    await render();
    chrome.runtime.sendMessage({ type: 'items-changed' }).catch(() => {});
  }
});

init();
