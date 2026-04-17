# Later

A Chrome extension that fixes "too many tabs" by forcing you to write down **why** you opened something, then surfacing it back when you said you'd return.

## The idea

Bookmark managers fail because they're optimized for *finding* things later. The problem with tab hoarding isn't finding — it's **remembering why you cared**. Titles and favicons don't cut it; three days later "https://www.youtube.com/watch?v=Aq5WXmQQooo" means nothing.

Later adds exactly one piece of friction at save time: write a sentence in your own words about why this matters. Then it gets out of the way until the time you said you'd come back.

## Features

- **One-click save** — toolbar icon or `Ctrl+Shift+L` / `Cmd+Shift+L`
- **The URL auto-fills** from the active tab — you just write the reason
- **Reminder buckets** (1 hour / today / tomorrow / 3 days / next week) instead of calendar-picking
- **Badge count** on the toolbar icon showing how many are due
- **Desktop notification** when each item's time arrives, clicking opens the saved URL
- **Dashboard view** for the full list (popup → ↗)
- **Snooze, archive, delete** — the usual inbox moves
- **Local storage only** — nothing leaves your browser

## Install (developer mode)

1. Unzip this folder anywhere on your machine
2. Open `chrome://extensions/`
3. Toggle **Developer mode** (top right)
4. Click **Load unpacked** and select the unzipped folder
5. Pin the Later icon to your toolbar via the puzzle-piece menu so it's always visible

That's it. Click the icon on any tab — the URL is already filled in. Type why you're saving it, pick a timing, hit Save.

## Architecture

```
manifest.json             MV3 config: permissions, action, service worker, shortcut
later.js                  Shared data layer + helpers (chrome.storage.local)
popup.html/.css/.js       Toolbar popup UI
dashboard.html/.css/.js   Full-page dashboard
background.js             Service worker: 1-min alarm → badge + notifications
icons/                    Toolbar icons (16 / 48 / 128)
```

Data lives in `chrome.storage.local` as a single key holding an array of items:

```js
{
  id, url, why,
  createdAt, remindAt,
  done, doneAt,
  notifiedAt    // when the last desktop notification was fired
}
```

The service worker runs a 1-minute `chrome.alarms` tick. On each tick it reads the items, updates the toolbar badge count, and fires a notification for any item that's newly due. `notifiedAt` is tracked per item so snoozing re-arms the notification without re-firing ones the user has already seen.

Popup and dashboard listen to `chrome.storage.onChanged` so the UI stays in sync across contexts — if the service worker marks an item notified, the dashboard reflects it immediately.

## Permissions

| Permission | Why |
|---|---|
| `storage` | persist items locally |
| `alarms` | wake the service worker to check due items |
| `notifications` | fire a desktop notification when an item comes due |
| `activeTab` | read the URL of the current tab when you click Save |

No network, no analytics, no sync server.

## Roadmap

Things that would make this meaningfully better than yet-another-bookmarks-app:

- **Right-click → Save link** via `contextMenus`
- **Import/export** to JSON for portability
- **Sync** via `chrome.storage.sync` (work around the 8 kB quota with item sharding)
- **Daily digest** — a single notification at 9 am listing everything due today
- **Recurring reminders** ("every Monday I want to check this")
- **LLM pass** on items older than a week: "is this still worth your time?" — the *why* field makes this kind of automated triage possible in a way plain bookmarks don't
- **Chrome Web Store** submission — needs a 440×280 promo image, a privacy policy URL, and screenshots; no code changes required

## License

MIT — Feel free to do anything to it!
