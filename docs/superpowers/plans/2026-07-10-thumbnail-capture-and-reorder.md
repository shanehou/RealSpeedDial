# Thumbnail Capture and Reorder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development for every behavior change. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make screenshot thumbnails update reliably, add a native “capture current page” workflow with searchable bookmark selection, simplify tile styles, and fix reorder persistence.

**Architecture:** Keep `themeColor` as the backward-compatible persisted ID but expose it as “Icon + title”. Centralize exact URL matching and pending screenshot storage in pure/testable library functions. Keep the service worker as the Chrome API adapter, and reuse the existing Options entry point for a dedicated popup picker. Derive all write targets from the resolved `FolderView`.

**Tech Stack:** React 19, TypeScript, Chrome MV3 APIs, IndexedDB, Vitest, Testing Library, dnd-kit.

---

### Task 1: Tile style migration

**Files:**
- Modify: `src/types.ts`
- Modify: `src/lib/settings.ts`
- Modify: `src/options/Options.tsx`
- Modify: `src/lib/i18n.ts`
- Modify: `src/newtab/App.tsx`
- Modify: `src/newtab/components/Tile.tsx`
- Test: `src/lib/settings.test.ts`
- Test: `src/options/Options.test.tsx`
- Test: `src/newtab/components/Tile.test.tsx`

- [ ] Add failing tests proving `favicon` and unknown stored values normalize to `themeColor`, while `screenshot` remains unchanged.
- [ ] Run focused tests and confirm failures are caused by the missing migration.
- [ ] Change runtime `TileStyle` to `'themeColor' | 'screenshot'`, default to `themeColor`, remove the old fixed-background option, and label `themeColor` as “Icon + title / 图标 + 标题”.
- [ ] Ensure screenshots render only when `tileStyle === 'screenshot'`; otherwise use the URL-derived gradient.
- [ ] Run focused tests to green.

### Task 2: Reorder target correctness

**Files:**
- Modify: `src/lib/reorder.ts`
- Modify: `src/newtab/App.tsx`
- Test: `src/lib/reorder.test.ts`
- Test: `src/newtab/App.test.tsx`

- [ ] Add a failing regression test for a folder with no Home bookmarks where `view.activeTabId` falls back to the first subfolder.
- [ ] Assert the move destination is `{ parentId: view.activeTabId, index: resolveMoveIndex(...) }`, not the raw requested `tabId`.
- [ ] Add `resolveReorderDestination(view, from, to)` and use the resolved view for both create and reorder operations.
- [ ] Keep Chrome’s same-parent downward `+1` index semantics unchanged.
- [ ] Run focused tests to green.

### Task 3: Thumbnail matching and pending capture storage

**Files:**
- Modify: `src/lib/search.ts`
- Modify: `src/lib/thumbnails.ts`
- Modify: `src/lib/messages.ts`
- Test: `src/lib/search.test.ts`
- Test: `src/lib/thumbnails.test.ts`

- [ ] Add failing tests for syntactically normalized exact URL matching (`https://x.test` equals `https://x.test/`) and title/URL token search with full paths.
- [ ] Add failing tests for storing, loading, and deleting a pending screenshot draft in IndexedDB.
- [ ] Implement `normalizePageUrl`, `findExactBookmarkUrls`, and `searchBookmarkChoices`.
- [ ] Implement pending capture helpers using the existing assets store.
- [ ] Add typed `thumbnail-updated` messages.
- [ ] Run focused tests to green.

### Task 4: Native context-menu and reliable automatic capture

**Files:**
- Modify: `manifest.config.ts`
- Modify: `src/background/service-worker.ts`
- Modify: `tests/setup.ts`
- Create: `src/background/service-worker.test.ts`

- [ ] Extend the Chrome mock and add failing tests for menu registration, exact-match capture, no-match picker opening, and `tabs.onActivated` automatic capture.
- [ ] Add required `contextMenus` and `activeTab` permissions.
- [ ] Register a page context menu on install.
- [ ] Capture the clicked active tab, save directly under every exact bookmark URL, or persist a draft and open `src/options/index.html?thumbnailPicker=<id>`.
- [ ] Make automatic capture run on both completed active loads and activation of already-loaded tabs, only for exact bookmark URLs and only when screenshot mode/policy/permission allow it.
- [ ] Broadcast `thumbnail-updated` after IndexedDB commits and revalidate the active tab before capture.
- [ ] Keep temporary capture tabs inside `try/finally`.
- [ ] Run focused tests to green.

### Task 5: Searchable picker and live thumbnail refresh

**Files:**
- Create: `src/options/ThumbnailPicker.tsx`
- Create: `src/options/ThumbnailPicker.test.tsx`
- Modify: `src/options/main.tsx`
- Modify: `src/options/styles.css`
- Modify: `src/lib/i18n.ts`
- Modify: `src/newtab/hooks/useThumbnails.ts`
- Modify: `src/newtab/hooks/useThumbnails.test.ts`

- [ ] Add failing picker tests for loading a draft, fuzzy filtering by title/URL, displaying the folder path, selecting a bookmark, and cancellation.
- [ ] Add a failing hook test proving `thumbnail-updated` causes an already-mounted new-tab page to reload the affected thumbnail.
- [ ] Render the picker from the existing Options entry when `thumbnailPicker` is present.
- [ ] Save the selected screenshot under the selected bookmark URL, broadcast the update, clean the draft, and close the popup.
- [ ] Add compact accessible popup styling and bilingual copy.
- [ ] Run focused tests to green.

### Task 6: Documentation and verification

**Files:**
- Modify: `README.md`
- Modify: `README.zh-CN.md`

- [ ] Document the two tile styles and native current-page capture permission.
- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Check diagnostics only for files changed in this plan.
- [ ] Manually verify in Chrome: auto capture after tab activation, exact-match context capture, searchable fallback picker, thumbnail live refresh, and persistent reorder.

No commit is created unless the user explicitly requests one.
