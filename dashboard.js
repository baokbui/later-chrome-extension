// Dashboard script — full-page view of all items.

async function render() {
  const items = await getItems();
  const el = document.getElementById('list');
  if (!items.length) {
    el.innerHTML = '<div class="empty">Nothing saved yet.<br/>Paste a URL, write a reason, and pick when to surface it.</div>';
    return;
  }
  const g = groupItems(items);
  el.innerHTML = [
    renderSection('Overdue', g.overdue),
    renderSection('Today', g.today),
    renderSection('This week', g.week),
    renderSection('Later', g.later),
    renderSection('Archive', g.done)
  ].join('') || '<div class="empty">Inbox zero.</div>';
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
      + '<button data-act="snooze-day" data-id="' + it.id + '">+1 day</button>'
      + '<button data-act="snooze-week" data-id="' + it.id + '">+1 week</button>'
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
  if (!t || !t.dataset || !t.dataset.act) return;

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
});

// Auto-refresh so the dashboard stays in sync if items change elsewhere
// (e.g., the service worker fires a notification and marks notifiedAt).
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes[LATER_STORAGE_KEY]) render();
});

render();
