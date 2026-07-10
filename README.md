# Real Speed Dial

English | [中文](README.zh-CN.md)

A true Vivaldi-style Speed Dial for Chrome (Manifest V3): it takes over the new tab page and tiles a bookmark folder you choose. Subfolders show as top **Tabs**; deeper levels use "recursive replacement". Bookmarks are the single source of truth — every edit writes back to Chrome bookmarks and syncs live.

![icon](public/icons/icon128.png)

## Features

- **Bookmark-driven Speed Dial**: pick a default landing folder in Settings; its direct bookmarks tile on the "Home" tab and each subfolder becomes a tab.
- **Whole-tree navigation**: a clickable breadcrumb runs from the browser bookmarks root to the current folder; press **⤵ Enter** on a subfolder tab to make it the current folder. The browser Back key steps out level by level.
- **Grouped search** across the whole tree — "Current folder" vs "Other folders" — with the full path shown on every result.
- **Real-link tiles**: hover shows the target URL in the browser status bar; middle/Cmd-click opens a new tab; right-click gives the in-app menu.
- **Tile styles**: Icon + title with a stable URL-derived gradient, or screenshot with a readable text layer.
- **Screenshot control**: thumbnails update when a bookmarked page is visited; the browser page context menu can capture the exact state you like. If the current URL is not bookmarked, a searchable picker lets you choose the target bookmark.
- **Auto-updating wallpaper**: Bing daily / Lorem Picsum / Unsplash (bring your own key), one per day, cached for offline, sized to your screen with `cover` (no stretching).
- **Bilingual UI** (English / 中文): follows the browser language by default, switchable in Settings.
- **Appearance**: dark / light / system theme, solid color or wallpaper background, adjustable columns, and last-position memory.

## Development

```bash
npm install
npm run dev
npm test
npm run build
```

## Load unpacked

1. `npm run build`
2. Open `chrome://extensions`, enable "Developer mode".
3. "Load unpacked" → choose the `dist/` folder.
4. Open a new tab → first run prompts you to pick a default landing folder in the extension Options.

## Package & publish

```bash
npm run build
cd dist && zip -r ../real-speed-dial.zip . && cd ..
```

Upload `real-speed-dial.zip` to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole). Bump `version` in `manifest.config.ts` for each update.

## Permissions

| Permission | Purpose | When |
|---|---|---|
| `bookmarks` | read/write bookmarks (core) | install |
| `storage` | settings & nav state | install |
| `favicon` | show site icons | install |
| `contextMenus` + `activeTab` | capture the currently visible page from its browser context menu | install |
| `tabs` + `<all_urls>` | screenshot thumbnails (`captureVisibleTab`) | **requested on demand** (screenshot style / manual refresh) |
| host perms for `bing.com` / `picsum.photos` / `api.unsplash.com` / `images.unsplash.com` | fetch the daily wallpaper | **requested on demand** (when Auto wallpaper is enabled) |

## Unsplash

Enabling the Unsplash source requires **your own Access Key** (stored locally on your device only, since this extension has no backend). Attribution to the photographer and Unsplash is shown as required by the [Unsplash API Guidelines](https://help.unsplash.com/en/articles/2511245-unsplash-api-guidelines). Bing and Lorem Picsum need no key and are the defaults.

## License

MIT — see [LICENSE](LICENSE).

## Design & implementation docs

- Spec (round 2): `docs/superpowers/specs/2026-07-09-real-speed-dial-improvements-design.md`
- Plan (round 2): `docs/superpowers/plans/2026-07-09-real-speed-dial-improvements.md`
