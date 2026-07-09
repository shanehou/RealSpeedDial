# Real Speed Dial 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个类 Vivaldi Speed Dial 的 Chrome MV3 插件：接管新标签页，把用户选定书签目录的内容平铺呈现，子目录以 Tab 呈现，更深层级用递归替换导航，支持完整书签编辑、可配置磁贴样式、导航状态记忆与按需截图。

**Architecture:** 纯逻辑收敛在 `src/lib/*`（无 React、可单测，Chrome API 封装在此）；`src/newtab` 与 `src/options` 是两个 React 应用；`src/background` 是 Service Worker 负责截图抓取。书签是唯一事实来源：页面直接读书签树渲染，编辑写回 `chrome.bookmarks.*`，并监听其变更事件回流刷新。设置存 `storage.sync`，导航状态存 `storage.local`，缩略图/壁纸存 IndexedDB。

**Tech Stack:** React 18 + TypeScript + Vite + `@crxjs/vite-plugin@^2.7.1`，Vitest + jsdom + React Testing Library + fake-indexeddb 测试，`@dnd-kit` 拖拽，Chrome Manifest V3。

---

## 关键技术约束（实现前必读）

1. **`chrome.tabs.captureVisibleTab` 只能抓「当前可见的活动标签页」**，且被动/自动抓取（无用户手势）**必须**有 `<all_urls>` 主机权限（`activeTab` 每次都要用户手势，不满足自动抓取）。因此截图功能所需的 `tabs` + `host_permissions:<all_urls>` 声明为**可选权限**，运行时用 `chrome.permissions.request`（必须在用户手势里调用，如设置页按钮点击）申请。
2. **`captureVisibleTab` 有频率限制**（约每秒 1 次，`MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND`），需限流。只能在 Service Worker / 扩展页调用，不能在 content script。
3. **MV3 favicon**：加 `"permissions": ["favicon"]`，用 `chrome.runtime.getURL('/_favicon/')` 拼 `pageUrl` + `size`。新标签页是扩展页，无需 `web_accessible_resources`。注意：未同时具备 `tabs`/host 权限时，`favicon` 权限会触发一次安装警告——可接受（favicon 是核心能力）。
4. `@crxjs/vite-plugin` 用 `defineManifest` 写 `manifest.config.ts`；`package.json` 必须 `"type": "module"`。

---

## 文件结构

```text
real-speed-dial/
├─ package.json                 # "type":"module"，scripts
├─ tsconfig.json / tsconfig.node.json
├─ vite.config.ts               # react + crx({manifest})
├─ vitest.config.ts             # jsdom + setup
├─ manifest.config.ts           # defineManifest（MV3）
├─ tests/
│  └─ setup.ts                  # jest-dom + chrome mock 工具
├─ src/
│  ├─ types.ts                  # 全部共享类型
│  ├─ lib/
│  │  ├─ constants.ts           # HOME_TAB_ID 等常量
│  │  ├─ mapping.ts             # 书签树 → FolderView（纯函数，核心）
│  │  ├─ bookmarks.ts           # chrome.bookmarks 封装 + 事件订阅
│  │  ├─ settings.ts            # storage.sync 封装
│  │  ├─ navState.ts            # storage.local 导航状态
│  │  ├─ thumbnails.ts          # IndexedDB 缩略图/资产存取
│  │  ├─ favicon.ts             # favicon / 首字母色块 / 主题色
│  │  └─ messages.ts            # 与后台通信的消息类型与收发
│  ├─ newtab/
│  │  ├─ index.html / main.tsx / App.tsx / styles.css
│  │  ├─ hooks/                 # useBookmarkTree, useSettings, useNavState, useThumbnail
│  │  └─ components/            # TabBar, Grid, Tile, FolderTile, Breadcrumb, SearchBar, ContextMenu, EditDialog, EmptyState, Guidance
│  ├─ options/
│  │  ├─ index.html / main.tsx / Options.tsx / styles.css
│  │  └─ components/            # FolderTreeSelect, AppearanceSettings, ThumbnailSettings
│  └─ background/
│     └─ service-worker.ts      # 截图抓取 + 限流 + 写 IndexedDB
└─ public/
   └─ icons/                    # 16/32/48/128 png
```

---

## 阶段与任务总览

- **Phase 0**：脚手架（Task 1–2）
- **Phase 1**：核心 lib + 单测（Task 3–10）
- **Phase 2**：新标签页只读渲染（Task 11–18）
- **Phase 3**：设置页与根目录选择（Task 19–20）
- **Phase 4**：书签编辑（Task 21–23）
- **Phase 5**：导航状态记忆（Task 24）
- **Phase 6**：磁贴样式与回退（Task 25–26）
- **Phase 7**：搜索（Task 27）
- **Phase 8**：截图缩略图（Task 28–30）
- **Phase 9**：外观增强（Task 31–32）

每个任务结束都要提交。核心逻辑（Phase 1）严格 TDD。

---

# Phase 0：脚手架

## Task 1：初始化项目与依赖

**Files:**
- Create: `package.json`, `tsconfig.json`, `tsconfig.node.json`, `vite.config.ts`, `manifest.config.ts`, `.nvmrc`
- Create: `public/icons/icon16.png`（占位图标，见步骤）

- [ ] **Step 1: 初始化 npm 并安装依赖**

Run（在项目根目录 `/Users/shanehou/Developer/Projects/Real Speed Dial`）：

```bash
npm init -y
npm pkg set type=module
npm i react react-dom
npm i -D vite @vitejs/plugin-react @crxjs/vite-plugin@^2.7.1 typescript \
  @types/react @types/react-dom @types/chrome \
  vitest jsdom @testing-library/react @testing-library/dom \
  @testing-library/user-event @testing-library/jest-dom fake-indexeddb \
  @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

Expected: 依赖装入 `node_modules`，`package.json` 出现 dependencies/devDependencies。

- [ ] **Step 2: 配置 package.json scripts**

编辑 `package.json`，将 `scripts` 设为：

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 3: 写 tsconfig**

`tsconfig.json`：

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "types": ["chrome", "vitest/globals", "@testing-library/jest-dom"],
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  },
  "include": ["src", "tests", "manifest.config.ts", "vite.config.ts", "vitest.config.ts"]
}
```

`tsconfig.node.json`：

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 4: 写 manifest.config.ts**

```ts
import { defineManifest } from '@crxjs/vite-plugin';

export default defineManifest({
  manifest_version: 3,
  name: 'Real Speed Dial',
  version: '0.1.0',
  description: '类 Vivaldi 的书签 Speed Dial 新标签页',
  minimum_chrome_version: '116',
  icons: {
    16: 'public/icons/icon16.png',
    32: 'public/icons/icon32.png',
    48: 'public/icons/icon48.png',
    128: 'public/icons/icon128.png',
  },
  permissions: ['bookmarks', 'storage', 'favicon'],
  optional_permissions: ['tabs'],
  optional_host_permissions: ['<all_urls>'],
  background: { service_worker: 'src/background/service-worker.ts', type: 'module' },
  chrome_url_overrides: { newtab: 'src/newtab/index.html' },
  options_page: 'src/options/index.html',
});
```

- [ ] **Step 5: 写 vite.config.ts**

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import path from 'node:path';
import manifest from './manifest.config';

export default defineConfig({
  plugins: [react(), crx({ manifest })],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  server: { port: 5173, strictPort: true, cors: { origin: [/chrome-extension:\/\//] } },
});
```

- [ ] **Step 6: 生成占位图标**

Run（生成 4 个尺寸的纯色 PNG 占位图；需要有 `sips`/macOS 或用任意 1×1 PNG 放大，简单用 Node 写一个纯色 png 也可。这里用最简单方式：复制一张已有 png）：

```bash
mkdir -p public/icons
# 用 macOS 自带工具从系统图标生成占位；若失败，放任意 128x128 png 到 public/icons/icon128.png 再缩放
printf '' > /tmp/_noop
node -e "const fs=require('fs');const b=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64');for(const s of [16,32,48,128])fs.writeFileSync('public/icons/icon'+s+'.png',b);"
```

Expected: `public/icons/icon16/32/48/128.png` 存在（1×1 蓝点占位，后续可替换）。

- [ ] **Step 7: 创建最小入口以便构建通过**

`src/newtab/index.html`：

```html
<!doctype html>
<html lang="zh-CN">
  <head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>Speed Dial</title></head>
  <body><div id="root"></div><script type="module" src="./main.tsx"></script></body>
</html>
```

`src/newtab/main.tsx`：

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode><App /></StrictMode>,
);
```

`src/newtab/App.tsx`：

```tsx
export default function App() {
  return <div>Real Speed Dial</div>;
}
```

`src/options/index.html`：

```html
<!doctype html>
<html lang="zh-CN">
  <head><meta charset="UTF-8" /><title>Real Speed Dial 设置</title></head>
  <body><div id="root"></div><script type="module" src="./main.tsx"></script></body>
</html>
```

`src/options/main.tsx`：

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import Options from './Options';

createRoot(document.getElementById('root')!).render(
  <StrictMode><Options /></StrictMode>,
);
```

`src/options/Options.tsx`：

```tsx
export default function Options() {
  return <div>设置</div>;
}
```

`src/background/service-worker.ts`：

```ts
console.info('[RSD] service worker loaded');
```

- [ ] **Step 8: 构建验证**

Run: `npm run build`
Expected: 生成 `dist/`，无报错（clang/TS 类型错误按用户规则可忽略无关告警，但构建须成功）。

- [ ] **Step 9: 加载 unpacked 手动验证**

在 Chrome `chrome://extensions` 开启开发者模式 → 「加载已解压的扩展程序」→ 选 `dist/`。打开新标签页应显示「Real Speed Dial」。

- [ ] **Step 10: 提交**

```bash
git add -A
git commit -m "chore: 脚手架 Vite+React+TS+@crxjs MV3 扩展"
```

---

## Task 2：测试环境配置

**Files:**
- Create: `vitest.config.ts`, `tests/setup.ts`

- [ ] **Step 1: 写 vitest.config.ts**

```ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
  },
});
```

- [ ] **Step 2: 写 tests/setup.ts（chrome mock 工具 + jest-dom）**

```ts
import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

type Listener = (...args: unknown[]) => void;
function makeEvent() {
  const listeners = new Set<Listener>();
  return {
    addListener: (cb: Listener) => listeners.add(cb),
    removeListener: (cb: Listener) => listeners.delete(cb),
    _emit: (...args: unknown[]) => listeners.forEach((l) => l(...args)),
  };
}

export function installChromeMock() {
  const syncStore: Record<string, unknown> = {};
  const localStore: Record<string, unknown> = {};
  const chromeMock = {
    runtime: { getURL: (p: string) => `chrome-extension://test${p}`, lastError: undefined as unknown },
    bookmarks: {
      getTree: vi.fn(),
      getSubTree: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      removeTree: vi.fn(),
      move: vi.fn(),
      onChanged: makeEvent(),
      onCreated: makeEvent(),
      onRemoved: makeEvent(),
      onMoved: makeEvent(),
      onChildrenReordered: makeEvent(),
    },
    storage: {
      sync: {
        get: vi.fn(async (key: string) => ({ [key]: syncStore[key] })),
        set: vi.fn(async (obj: Record<string, unknown>) => { Object.assign(syncStore, obj); }),
      },
      local: {
        get: vi.fn(async (key: string) => ({ [key]: localStore[key] })),
        set: vi.fn(async (obj: Record<string, unknown>) => { Object.assign(localStore, obj); }),
      },
      onChanged: makeEvent(),
    },
    permissions: {
      contains: vi.fn(async () => false),
      request: vi.fn(async () => true),
    },
    tabs: { captureVisibleTab: vi.fn(), query: vi.fn(), create: vi.fn(), remove: vi.fn(), onUpdated: makeEvent() },
  };
  vi.stubGlobal('chrome', chromeMock);
  return chromeMock;
}

export type ChromeMock = ReturnType<typeof installChromeMock>;
```

- [ ] **Step 3: 冒烟测试确认环境可用**

Create `tests/smoke.test.ts`：

```ts
import { describe, it, expect } from 'vitest';
import { installChromeMock } from './setup';

describe('test env', () => {
  it('chrome mock installs', () => {
    const c = installChromeMock();
    expect(c.bookmarks.getTree).toBeDefined();
  });
});
```

- [ ] **Step 4: 运行测试**

Run: `npm test`
Expected: PASS（1 个测试通过）。

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "test: 配置 Vitest+jsdom 与 chrome mock"
```

---

# Phase 1：核心 lib（TDD）

## Task 3：共享类型与常量

**Files:**
- Create: `src/types.ts`, `src/lib/constants.ts`

- [ ] **Step 1: 写 constants.ts**

```ts
export const HOME_TAB_ID = '__home__';
export const SETTINGS_KEY = 'settings';
export const NAV_STATE_KEY = 'navState';
export const THUMB_DB_NAME = 'rsd-db';
export const THUMB_DB_VERSION = 1;
export const THUMB_STORE = 'thumbnails';
export const ASSET_STORE = 'assets';
export const WALLPAPER_KEY = 'wallpaper';
export const FOLDER_PREVIEW_COUNT = 4;
```

- [ ] **Step 2: 写 types.ts**

```ts
export interface BookmarkNode {
  id: string;
  parentId?: string;
  title: string;
  url?: string;
  index?: number;
  dateAdded?: number;
  children?: BookmarkNode[];
}

export type TileStyle = 'favicon' | 'themeColor' | 'screenshot';

export interface SpeedDialBookmark {
  kind: 'bookmark';
  id: string;
  title: string;
  url: string;
  index: number;
}

export interface SpeedDialFolder {
  kind: 'folder';
  id: string;
  title: string;
  index: number;
  childrenPreview: string[];
}

export type SpeedDialItem = SpeedDialBookmark | SpeedDialFolder;

export interface TabModel {
  id: string;
  title: string;
  isHome: boolean;
}

export interface Crumb {
  id: string;
  title: string;
}

export interface FolderView {
  folderId: string;
  tabs: TabModel[];
  activeTabId: string;
  items: SpeedDialItem[];
  breadcrumb: Crumb[];
}

export type ThumbnailPolicy = 'always' | 'stale' | 'never';

export type BackgroundSetting =
  | { type: 'color'; value: string }
  | { type: 'wallpaper' };

export interface Settings {
  rootFolderId: string | null;
  tileStyle: TileStyle;
  thumbnailPolicy: ThumbnailPolicy;
  thumbnailStaleDays: number;
  openInNewTab: boolean;
  restoreLastPosition: boolean;
  theme: 'system' | 'light' | 'dark';
  background: BackgroundSetting;
  columns: number;
  searchEngine: string;
}

export const DEFAULT_SETTINGS: Settings = {
  rootFolderId: null,
  tileStyle: 'favicon',
  thumbnailPolicy: 'stale',
  thumbnailStaleDays: 7,
  openInNewTab: false,
  restoreLastPosition: true,
  theme: 'system',
  background: { type: 'color', value: '#1e2130' },
  columns: 6,
  searchEngine: 'https://www.google.com/search?q=%s',
};

export interface NavState {
  currentFolderId: string;
  selectedTabId: string;
}

export interface ThumbnailRecord {
  url: string;
  dataUrl: string;
  capturedAt: number;
}
```

- [ ] **Step 3: 提交**

```bash
git add -A
git commit -m "feat: 定义共享类型与常量"
```

---

## Task 4：mapping.ts 树查找工具（TDD）

**Files:**
- Create: `src/lib/mapping.ts`
- Test: `src/lib/mapping.test.ts`

- [ ] **Step 1: 写失败测试**

`src/lib/mapping.test.ts`：

```ts
import { describe, it, expect } from 'vitest';
import { isFolder, getBookmarks, getSubfolders, findNode, getAncestors } from './mapping';
import type { BookmarkNode } from '@/types';

const tree: BookmarkNode = {
  id: 'root', title: 'Root', children: [
    { id: 'b1', title: 'GitHub', url: 'https://github.com', index: 0 },
    { id: 'f1', title: '工作', index: 1, children: [
      { id: 'b2', title: 'Jira', url: 'https://jira.com', index: 0 },
      { id: 'f2', title: '后端', index: 1, children: [
        { id: 'b3', title: 'MySQL', url: 'https://mysql.com', index: 0 },
      ] },
    ] },
  ],
};

describe('tree utils', () => {
  it('isFolder distinguishes folders from bookmarks', () => {
    expect(isFolder(tree.children![0])).toBe(false);
    expect(isFolder(tree.children![1])).toBe(true);
  });
  it('getBookmarks returns only url children', () => {
    expect(getBookmarks(tree).map((n) => n.id)).toEqual(['b1']);
  });
  it('getSubfolders returns only folder children', () => {
    expect(getSubfolders(tree).map((n) => n.id)).toEqual(['f1']);
  });
  it('findNode locates nested node', () => {
    expect(findNode(tree, 'f2')?.title).toBe('后端');
    expect(findNode(tree, 'nope')).toBeNull();
  });
  it('getAncestors returns root..node path', () => {
    expect(getAncestors(tree, 'f2').map((n) => n.id)).toEqual(['root', 'f1', 'f2']);
    expect(getAncestors(tree, 'nope')).toEqual([]);
  });
});
```

- [ ] **Step 2: 运行验证失败**

Run: `npm test -- mapping`
Expected: FAIL（`isFolder` 等未定义）。

- [ ] **Step 3: 实现工具函数**

`src/lib/mapping.ts`：

```ts
import type { BookmarkNode } from '@/types';

export function isFolder(node: BookmarkNode): boolean {
  return node.url === undefined;
}

export function getBookmarks(folder: BookmarkNode): BookmarkNode[] {
  return (folder.children ?? []).filter((c) => c.url !== undefined);
}

export function getSubfolders(folder: BookmarkNode): BookmarkNode[] {
  return (folder.children ?? []).filter((c) => c.url === undefined);
}

export function findNode(root: BookmarkNode, id: string): BookmarkNode | null {
  if (root.id === id) return root;
  for (const child of root.children ?? []) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
}

export function getAncestors(root: BookmarkNode, id: string): BookmarkNode[] {
  const path: BookmarkNode[] = [];
  function dfs(node: BookmarkNode): boolean {
    path.push(node);
    if (node.id === id) return true;
    for (const child of node.children ?? []) {
      if (dfs(child)) return true;
    }
    path.pop();
    return false;
  }
  return dfs(root) ? path : [];
}
```

- [ ] **Step 4: 运行验证通过**

Run: `npm test -- mapping`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "feat: mapping 树查找工具 + 测试"
```

---

## Task 5：mapping.ts buildTabs 与 resolveActiveTabId（TDD）

**Files:**
- Modify: `src/lib/mapping.ts`
- Test: `src/lib/mapping.test.ts`（追加）

- [ ] **Step 1: 追加失败测试**

在 `mapping.test.ts` 顶部 import 追加 `buildTabs, resolveActiveTabId`，并追加：

```ts
import { HOME_TAB_ID } from './constants';

describe('buildTabs', () => {
  it('adds Home tab when folder has direct bookmarks, then subfolders', () => {
    const tabs = buildTabs(tree);
    expect(tabs.map((t) => t.id)).toEqual([HOME_TAB_ID, 'f1']);
    expect(tabs[0].isHome).toBe(true);
    expect(tabs[1].title).toBe('工作');
  });
  it('omits Home tab when no direct bookmarks', () => {
    const folder: BookmarkNode = { id: 'x', title: 'X', children: [
      { id: 'sf', title: 'Sub', index: 0, children: [] },
    ] };
    expect(buildTabs(folder).map((t) => t.id)).toEqual(['sf']);
  });
  it('returns only Home when folder has only bookmarks', () => {
    const folder: BookmarkNode = { id: 'x', title: 'X', children: [
      { id: 'b', title: 'B', url: 'https://b.com', index: 0 },
    ] };
    expect(buildTabs(folder).map((t) => t.id)).toEqual([HOME_TAB_ID]);
  });
});

describe('resolveActiveTabId', () => {
  it('keeps requested tab when valid', () => {
    expect(resolveActiveTabId(tree, 'f1')).toBe('f1');
  });
  it('falls back to first tab when requested invalid', () => {
    expect(resolveActiveTabId(tree, 'zzz')).toBe(HOME_TAB_ID);
  });
  it('returns empty string when no tabs', () => {
    expect(resolveActiveTabId({ id: 'e', title: 'E', children: [] }, undefined)).toBe('');
  });
});
```

- [ ] **Step 2: 运行验证失败**

Run: `npm test -- mapping`
Expected: FAIL。

- [ ] **Step 3: 实现**

在 `src/lib/mapping.ts` 追加：

```ts
import { HOME_TAB_ID } from './constants';
import type { TabModel } from '@/types';

export function buildTabs(folder: BookmarkNode): TabModel[] {
  const tabs: TabModel[] = [];
  if (getBookmarks(folder).length > 0) {
    tabs.push({ id: HOME_TAB_ID, title: '主页', isHome: true });
  }
  for (const sf of getSubfolders(folder)) {
    tabs.push({ id: sf.id, title: sf.title, isHome: false });
  }
  return tabs;
}

export function resolveActiveTabId(folder: BookmarkNode, requested?: string): string {
  const tabs = buildTabs(folder);
  if (tabs.length === 0) return '';
  if (requested && tabs.some((t) => t.id === requested)) return requested;
  return tabs[0].id;
}
```

- [ ] **Step 4: 运行验证通过**

Run: `npm test -- mapping`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "feat: mapping buildTabs 与 resolveActiveTabId"
```

---

## Task 6：mapping.ts buildItems（TDD）

**Files:**
- Modify: `src/lib/mapping.ts`
- Test: `src/lib/mapping.test.ts`（追加）

- [ ] **Step 1: 追加失败测试**

import 追加 `buildItems`，并追加：

```ts
describe('buildItems', () => {
  it('Home tab shows only the folder direct bookmarks (folders are tabs, not tiles)', () => {
    const items = buildItems(tree, HOME_TAB_ID);
    expect(items).toEqual([
      { kind: 'bookmark', id: 'b1', title: 'GitHub', url: 'https://github.com', index: 0 },
    ]);
  });
  it('subfolder tab shows that subfolder bookmarks + its subfolders as folder tiles', () => {
    const items = buildItems(tree, 'f1');
    expect(items[0]).toEqual({ kind: 'bookmark', id: 'b2', title: 'Jira', url: 'https://jira.com', index: 0 });
    expect(items[1]).toMatchObject({ kind: 'folder', id: 'f2', title: '后端', index: 1 });
  });
  it('folder tile childrenPreview collects up to 4 descendant bookmark urls', () => {
    const items = buildItems(tree, 'f1');
    const folder = items[1] as { childrenPreview: string[] };
    expect(folder.childrenPreview).toEqual(['https://mysql.com']);
  });
  it('returns empty for unknown tab', () => {
    expect(buildItems(tree, 'zzz')).toEqual([]);
  });
});
```

- [ ] **Step 2: 运行验证失败**

Run: `npm test -- mapping`
Expected: FAIL。

- [ ] **Step 3: 实现**

在 `src/lib/mapping.ts` 追加（`FOLDER_PREVIEW_COUNT` 从 constants 引入）：

```ts
import { FOLDER_PREVIEW_COUNT } from './constants';
import type { SpeedDialItem, SpeedDialBookmark, SpeedDialFolder } from '@/types';

function toBookmarkItem(node: BookmarkNode): SpeedDialBookmark {
  return { kind: 'bookmark', id: node.id, title: node.title, url: node.url!, index: node.index ?? 0 };
}

function collectPreviewUrls(folder: BookmarkNode, limit: number): string[] {
  const urls: string[] = [];
  const walk = (n: BookmarkNode) => {
    for (const c of n.children ?? []) {
      if (urls.length >= limit) return;
      if (c.url) urls.push(c.url);
    }
    for (const c of n.children ?? []) {
      if (urls.length >= limit) return;
      if (!c.url) walk(c);
    }
  };
  walk(folder);
  return urls.slice(0, limit);
}

function toFolderItem(node: BookmarkNode): SpeedDialFolder {
  return {
    kind: 'folder',
    id: node.id,
    title: node.title,
    index: node.index ?? 0,
    childrenPreview: collectPreviewUrls(node, FOLDER_PREVIEW_COUNT),
  };
}

export function buildItems(folder: BookmarkNode, activeTabId: string): SpeedDialItem[] {
  if (activeTabId === HOME_TAB_ID) {
    return getBookmarks(folder).map(toBookmarkItem);
  }
  const sub = (folder.children ?? []).find((c) => c.id === activeTabId && c.url === undefined);
  if (!sub) return [];
  return [
    ...getBookmarks(sub).map(toBookmarkItem),
    ...getSubfolders(sub).map(toFolderItem),
  ];
}
```

- [ ] **Step 4: 运行验证通过**

Run: `npm test -- mapping`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "feat: mapping buildItems（主页/子目录 Tab 语义 + 文件夹预览）"
```

---

## Task 7：mapping.ts buildFolderView（TDD，整合）

**Files:**
- Modify: `src/lib/mapping.ts`
- Test: `src/lib/mapping.test.ts`（追加）

- [ ] **Step 1: 追加失败测试**

import 追加 `buildFolderView`，并追加：

```ts
describe('buildFolderView', () => {
  it('composes tabs, items, breadcrumb for root', () => {
    const view = buildFolderView(tree, 'root');
    expect(view.folderId).toBe('root');
    expect(view.activeTabId).toBe(HOME_TAB_ID);
    expect(view.tabs.map((t) => t.id)).toEqual([HOME_TAB_ID, 'f1']);
    expect(view.items.map((i) => i.id)).toEqual(['b1']);
    expect(view.breadcrumb.map((c) => c.id)).toEqual(['root']);
  });
  it('drills into a deep folder as recursion root', () => {
    const view = buildFolderView(tree, 'f2', HOME_TAB_ID);
    expect(view.folderId).toBe('f2');
    expect(view.items.map((i) => i.id)).toEqual(['b3']);
    expect(view.breadcrumb.map((c) => c.id)).toEqual(['root', 'f1', 'f2']);
  });
  it('falls back to root when folderId missing', () => {
    const view = buildFolderView(tree, 'gone');
    expect(view.folderId).toBe('root');
  });
});
```

- [ ] **Step 2: 运行验证失败**

Run: `npm test -- mapping`
Expected: FAIL。

- [ ] **Step 3: 实现**

在 `src/lib/mapping.ts` 追加（引入 `FolderView, Crumb`）：

```ts
import type { FolderView, Crumb } from '@/types';

export function buildFolderView(root: BookmarkNode, folderId: string, requestedTabId?: string): FolderView {
  const folder = findNode(root, folderId) ?? root;
  const tabs = buildTabs(folder);
  const activeTabId = resolveActiveTabId(folder, requestedTabId);
  const items = buildItems(folder, activeTabId);
  const breadcrumb: Crumb[] = getAncestors(root, folder.id).map((n) => ({ id: n.id, title: n.title }));
  return { folderId: folder.id, tabs, activeTabId, items, breadcrumb };
}
```

- [ ] **Step 4: 运行验证通过**

Run: `npm test -- mapping`
Expected: PASS（本文件全部用例通过）。

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "feat: mapping buildFolderView 整合视图投影"
```

---

## Task 8：bookmarks.ts 封装（TDD）

**Files:**
- Create: `src/lib/bookmarks.ts`
- Test: `src/lib/bookmarks.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { installChromeMock, type ChromeMock } from '../../tests/setup';
import { getSubTree, createBookmark, moveBookmark, onBookmarksChanged } from './bookmarks';

let c: ChromeMock;
beforeEach(() => { c = installChromeMock(); });

describe('bookmarks wrapper', () => {
  it('getSubTree returns first node', async () => {
    c.bookmarks.getSubTree.mockResolvedValue([{ id: 'r', title: 'R', children: [] }]);
    const node = await getSubTree('r');
    expect(node.id).toBe('r');
    expect(c.bookmarks.getSubTree).toHaveBeenCalledWith('r');
  });
  it('createBookmark passes parent/title/url', async () => {
    c.bookmarks.create.mockResolvedValue({ id: 'n' });
    await createBookmark('p', 'T', 'https://t.com');
    expect(c.bookmarks.create).toHaveBeenCalledWith({ parentId: 'p', title: 'T', url: 'https://t.com' });
  });
  it('moveBookmark forwards destination', async () => {
    c.bookmarks.move.mockResolvedValue({});
    await moveBookmark('id', { parentId: 'p', index: 2 });
    expect(c.bookmarks.move).toHaveBeenCalledWith('id', { parentId: 'p', index: 2 });
  });
  it('onBookmarksChanged subscribes all events and returns unsub', () => {
    const cb = vi.fn();
    const unsub = onBookmarksChanged(cb);
    c.bookmarks.onChanged._emit();
    c.bookmarks.onMoved._emit();
    expect(cb).toHaveBeenCalledTimes(2);
    unsub();
    c.bookmarks.onChanged._emit();
    expect(cb).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: 运行验证失败**

Run: `npm test -- bookmarks`
Expected: FAIL。

- [ ] **Step 3: 实现**

`src/lib/bookmarks.ts`：

```ts
import type { BookmarkNode } from '@/types';

export async function getSubTree(id: string): Promise<BookmarkNode> {
  const nodes = await chrome.bookmarks.getSubTree(id);
  return nodes[0] as unknown as BookmarkNode;
}

export async function getTree(): Promise<BookmarkNode[]> {
  return (await chrome.bookmarks.getTree()) as unknown as BookmarkNode[];
}

export async function createBookmark(parentId: string, title: string, url?: string): Promise<BookmarkNode> {
  return (await chrome.bookmarks.create({ parentId, title, url })) as unknown as BookmarkNode;
}

export async function updateBookmark(id: string, changes: { title?: string; url?: string }): Promise<void> {
  await chrome.bookmarks.update(id, changes);
}

export async function removeBookmark(id: string): Promise<void> {
  await chrome.bookmarks.remove(id);
}

export async function removeFolder(id: string): Promise<void> {
  await chrome.bookmarks.removeTree(id);
}

export async function moveBookmark(id: string, dest: { parentId?: string; index?: number }): Promise<void> {
  await chrome.bookmarks.move(id, dest);
}

export function onBookmarksChanged(cb: () => void): () => void {
  const events = [
    chrome.bookmarks.onChanged,
    chrome.bookmarks.onCreated,
    chrome.bookmarks.onRemoved,
    chrome.bookmarks.onMoved,
    chrome.bookmarks.onChildrenReordered,
  ];
  events.forEach((e) => e.addListener(cb));
  return () => events.forEach((e) => e.removeListener(cb));
}
```

- [ ] **Step 4: 运行验证通过**

Run: `npm test -- bookmarks`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "feat: bookmarks 封装（读写 + 事件订阅）+ 测试"
```

---

## Task 9：settings.ts 与 navState.ts（TDD）

**Files:**
- Create: `src/lib/settings.ts`, `src/lib/navState.ts`
- Test: `src/lib/settings.test.ts`, `src/lib/navState.test.ts`

- [ ] **Step 1: 写失败测试（settings）**

`src/lib/settings.test.ts`：

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { installChromeMock } from '../../tests/setup';
import { loadSettings, saveSettings } from './settings';
import { DEFAULT_SETTINGS } from '@/types';

beforeEach(() => { installChromeMock(); });

describe('settings', () => {
  it('returns defaults when empty', async () => {
    expect(await loadSettings()).toEqual(DEFAULT_SETTINGS);
  });
  it('merges patch over defaults and persists', async () => {
    const next = await saveSettings({ rootFolderId: 'abc', columns: 8 });
    expect(next.rootFolderId).toBe('abc');
    expect(next.columns).toBe(8);
    expect((await loadSettings()).rootFolderId).toBe('abc');
  });
});
```

- [ ] **Step 2: 写失败测试（navState）**

`src/lib/navState.test.ts`：

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { installChromeMock } from '../../tests/setup';
import { loadNavState, saveNavState } from './navState';

beforeEach(() => { installChromeMock(); });

describe('navState', () => {
  it('returns null when empty', async () => {
    expect(await loadNavState()).toBeNull();
  });
  it('saves and loads', async () => {
    await saveNavState({ currentFolderId: 'f', selectedTabId: '__home__' });
    expect(await loadNavState()).toEqual({ currentFolderId: 'f', selectedTabId: '__home__' });
  });
});
```

- [ ] **Step 3: 运行验证失败**

Run: `npm test -- settings navState`
Expected: FAIL。

- [ ] **Step 4: 实现 settings.ts**

```ts
import { SETTINGS_KEY } from './constants';
import { DEFAULT_SETTINGS, type Settings } from '@/types';

export async function loadSettings(): Promise<Settings> {
  const got = await chrome.storage.sync.get(SETTINGS_KEY);
  return { ...DEFAULT_SETTINGS, ...((got[SETTINGS_KEY] as Partial<Settings>) ?? {}) };
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await loadSettings()), ...patch };
  await chrome.storage.sync.set({ [SETTINGS_KEY]: next });
  return next;
}

export function onSettingsChanged(cb: (s: Settings) => void): () => void {
  const handler = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area === 'sync' && changes[SETTINGS_KEY]) {
      cb({ ...DEFAULT_SETTINGS, ...(changes[SETTINGS_KEY].newValue as Partial<Settings>) });
    }
  };
  chrome.storage.onChanged.addListener(handler);
  return () => chrome.storage.onChanged.removeListener(handler);
}
```

- [ ] **Step 5: 实现 navState.ts**

```ts
import { NAV_STATE_KEY } from './constants';
import type { NavState } from '@/types';

export async function loadNavState(): Promise<NavState | null> {
  const got = await chrome.storage.local.get(NAV_STATE_KEY);
  return (got[NAV_STATE_KEY] as NavState) ?? null;
}

export async function saveNavState(state: NavState): Promise<void> {
  await chrome.storage.local.set({ [NAV_STATE_KEY]: state });
}
```

- [ ] **Step 6: 运行验证通过 & 提交**

Run: `npm test -- settings navState`
Expected: PASS。

```bash
git add -A
git commit -m "feat: settings 与 navState 存取 + 测试"
```

---

## Task 10：thumbnails.ts IndexedDB（TDD）

**Files:**
- Create: `src/lib/thumbnails.ts`
- Test: `src/lib/thumbnails.test.ts`

- [ ] **Step 1: 写失败测试**

`src/lib/thumbnails.test.ts`：

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { getThumbnail, putThumbnail, deleteThumbnail } from './thumbnails';

beforeEach(async () => {
  indexedDB = new IDBFactory();
});

describe('thumbnails', () => {
  it('returns undefined when missing', async () => {
    expect(await getThumbnail('https://x.com')).toBeUndefined();
  });
  it('puts and gets a record', async () => {
    await putThumbnail({ url: 'https://x.com', dataUrl: 'data:...', capturedAt: 123 });
    const rec = await getThumbnail('https://x.com');
    expect(rec?.dataUrl).toBe('data:...');
  });
  it('deletes a record', async () => {
    await putThumbnail({ url: 'https://x.com', dataUrl: 'd', capturedAt: 1 });
    await deleteThumbnail('https://x.com');
    expect(await getThumbnail('https://x.com')).toBeUndefined();
  });
});
```

> 注：`fake-indexeddb/auto` 提供全局 `indexedDB` 与 `IDBFactory`。TS 若报未定义，在测试文件顶部加 `declare let indexedDB: IDBFactory;`。

- [ ] **Step 2: 运行验证失败**

Run: `npm test -- thumbnails`
Expected: FAIL。

- [ ] **Step 3: 实现**

`src/lib/thumbnails.ts`：

```ts
import { THUMB_DB_NAME, THUMB_DB_VERSION, THUMB_STORE, ASSET_STORE } from './constants';
import type { ThumbnailRecord } from '@/types';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(THUMB_DB_NAME, THUMB_DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(THUMB_STORE)) {
        db.createObjectStore(THUMB_STORE, { keyPath: 'url' });
      }
      if (!db.objectStoreNames.contains(ASSET_STORE)) {
        db.createObjectStore(ASSET_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then((db) => new Promise<T>((resolve, reject) => {
    const t = db.transaction(store, mode);
    const req = fn(t.objectStore(store));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }));
}

export async function getThumbnail(url: string): Promise<ThumbnailRecord | undefined> {
  return tx<ThumbnailRecord | undefined>(THUMB_STORE, 'readonly', (s) => s.get(url) as IDBRequest<ThumbnailRecord | undefined>);
}

export async function putThumbnail(rec: ThumbnailRecord): Promise<void> {
  await tx(THUMB_STORE, 'readwrite', (s) => s.put(rec));
}

export async function deleteThumbnail(url: string): Promise<void> {
  await tx(THUMB_STORE, 'readwrite', (s) => s.delete(url));
}

export async function putAsset(key: string, blob: Blob): Promise<void> {
  await tx(ASSET_STORE, 'readwrite', (s) => s.put(blob, key));
}

export async function getAsset(key: string): Promise<Blob | undefined> {
  return tx<Blob | undefined>(ASSET_STORE, 'readonly', (s) => s.get(key) as IDBRequest<Blob | undefined>);
}
```

- [ ] **Step 4: 运行验证通过 & 提交**

Run: `npm test -- thumbnails`
Expected: PASS。

```bash
git add -A
git commit -m "feat: thumbnails/assets IndexedDB 存取 + 测试"
```

---

# Phase 2：新标签页只读渲染

## Task 11：favicon.ts 工具（TDD）

**Files:**
- Create: `src/lib/favicon.ts`
- Test: `src/lib/favicon.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { installChromeMock } from '../../tests/setup';
import { faviconUrl, firstLetter, colorFromString } from './favicon';

beforeEach(() => { installChromeMock(); });

describe('favicon utils', () => {
  it('faviconUrl builds chrome _favicon url', () => {
    const u = faviconUrl('https://github.com', 32);
    expect(u).toContain('/_favicon/');
    expect(u).toContain('pageUrl=https%3A%2F%2Fgithub.com');
    expect(u).toContain('size=32');
  });
  it('firstLetter returns uppercase first char of host', () => {
    expect(firstLetter('https://github.com')).toBe('G');
    expect(firstLetter('not a url')).toBe('N');
  });
  it('colorFromString is deterministic hsl', () => {
    expect(colorFromString('abc')).toBe(colorFromString('abc'));
    expect(colorFromString('abc')).toMatch(/^hsl\(/);
  });
});
```

- [ ] **Step 2: 运行验证失败**

Run: `npm test -- favicon`
Expected: FAIL。

- [ ] **Step 3: 实现**

`src/lib/favicon.ts`：

```ts
export function faviconUrl(pageUrl: string, size = 32): string {
  const url = new URL(chrome.runtime.getURL('/_favicon/'));
  url.searchParams.set('pageUrl', pageUrl);
  url.searchParams.set('size', String(size));
  return url.toString();
}

export function firstLetter(pageUrl: string): string {
  try {
    return new URL(pageUrl).hostname.replace(/^www\./, '').charAt(0).toUpperCase() || '?';
  } catch {
    return (pageUrl.trim().charAt(0) || '?').toUpperCase();
  }
}

export function colorFromString(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 55%, 45%)`;
}
```

- [ ] **Step 4: 运行验证通过 & 提交**

Run: `npm test -- favicon`
Expected: PASS。

```bash
git add -A
git commit -m "feat: favicon/首字母/主题色工具 + 测试"
```

---

## Task 12：useBookmarkTree hook（TDD）

**Files:**
- Create: `src/newtab/hooks/useBookmarkTree.ts`
- Test: `src/newtab/hooks/useBookmarkTree.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { installChromeMock, type ChromeMock } from '../../../tests/setup';
import { useBookmarkTree } from './useBookmarkTree';

let c: ChromeMock;
beforeEach(() => { c = installChromeMock(); });

describe('useBookmarkTree', () => {
  it('loads subtree for rootId', async () => {
    c.bookmarks.getSubTree.mockResolvedValue([{ id: 'r', title: 'R', children: [] }]);
    const { result } = renderHook(() => useBookmarkTree('r'));
    await waitFor(() => expect(result.current.root?.id).toBe('r'));
  });
  it('reloads on bookmark change event', async () => {
    c.bookmarks.getSubTree.mockResolvedValue([{ id: 'r', title: 'R', children: [] }]);
    const { result } = renderHook(() => useBookmarkTree('r'));
    await waitFor(() => expect(result.current.root).toBeTruthy());
    c.bookmarks.getSubTree.mockResolvedValue([{ id: 'r', title: 'R2', children: [] }]);
    act(() => { c.bookmarks.onChanged._emit(); });
    await waitFor(() => expect(result.current.root?.title).toBe('R2'));
  });
  it('handles null rootId as no-op', async () => {
    const { result } = renderHook(() => useBookmarkTree(null));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.root).toBeNull();
  });
});
```

- [ ] **Step 2: 运行验证失败**

Run: `npm test -- useBookmarkTree`
Expected: FAIL。

- [ ] **Step 3: 实现**

`src/newtab/hooks/useBookmarkTree.ts`：

```ts
import { useCallback, useEffect, useState } from 'react';
import { getSubTree, onBookmarksChanged } from '@/lib/bookmarks';
import type { BookmarkNode } from '@/types';

export function useBookmarkTree(rootId: string | null) {
  const [root, setRoot] = useState<BookmarkNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!rootId) { setRoot(null); setLoading(false); return; }
    setLoading(true);
    try {
      setRoot(await getSubTree(rootId));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setRoot(null);
    } finally {
      setLoading(false);
    }
  }, [rootId]);

  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => onBookmarksChanged(() => { void reload(); }), [reload]);

  return { root, loading, error, reload };
}
```

- [ ] **Step 4: 运行验证通过 & 提交**

Run: `npm test -- useBookmarkTree`
Expected: PASS。

```bash
git add -A
git commit -m "feat: useBookmarkTree（加载+事件回流）+ 测试"
```

---

## Task 13：useSettings 与 useNavState hooks

**Files:**
- Create: `src/newtab/hooks/useSettings.ts`, `src/newtab/hooks/useNavState.ts`
- Test: `src/newtab/hooks/useSettings.test.ts`

- [ ] **Step 1: 写失败测试（useSettings）**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { installChromeMock } from '../../../tests/setup';
import { useSettings } from './useSettings';

beforeEach(() => { installChromeMock(); });

describe('useSettings', () => {
  it('loads defaults then updates', async () => {
    const { result } = renderHook(() => useSettings());
    await waitFor(() => expect(result.current.settings).toBeTruthy());
    expect(result.current.settings!.columns).toBe(6);
    await act(async () => { await result.current.update({ columns: 9 }); });
    await waitFor(() => expect(result.current.settings!.columns).toBe(9));
  });
});
```

- [ ] **Step 2: 运行验证失败**

Run: `npm test -- useSettings`
Expected: FAIL。

- [ ] **Step 3: 实现 useSettings.ts**

```ts
import { useCallback, useEffect, useState } from 'react';
import { loadSettings, saveSettings, onSettingsChanged } from '@/lib/settings';
import type { Settings } from '@/types';

export function useSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => { void loadSettings().then(setSettings); }, []);
  useEffect(() => onSettingsChanged(setSettings), []);

  const update = useCallback(async (patch: Partial<Settings>) => {
    setSettings(await saveSettings(patch));
  }, []);

  return { settings, update };
}
```

- [ ] **Step 4: 实现 useNavState.ts**

```ts
import { useCallback, useEffect, useState } from 'react';
import { loadNavState, saveNavState } from '@/lib/navState';
import type { NavState } from '@/types';

export function useNavState(enabled: boolean) {
  const [navState, setNavStateInternal] = useState<NavState | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!enabled) { setReady(true); return; }
    void loadNavState().then((s) => { setNavStateInternal(s); setReady(true); });
  }, [enabled]);

  const persist = useCallback((s: NavState) => {
    setNavStateInternal(s);
    if (enabled) void saveNavState(s);
  }, [enabled]);

  return { navState, persist, ready };
}
```

- [ ] **Step 5: 运行验证通过 & 提交**

Run: `npm test -- useSettings`
Expected: PASS。

```bash
git add -A
git commit -m "feat: useSettings 与 useNavState hooks"
```

---

## Task 14：TabBar 组件（TDD）

**Files:**
- Create: `src/newtab/components/TabBar.tsx`
- Test: `src/newtab/components/TabBar.test.tsx`

- [ ] **Step 1: 写失败测试**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TabBar } from './TabBar';
import { HOME_TAB_ID } from '@/lib/constants';

const tabs = [
  { id: HOME_TAB_ID, title: '主页', isHome: true },
  { id: 'f1', title: '工作', isHome: false },
];

describe('TabBar', () => {
  it('renders tabs and marks active', () => {
    render(<TabBar tabs={tabs} activeTabId="f1" onSelect={() => {}} />);
    expect(screen.getByRole('tab', { name: '工作' })).toHaveAttribute('aria-selected', 'true');
  });
  it('calls onSelect on click', async () => {
    const onSelect = vi.fn();
    render(<TabBar tabs={tabs} activeTabId="f1" onSelect={onSelect} />);
    await userEvent.click(screen.getByRole('tab', { name: '主页' }));
    expect(onSelect).toHaveBeenCalledWith(HOME_TAB_ID);
  });
  it('renders nothing when only Home tab', () => {
    const { container } = render(
      <TabBar tabs={[{ id: HOME_TAB_ID, title: '主页', isHome: true }]} activeTabId={HOME_TAB_ID} onSelect={() => {}} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: 运行验证失败**

Run: `npm test -- TabBar`
Expected: FAIL。

- [ ] **Step 3: 实现**

`src/newtab/components/TabBar.tsx`：

```tsx
import type { TabModel } from '@/types';

interface Props {
  tabs: TabModel[];
  activeTabId: string;
  onSelect: (id: string) => void;
}

export function TabBar({ tabs, activeTabId, onSelect }: Props) {
  const onlyHome = tabs.length === 1 && tabs[0].isHome;
  if (tabs.length === 0 || onlyHome) return null;
  return (
    <div className="tabbar" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={t.id === activeTabId}
          className={`tab ${t.id === activeTabId ? 'tab--active' : ''}`}
          onClick={() => onSelect(t.id)}
        >
          {t.title}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: 运行验证通过 & 提交**

Run: `npm test -- TabBar`
Expected: PASS。

```bash
git add -A
git commit -m "feat: TabBar 组件 + 测试"
```

---

## Task 15：Tile 与 FolderTile 组件（TDD）

**Files:**
- Create: `src/newtab/components/Tile.tsx`, `src/newtab/components/FolderTile.tsx`
- Test: `src/newtab/components/Tile.test.tsx`

- [ ] **Step 1: 写失败测试**

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { installChromeMock } from '../../../tests/setup';
import { Tile } from './Tile';
import { FolderTile } from './FolderTile';

beforeEach(() => { installChromeMock(); });

describe('Tile', () => {
  it('renders title and triggers onOpen', async () => {
    const onOpen = vi.fn();
    render(<Tile id="b" title="GitHub" url="https://github.com" onOpen={onOpen} onContextMenu={() => {}} />);
    expect(screen.getByText('GitHub')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /GitHub/ }));
    expect(onOpen).toHaveBeenCalledWith('https://github.com');
  });
});

describe('FolderTile', () => {
  it('renders folder title and triggers onEnter', async () => {
    const onEnter = vi.fn();
    render(<FolderTile id="f" title="工作" preview={['https://a.com']} onEnter={onEnter} onContextMenu={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /工作/ }));
    expect(onEnter).toHaveBeenCalledWith('f');
  });
});
```

- [ ] **Step 2: 运行验证失败**

Run: `npm test -- Tile`
Expected: FAIL。

- [ ] **Step 3: 实现 Tile.tsx**

```tsx
import { useState } from 'react';
import { faviconUrl, firstLetter, colorFromString } from '@/lib/favicon';

interface Props {
  id: string;
  title: string;
  url: string;
  thumbnail?: string;
  onOpen: (url: string) => void;
  onContextMenu: (e: React.MouseEvent, id: string) => void;
}

export function Tile({ id, title, url, thumbnail, onOpen, onContextMenu }: Props) {
  const [imgOk, setImgOk] = useState(true);
  return (
    <button
      className="tile"
      onClick={() => onOpen(url)}
      onContextMenu={(e) => onContextMenu(e, id)}
      title={title}
    >
      <div className="tile__thumb">
        {thumbnail ? (
          <img src={thumbnail} alt="" className="tile__screenshot" />
        ) : imgOk ? (
          <img src={faviconUrl(url, 64)} alt="" className="tile__favicon" onError={() => setImgOk(false)} />
        ) : (
          <span className="tile__letter" style={{ background: colorFromString(url) }}>{firstLetter(url)}</span>
        )}
      </div>
      <span className="tile__label">{title}</span>
    </button>
  );
}
```

- [ ] **Step 4: 实现 FolderTile.tsx**

```tsx
import { faviconUrl } from '@/lib/favicon';

interface Props {
  id: string;
  title: string;
  preview: string[];
  onEnter: (id: string) => void;
  onContextMenu: (e: React.MouseEvent, id: string) => void;
}

export function FolderTile({ id, title, preview, onEnter, onContextMenu }: Props) {
  return (
    <button
      className="tile tile--folder"
      onClick={() => onEnter(id)}
      onContextMenu={(e) => onContextMenu(e, id)}
      title={title}
    >
      <div className="tile__thumb tile__folder-grid">
        {preview.slice(0, 4).map((u) => (
          <img key={u} src={faviconUrl(u, 32)} alt="" />
        ))}
      </div>
      <span className="tile__label">📁 {title}</span>
    </button>
  );
}
```

- [ ] **Step 5: 运行验证通过 & 提交**

Run: `npm test -- Tile`
Expected: PASS。

```bash
git add -A
git commit -m "feat: Tile 与 FolderTile 组件 + 测试"
```

---

## Task 16：Grid 与 Breadcrumb 组件（TDD）

**Files:**
- Create: `src/newtab/components/Grid.tsx`, `src/newtab/components/Breadcrumb.tsx`
- Test: `src/newtab/components/Grid.test.tsx`

- [ ] **Step 1: 写失败测试**

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { installChromeMock } from '../../../tests/setup';
import { Grid } from './Grid';
import { Breadcrumb } from './Breadcrumb';
import type { SpeedDialItem } from '@/types';

beforeEach(() => { installChromeMock(); });

const items: SpeedDialItem[] = [
  { kind: 'bookmark', id: 'b', title: 'GitHub', url: 'https://github.com', index: 0 },
  { kind: 'folder', id: 'f', title: '工作', index: 1, childrenPreview: [] },
];

describe('Grid', () => {
  it('renders bookmarks and folders, wires callbacks', async () => {
    const onOpen = vi.fn();
    const onEnter = vi.fn();
    render(<Grid items={items} columns={6} thumbnails={{}} onOpen={onOpen} onEnter={onEnter} onContextMenu={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /GitHub/ }));
    await userEvent.click(screen.getByRole('button', { name: /工作/ }));
    expect(onOpen).toHaveBeenCalledWith('https://github.com');
    expect(onEnter).toHaveBeenCalledWith('f');
  });
});

describe('Breadcrumb', () => {
  it('renders crumbs and triggers navigation on non-last', async () => {
    const onGo = vi.fn();
    render(<Breadcrumb crumbs={[{ id: 'root', title: '根' }, { id: 'f', title: '工作' }]} onGo={onGo} />);
    await userEvent.click(screen.getByRole('button', { name: '根' }));
    expect(onGo).toHaveBeenCalledWith('root');
  });
  it('renders nothing when single crumb', () => {
    const { container } = render(<Breadcrumb crumbs={[{ id: 'root', title: '根' }]} onGo={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: 运行验证失败**

Run: `npm test -- Grid`
Expected: FAIL。

- [ ] **Step 3: 实现 Grid.tsx**

```tsx
import type { SpeedDialItem } from '@/types';
import { Tile } from './Tile';
import { FolderTile } from './FolderTile';

interface Props {
  items: SpeedDialItem[];
  columns: number;
  thumbnails: Record<string, string>;
  onOpen: (url: string) => void;
  onEnter: (id: string) => void;
  onContextMenu: (e: React.MouseEvent, id: string) => void;
}

export function Grid({ items, columns, thumbnails, onOpen, onEnter, onContextMenu }: Props) {
  return (
    <div className="grid" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
      {items.map((it) =>
        it.kind === 'bookmark' ? (
          <Tile key={it.id} id={it.id} title={it.title} url={it.url} thumbnail={thumbnails[it.url]} onOpen={onOpen} onContextMenu={onContextMenu} />
        ) : (
          <FolderTile key={it.id} id={it.id} title={it.title} preview={it.childrenPreview} onEnter={onEnter} onContextMenu={onContextMenu} />
        ),
      )}
    </div>
  );
}
```

- [ ] **Step 4: 实现 Breadcrumb.tsx**

```tsx
import type { Crumb } from '@/types';

interface Props {
  crumbs: Crumb[];
  onGo: (id: string) => void;
}

export function Breadcrumb({ crumbs, onGo }: Props) {
  if (crumbs.length <= 1) return null;
  return (
    <nav className="breadcrumb" aria-label="breadcrumb">
      {crumbs.map((c, i) => {
        const isLast = i === crumbs.length - 1;
        return (
          <span key={c.id} className="breadcrumb__item">
            {isLast ? (
              <span className="breadcrumb__current">{c.title}</span>
            ) : (
              <>
                <button className="breadcrumb__link" onClick={() => onGo(c.id)}>{c.title}</button>
                <span className="breadcrumb__sep"> › </span>
              </>
            )}
          </span>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 5: 运行验证通过 & 提交**

Run: `npm test -- Grid`
Expected: PASS。

```bash
git add -A
git commit -m "feat: Grid 与 Breadcrumb 组件 + 测试"
```

---

## Task 17：EmptyState 与 Guidance 组件

**Files:**
- Create: `src/newtab/components/EmptyState.tsx`, `src/newtab/components/Guidance.tsx`
- Test: `src/newtab/components/States.test.tsx`

- [ ] **Step 1: 写失败测试**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EmptyState } from './EmptyState';
import { Guidance } from './Guidance';

describe('states', () => {
  it('EmptyState shows message and add button', async () => {
    const onAdd = vi.fn();
    render(<EmptyState onAdd={onAdd} />);
    expect(screen.getByText(/还没有书签/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /新增/ }));
    expect(onAdd).toHaveBeenCalled();
  });
  it('Guidance opens options', async () => {
    const onOpen = vi.fn();
    render(<Guidance onOpenOptions={onOpen} />);
    await userEvent.click(screen.getByRole('button', { name: /选择目录/ }));
    expect(onOpen).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 运行验证失败**

Run: `npm test -- States`
Expected: FAIL。

- [ ] **Step 3: 实现两个组件**

`src/newtab/components/EmptyState.tsx`：

```tsx
interface Props { onAdd: () => void; }
export function EmptyState({ onAdd }: Props) {
  return (
    <div className="empty">
      <p>这个目录还没有书签</p>
      <button className="btn" onClick={onAdd}>+ 新增书签</button>
    </div>
  );
}
```

`src/newtab/components/Guidance.tsx`：

```tsx
interface Props { onOpenOptions: () => void; }
export function Guidance({ onOpenOptions }: Props) {
  return (
    <div className="guidance">
      <h1>Real Speed Dial</h1>
      <p>请先选择一个书签目录作为首页内容来源。</p>
      <button className="btn btn--primary" onClick={onOpenOptions}>选择目录</button>
    </div>
  );
}
```

- [ ] **Step 4: 运行验证通过 & 提交**

Run: `npm test -- States`
Expected: PASS。

```bash
git add -A
git commit -m "feat: EmptyState 与 Guidance 组件 + 测试"
```

---

## Task 18：App 组装（导航/切 Tab/钻入/面包屑/后退）（TDD）

**Files:**
- Modify: `src/newtab/App.tsx`
- Create: `src/newtab/styles.css`
- Test: `src/newtab/App.test.tsx`

- [ ] **Step 1: 写失败测试**

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { installChromeMock, type ChromeMock } from '../../tests/setup';
import App from './App';
import { SETTINGS_KEY } from '@/lib/constants';

let c: ChromeMock;
const tree = { id: 'root', title: '根', children: [
  { id: 'b1', title: 'GitHub', url: 'https://github.com', index: 0 },
  { id: 'f1', title: '工作', index: 1, children: [
    { id: 'b2', title: 'Jira', url: 'https://jira.com', index: 0 },
    { id: 'f2', title: '后端', index: 1, children: [
      { id: 'b3', title: 'MySQL', url: 'https://mysql.com', index: 0 },
    ] },
  ] },
] };

beforeEach(async () => {
  c = installChromeMock();
  await c.storage.sync.set({ [SETTINGS_KEY]: { rootFolderId: 'root' } });
  c.bookmarks.getSubTree.mockResolvedValue([tree]);
});

describe('App navigation', () => {
  it('shows Home tab bookmarks by default', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByText('GitHub')).toBeInTheDocument());
  });
  it('switches tab to show subfolder contents (folder stays root)', async () => {
    render(<App />);
    await screen.findByRole('tab', { name: '工作' });
    await userEvent.click(screen.getByRole('tab', { name: '工作' }));
    await waitFor(() => expect(screen.getByText('Jira')).toBeInTheDocument());
    expect(screen.getByText(/📁 后端/)).toBeInTheDocument();
  });
  it('drills into folder tile (recursive replace) and shows breadcrumb', async () => {
    render(<App />);
    await screen.findByRole('tab', { name: '工作' });
    await userEvent.click(screen.getByRole('tab', { name: '工作' }));
    await userEvent.click(await screen.findByRole('button', { name: /📁 后端/ }));
    await waitFor(() => expect(screen.getByText('MySQL')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: '根' })).toBeInTheDocument();
  });
  it('shows guidance when no root selected', async () => {
    await c.storage.sync.set({ [SETTINGS_KEY]: { rootFolderId: null } });
    render(<App />);
    await waitFor(() => expect(screen.getByRole('button', { name: /选择目录/ })).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: 运行验证失败**

Run: `npm test -- App`
Expected: FAIL。

- [ ] **Step 3: 实现 App.tsx**

```tsx
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSettings } from './hooks/useSettings';
import { useBookmarkTree } from './hooks/useBookmarkTree';
import { useNavState } from './hooks/useNavState';
import { buildFolderView } from '@/lib/mapping';
import { HOME_TAB_ID } from '@/lib/constants';
import { TabBar } from './components/TabBar';
import { Grid } from './components/Grid';
import { Breadcrumb } from './components/Breadcrumb';
import { EmptyState } from './components/EmptyState';
import { Guidance } from './components/Guidance';
import './styles.css';

export default function App() {
  const { settings } = useSettings();
  const rootId = settings?.rootFolderId ?? null;
  const { root, loading } = useBookmarkTree(rootId);
  const { navState, persist, ready } = useNavState(settings?.restoreLastPosition ?? true);

  const [folderId, setFolderId] = useState<string | null>(null);
  const [tabId, setTabId] = useState<string>(HOME_TAB_ID);

  // 初始化：优先恢复 navState（若开启且有效），否则用根
  useEffect(() => {
    if (!root || !ready || folderId !== null) return;
    const restored = settings?.restoreLastPosition ? navState : null;
    const initialFolder = restored?.currentFolderId ?? root.id;
    const initialTab = restored?.selectedTabId ?? HOME_TAB_ID;
    setFolderId(initialFolder);
    setTabId(initialTab);
  }, [root, ready, navState, settings, folderId]);

  const view = useMemo(() => {
    if (!root || folderId === null) return null;
    return buildFolderView(root, folderId, tabId);
  }, [root, folderId, tabId]);

  const navigate = useCallback((nextFolderId: string, nextTabId: string, push: boolean) => {
    setFolderId(nextFolderId);
    setTabId(nextTabId);
    persist({ currentFolderId: nextFolderId, selectedTabId: nextTabId });
    if (push) history.pushState({ folderId: nextFolderId, tabId: nextTabId }, '');
  }, [persist]);

  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      const s = e.state as { folderId?: string; tabId?: string } | null;
      if (s?.folderId) { setFolderId(s.folderId); setTabId(s.tabId ?? HOME_TAB_ID); }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const openUrl = useCallback((url: string) => {
    if (settings?.openInNewTab) window.open(url, '_blank');
    else window.location.href = url;
  }, [settings]);

  const openOptions = useCallback(() => chrome.runtime.openOptionsPage(), []);

  if (!settings || loading) return <div className="loading" />;
  if (!rootId) return <Guidance onOpenOptions={openOptions} />;
  if (!view) return <div className="loading" />;

  return (
    <div className="app">
      <Breadcrumb crumbs={view.breadcrumb} onGo={(id) => navigate(id, HOME_TAB_ID, true)} />
      <TabBar tabs={view.tabs} activeTabId={view.activeTabId} onSelect={(id) => navigate(view.folderId, id, true)} />
      {view.items.length === 0 ? (
        <EmptyState onAdd={() => openOptions()} />
      ) : (
        <Grid
          items={view.items}
          columns={settings.columns}
          thumbnails={{}}
          onOpen={openUrl}
          onEnter={(id) => navigate(id, HOME_TAB_ID, true)}
          onContextMenu={() => {}}
        />
      )}
    </div>
  );
}
```

> 注：`chrome.runtime.openOptionsPage` 需在测试 mock 中补充。为此在 `tests/setup.ts` 的 `runtime` 上加 `openOptionsPage: vi.fn()`（现在补上）。

- [ ] **Step 4: 更新 chrome mock 补 openOptionsPage**

修改 `tests/setup.ts`，`runtime` 对象改为：

```ts
runtime: { getURL: (p: string) => `chrome-extension://test${p}`, openOptionsPage: vi.fn(), lastError: undefined as unknown },
```

- [ ] **Step 5: 写最小 styles.css**

`src/newtab/styles.css`：

```css
:root { color-scheme: dark; }
* { box-sizing: border-box; }
body { margin: 0; font-family: system-ui, -apple-system, "PingFang SC", sans-serif; background: #1e2130; color: #e8eaed; }
.app { max-width: 1100px; margin: 0 auto; padding: 48px 24px; }
.loading { min-height: 100vh; }
.tabbar { display: flex; gap: 8px; margin-bottom: 20px; flex-wrap: wrap; }
.tab { padding: 6px 14px; border: none; border-radius: 8px; background: #2a2e42; color: #cbd2e0; cursor: pointer; font-size: 14px; }
.tab--active { background: #4a9eff; color: #fff; }
.breadcrumb { margin-bottom: 12px; font-size: 13px; color: #9aa4bf; }
.breadcrumb__link { background: none; border: none; color: #7db0ff; cursor: pointer; padding: 0; font-size: 13px; }
.breadcrumb__current { color: #e8eaed; }
.grid { display: grid; gap: 16px; }
.tile { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 14px; border: none; border-radius: 12px; background: #2a2e42; color: #e8eaed; cursor: pointer; }
.tile:hover { background: #333852; }
.tile__thumb { width: 100%; aspect-ratio: 4 / 3; display: flex; align-items: center; justify-content: center; }
.tile__favicon { width: 40px; height: 40px; }
.tile__screenshot { width: 100%; height: 100%; object-fit: cover; border-radius: 8px; }
.tile__letter { width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 22px; color: #fff; }
.tile__folder-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; width: 60%; }
.tile__folder-grid img { width: 100%; }
.tile__label { font-size: 13px; text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; }
.empty, .guidance { text-align: center; padding: 80px 0; color: #9aa4bf; }
.btn { padding: 8px 16px; border: none; border-radius: 8px; background: #2a2e42; color: #e8eaed; cursor: pointer; }
.btn--primary { background: #4a9eff; color: #fff; }
```

- [ ] **Step 6: 运行验证通过**

Run: `npm test -- App`
Expected: PASS（全部 4 用例）。

- [ ] **Step 7: 构建 + 手动验证 + 提交**

Run: `npm run build`
Expected: 构建成功。手动：`chrome://extensions` 刷新扩展，先在书签管理器建一个含子目录的目录，暂时无法选目录（下个 Phase 才有设置页），可跳过手动此步。

```bash
git add -A
git commit -m "feat: App 组装（切Tab/递归钻入/面包屑/后退键/引导）+ 测试"
```

---

# Phase 3：设置页与根目录选择

## Task 19：FolderTreeSelect 组件（TDD）

**Files:**
- Create: `src/options/components/FolderTreeSelect.tsx`
- Test: `src/options/components/FolderTreeSelect.test.tsx`

- [ ] **Step 1: 写失败测试**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FolderTreeSelect } from './FolderTreeSelect';
import type { BookmarkNode } from '@/types';

const tree: BookmarkNode = { id: '0', title: '', children: [
  { id: '1', title: '书签栏', children: [
    { id: 'f1', title: '工作', children: [] },
    { id: 'b1', title: 'GitHub', url: 'https://github.com' },
  ] },
] };

describe('FolderTreeSelect', () => {
  it('lists only folders and selects on click', async () => {
    const onSelect = vi.fn();
    render(<FolderTreeSelect tree={tree} selectedId={null} onSelect={onSelect} />);
    expect(screen.getByRole('button', { name: '工作' })).toBeInTheDocument();
    expect(screen.queryByText('GitHub')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '工作' }));
    expect(onSelect).toHaveBeenCalledWith('f1');
  });
});
```

- [ ] **Step 2: 运行验证失败**

Run: `npm test -- FolderTreeSelect`
Expected: FAIL。

- [ ] **Step 3: 实现**

`src/options/components/FolderTreeSelect.tsx`：

```tsx
import type { BookmarkNode } from '@/types';

interface Props {
  tree: BookmarkNode;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function FolderNode({ node, depth, selectedId, onSelect }: { node: BookmarkNode; depth: number; selectedId: string | null; onSelect: (id: string) => void; }) {
  const subfolders = (node.children ?? []).filter((c) => c.url === undefined);
  return (
    <div>
      {node.title && (
        <button
          className={`folder-row ${selectedId === node.id ? 'folder-row--selected' : ''}`}
          style={{ paddingLeft: depth * 16 + 8 }}
          onClick={() => onSelect(node.id)}
        >
          📁 {node.title}
        </button>
      )}
      {subfolders.map((sf) => (
        <FolderNode key={sf.id} node={sf} depth={node.title ? depth + 1 : depth} selectedId={selectedId} onSelect={onSelect} />
      ))}
    </div>
  );
}

export function FolderTreeSelect({ tree, selectedId, onSelect }: Props) {
  return <div className="folder-tree">{(tree.children ?? []).map((c) => (
    <FolderNode key={c.id} node={c} depth={0} selectedId={selectedId} onSelect={onSelect} />
  ))}</div>;
}
```

- [ ] **Step 4: 运行验证通过 & 提交**

Run: `npm test -- FolderTreeSelect`
Expected: PASS。

```bash
git add -A
git commit -m "feat: FolderTreeSelect 目录选择器 + 测试"
```

---

## Task 20：Options 页面组装（根目录 + 基础外观）（TDD）

**Files:**
- Modify: `src/options/Options.tsx`
- Create: `src/options/styles.css`
- Test: `src/options/Options.test.tsx`

- [ ] **Step 1: 写失败测试**

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { installChromeMock, type ChromeMock } from '../../tests/setup';
import Options from './Options';
import { SETTINGS_KEY } from '@/lib/constants';

let c: ChromeMock;
beforeEach(() => {
  c = installChromeMock();
  c.bookmarks.getTree.mockResolvedValue([{ id: '0', title: '', children: [
    { id: '1', title: '书签栏', children: [{ id: 'f1', title: '工作', children: [] }] },
  ] }]);
});

describe('Options', () => {
  it('selects a root folder and persists to settings', async () => {
    render(<Options />);
    await userEvent.click(await screen.findByRole('button', { name: '工作' }));
    await waitFor(async () => {
      const got = await c.storage.sync.get(SETTINGS_KEY);
      expect((got[SETTINGS_KEY] as { rootFolderId: string }).rootFolderId).toBe('f1');
    });
  });

  it('changes tile style', async () => {
    render(<Options />);
    const select = await screen.findByLabelText('磁贴样式');
    await userEvent.selectOptions(select, 'themeColor');
    await waitFor(async () => {
      const got = await c.storage.sync.get(SETTINGS_KEY);
      expect((got[SETTINGS_KEY] as { tileStyle: string }).tileStyle).toBe('themeColor');
    });
  });
});
```

- [ ] **Step 2: 运行验证失败**

Run: `npm test -- Options`
Expected: FAIL。

- [ ] **Step 3: 实现 Options.tsx**

```tsx
import { useEffect, useState } from 'react';
import { getTree } from '@/lib/bookmarks';
import { loadSettings, saveSettings } from '@/lib/settings';
import type { BookmarkNode, Settings, TileStyle } from '@/types';
import { FolderTreeSelect } from './components/FolderTreeSelect';
import './styles.css';

export default function Options() {
  const [tree, setTree] = useState<BookmarkNode | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => { void getTree().then((t) => setTree(t[0])); }, []);
  useEffect(() => { void loadSettings().then(setSettings); }, []);

  const patch = async (p: Partial<Settings>) => setSettings(await saveSettings(p));

  if (!tree || !settings) return <div>加载中…</div>;

  return (
    <div className="options">
      <h1>Real Speed Dial 设置</h1>

      <section>
        <h2>根目录</h2>
        <p className="hint">选择一个书签目录作为首页内容来源。</p>
        <FolderTreeSelect tree={tree} selectedId={settings.rootFolderId} onSelect={(id) => void patch({ rootFolderId: id })} />
      </section>

      <section>
        <h2>外观</h2>
        <label className="field">
          <span>磁贴样式</span>
          <select aria-label="磁贴样式" value={settings.tileStyle} onChange={(e) => void patch({ tileStyle: e.target.value as TileStyle })}>
            <option value="favicon">图标 + 标题</option>
            <option value="themeColor">主题色背景</option>
            <option value="screenshot">网页截图</option>
          </select>
        </label>
        <label className="field">
          <span>主题</span>
          <select aria-label="主题" value={settings.theme} onChange={(e) => void patch({ theme: e.target.value as Settings['theme'] })}>
            <option value="system">跟随系统</option>
            <option value="light">浅色</option>
            <option value="dark">深色</option>
          </select>
        </label>
        <label className="field">
          <span>列数</span>
          <input type="number" min={3} max={12} value={settings.columns} onChange={(e) => void patch({ columns: Number(e.target.value) })} />
        </label>
        <label className="field">
          <span>在新标签页打开书签</span>
          <input type="checkbox" checked={settings.openInNewTab} onChange={(e) => void patch({ openInNewTab: e.target.checked })} />
        </label>
        <label className="field">
          <span>打开时恢复上次位置</span>
          <input type="checkbox" checked={settings.restoreLastPosition} onChange={(e) => void patch({ restoreLastPosition: e.target.checked })} />
        </label>
      </section>
    </div>
  );
}
```

- [ ] **Step 4: 写 styles.css**

`src/options/styles.css`：

```css
body { margin: 0; font-family: system-ui, "PingFang SC", sans-serif; background: #f6f7f9; color: #1c1e21; }
.options { max-width: 720px; margin: 0 auto; padding: 32px 24px; }
h1 { font-size: 22px; }
section { background: #fff; border-radius: 12px; padding: 20px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
h2 { font-size: 16px; margin-top: 0; }
.hint { color: #65676b; font-size: 13px; }
.field { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-top: 1px solid #eee; }
.folder-tree { max-height: 300px; overflow: auto; border: 1px solid #e4e6eb; border-radius: 8px; }
.folder-row { display: block; width: 100%; text-align: left; border: none; background: none; padding: 6px 8px; cursor: pointer; font-size: 14px; }
.folder-row:hover { background: #f0f2f5; }
.folder-row--selected { background: #e7f0ff; color: #1a73e8; }
```

- [ ] **Step 5: 运行验证通过**

Run: `npm test -- Options`
Expected: PASS。

- [ ] **Step 6: 构建 + 手动端到端验证 + 提交**

Run: `npm run build`；`chrome://extensions` 刷新扩展 → 右键扩展「选项」打开设置 → 选一个含子目录的目录 → 打开新标签页应看到平铺书签、Tab、可钻入。

```bash
git add -A
git commit -m "feat: 设置页（根目录选择 + 基础外观）+ 测试"
```

---

# Phase 4：书签编辑

## Task 21：EditDialog 与增删改写回（TDD）

**Files:**
- Create: `src/newtab/components/EditDialog.tsx`
- Modify: `src/newtab/App.tsx`
- Test: `src/newtab/components/EditDialog.test.tsx`

- [ ] **Step 1: 写失败测试**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EditDialog } from './EditDialog';

describe('EditDialog', () => {
  it('submits bookmark title and url', async () => {
    const onSubmit = vi.fn();
    render(<EditDialog mode="create-bookmark" initial={{ title: '', url: '' }} onSubmit={onSubmit} onCancel={() => {}} />);
    await userEvent.type(screen.getByLabelText('标题'), 'GitHub');
    await userEvent.type(screen.getByLabelText('网址'), 'https://github.com');
    await userEvent.click(screen.getByRole('button', { name: '保存' }));
    expect(onSubmit).toHaveBeenCalledWith({ title: 'GitHub', url: 'https://github.com' });
  });
  it('hides url field for folder mode', () => {
    render(<EditDialog mode="create-folder" initial={{ title: '' }} onSubmit={() => {}} onCancel={() => {}} />);
    expect(screen.queryByLabelText('网址')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 运行验证失败**

Run: `npm test -- EditDialog`
Expected: FAIL。

- [ ] **Step 3: 实现 EditDialog.tsx**

```tsx
import { useState } from 'react';

export type EditMode = 'create-bookmark' | 'create-folder' | 'edit-bookmark' | 'rename-folder';

interface Props {
  mode: EditMode;
  initial: { title: string; url?: string };
  onSubmit: (data: { title: string; url?: string }) => void;
  onCancel: () => void;
}

export function EditDialog({ mode, initial, onSubmit, onCancel }: Props) {
  const [title, setTitle] = useState(initial.title);
  const [url, setUrl] = useState(initial.url ?? '');
  const hasUrl = mode === 'create-bookmark' || mode === 'edit-bookmark';
  const titleMap: Record<EditMode, string> = {
    'create-bookmark': '新增书签', 'create-folder': '新增文件夹',
    'edit-bookmark': '编辑书签', 'rename-folder': '重命名文件夹',
  };
  return (
    <div className="dialog-backdrop" onClick={onCancel}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h3>{titleMap[mode]}</h3>
        <label className="dialog-field"><span>标题</span>
          <input aria-label="标题" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
        </label>
        {hasUrl && (
          <label className="dialog-field"><span>网址</span>
            <input aria-label="网址" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" />
          </label>
        )}
        <div className="dialog-actions">
          <button className="btn" onClick={onCancel}>取消</button>
          <button className="btn btn--primary" onClick={() => onSubmit(hasUrl ? { title, url } : { title })}>保存</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: 运行验证通过**

Run: `npm test -- EditDialog`
Expected: PASS。

- [ ] **Step 5: 在 App 接入编辑动作（新增/重命名/删除）**

在 `src/newtab/App.tsx` 顶部 import 追加：

```tsx
import { EditDialog, type EditMode } from './components/EditDialog';
import { createBookmark, updateBookmark, removeBookmark, removeFolder } from '@/lib/bookmarks';
```

在 `App` 组件内、`return` 之前追加对话框状态与处理：

```tsx
  const [dialog, setDialog] = useState<{ mode: EditMode; targetId?: string; initial: { title: string; url?: string } } | null>(null);

  const submitDialog = useCallback(async (data: { title: string; url?: string }) => {
    if (!dialog || folderId === null) return;
    if (dialog.mode === 'create-bookmark') await createBookmark(folderId, data.title, data.url);
    else if (dialog.mode === 'create-folder') await createBookmark(folderId, data.title);
    else if (dialog.mode === 'edit-bookmark' && dialog.targetId) await updateBookmark(dialog.targetId, { title: data.title, url: data.url });
    else if (dialog.mode === 'rename-folder' && dialog.targetId) await updateBookmark(dialog.targetId, { title: data.title });
    setDialog(null);
  }, [dialog, folderId]);
```

> 说明：`createBookmark(parentId, title)`（不传 url）即创建文件夹。删除在 ContextMenu 任务里接入 `removeBookmark`/`removeFolder`。为让「+ 新增」可用，将 `EmptyState` 与工具栏的新增按钮指向 `setDialog`。

把 `EmptyState` 的 `onAdd` 与新增入口改为：

```tsx
      {view.items.length === 0 ? (
        <EmptyState onAdd={() => setDialog({ mode: 'create-bookmark', initial: { title: '', url: '' } })} />
      ) : (
        /* Grid 保持不变 */
      )}
```

并在 `.app` 容器末尾（`</div>` 前）渲染对话框与一个「+」按钮：

```tsx
      <button className="fab" onClick={() => setDialog({ mode: 'create-bookmark', initial: { title: '', url: '' } })}>＋</button>
      {dialog && <EditDialog mode={dialog.mode} initial={dialog.initial} onSubmit={submitDialog} onCancel={() => setDialog(null)} />}
```

- [ ] **Step 6: 追加对话框样式**

在 `src/newtab/styles.css` 末尾追加：

```css
.fab { position: fixed; right: 24px; bottom: 24px; width: 48px; height: 48px; border-radius: 50%; border: none; background: #4a9eff; color: #fff; font-size: 24px; cursor: pointer; }
.dialog-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.5); display: flex; align-items: center; justify-content: center; }
.dialog { background: #262a3d; padding: 20px; border-radius: 12px; width: 360px; }
.dialog h3 { margin-top: 0; }
.dialog-field { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
.dialog-field input { padding: 8px; border-radius: 6px; border: 1px solid #3a3f57; background: #1e2130; color: #e8eaed; }
.dialog-actions { display: flex; justify-content: flex-end; gap: 8px; }
```

- [ ] **Step 7: 运行全部测试 + 构建 + 提交**

Run: `npm test` 然后 `npm run build`
Expected: 全绿、构建成功。事件回流已由 `useBookmarkTree` 的 `onBookmarksChanged` 保证，编辑后 UI 自动刷新。

```bash
git add -A
git commit -m "feat: EditDialog 与新增/重命名/编辑写回书签"
```

---

## Task 22：ContextMenu（右键：编辑/删除/新标签打开/刷新缩略图占位）（TDD）

**Files:**
- Create: `src/newtab/components/ContextMenu.tsx`
- Modify: `src/newtab/App.tsx`
- Test: `src/newtab/components/ContextMenu.test.tsx`

- [ ] **Step 1: 写失败测试**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ContextMenu } from './ContextMenu';

describe('ContextMenu', () => {
  it('renders actions and fires callback', async () => {
    const onAction = vi.fn();
    render(<ContextMenu x={10} y={10} isFolder={false} onAction={onAction} onClose={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: '删除' }));
    expect(onAction).toHaveBeenCalledWith('delete');
  });
  it('omits screenshot refresh for folders', () => {
    render(<ContextMenu x={0} y={0} isFolder onAction={() => {}} onClose={() => {}} />);
    expect(screen.queryByRole('button', { name: '刷新缩略图' })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 运行验证失败**

Run: `npm test -- ContextMenu`
Expected: FAIL。

- [ ] **Step 3: 实现 ContextMenu.tsx**

```tsx
import { useEffect } from 'react';

export type MenuAction = 'edit' | 'delete' | 'open-new-tab' | 'refresh-thumb';

interface Props {
  x: number;
  y: number;
  isFolder: boolean;
  onAction: (a: MenuAction) => void;
  onClose: () => void;
}

export function ContextMenu({ x, y, isFolder, onAction, onClose }: Props) {
  useEffect(() => {
    const close = () => onClose();
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [onClose]);

  return (
    <div className="ctxmenu" style={{ left: x, top: y }} onClick={(e) => e.stopPropagation()}>
      <button className="ctxmenu__item" onClick={() => onAction('edit')}>编辑</button>
      {!isFolder && <button className="ctxmenu__item" onClick={() => onAction('open-new-tab')}>在新标签页打开</button>}
      {!isFolder && <button className="ctxmenu__item" onClick={() => onAction('refresh-thumb')}>刷新缩略图</button>}
      <button className="ctxmenu__item ctxmenu__item--danger" onClick={() => onAction('delete')}>删除</button>
    </div>
  );
}
```

- [ ] **Step 4: 运行验证通过**

Run: `npm test -- ContextMenu`
Expected: PASS。

- [ ] **Step 5: 在 App 接入右键菜单**

`src/newtab/App.tsx` import 追加 `ContextMenu, type MenuAction`。在 App 内追加状态与处理：

```tsx
  const [menu, setMenu] = useState<{ x: number; y: number; id: string; isFolder: boolean } | null>(null);

  const openContextMenu = useCallback((e: React.MouseEvent, id: string) => {
    e.preventDefault();
    const isFolder = view?.items.find((it) => it.id === id)?.kind === 'folder';
    setMenu({ x: e.clientX, y: e.clientY, id, isFolder: !!isFolder });
  }, [view]);

  const handleMenuAction = useCallback(async (a: MenuAction) => {
    if (!menu || !view) return;
    const item = view.items.find((it) => it.id === menu.id);
    if (!item) { setMenu(null); return; }
    if (a === 'delete') {
      if (item.kind === 'folder') await removeFolder(item.id); else await removeBookmark(item.id);
    } else if (a === 'edit') {
      if (item.kind === 'bookmark') setDialog({ mode: 'edit-bookmark', targetId: item.id, initial: { title: item.title, url: item.url } });
      else setDialog({ mode: 'rename-folder', targetId: item.id, initial: { title: item.title } });
    } else if (a === 'open-new-tab' && item.kind === 'bookmark') {
      window.open(item.url, '_blank');
    }
    // 'refresh-thumb' 在 Phase 8 接入
    setMenu(null);
  }, [menu, view]);
```

把 `Grid`/`FolderTile` 的 `onContextMenu` 从 `() => {}` 改为 `openContextMenu`，并在容器末尾渲染菜单：

```tsx
      {menu && <ContextMenu x={menu.x} y={menu.y} isFolder={menu.isFolder} onAction={handleMenuAction} onClose={() => setMenu(null)} />}
```

- [ ] **Step 6: 追加菜单样式**

`src/newtab/styles.css` 末尾追加：

```css
.ctxmenu { position: fixed; background: #262a3d; border: 1px solid #3a3f57; border-radius: 8px; padding: 4px; min-width: 140px; z-index: 100; }
.ctxmenu__item { display: block; width: 100%; text-align: left; background: none; border: none; color: #e8eaed; padding: 8px 12px; cursor: pointer; border-radius: 6px; }
.ctxmenu__item:hover { background: #333852; }
.ctxmenu__item--danger { color: #ff8a8a; }
```

- [ ] **Step 7: 测试 + 构建 + 提交**

Run: `npm test` 然后 `npm run build`
Expected: 全绿、构建成功。

```bash
git add -A
git commit -m "feat: 右键上下文菜单（编辑/删除/新标签打开）"
```

---

## Task 23：拖拽排序与移入文件夹（@dnd-kit）

**Files:**
- Modify: `src/newtab/components/Grid.tsx`, `src/newtab/App.tsx`
- Test: `src/newtab/lib/reorder.test.ts`
- Create: `src/lib/reorder.ts`

> 说明：dnd 交互难以在 jsdom 中稳定单测，因此把「排序索引计算」抽成纯函数单测；拖拽本身在浏览器手动验证。

- [ ] **Step 1: 写失败测试（纯函数）**

`src/lib/reorder.test.ts`：

```ts
import { describe, it, expect } from 'vitest';
import { computeMoveIndex } from './reorder';

describe('computeMoveIndex', () => {
  it('moving down accounts for removal shift', () => {
    // [a,b,c,d]，把 index0 移到 index2 → chrome.move 需要 index 3
    expect(computeMoveIndex(0, 2)).toBe(3);
  });
  it('moving up keeps target index', () => {
    expect(computeMoveIndex(3, 1)).toBe(1);
  });
  it('same position returns same', () => {
    expect(computeMoveIndex(2, 2)).toBe(2);
  });
});
```

- [ ] **Step 2: 运行验证失败**

Run: `npm test -- reorder`
Expected: FAIL。

- [ ] **Step 3: 实现 reorder.ts**

`src/lib/reorder.ts`：

```ts
// Chrome bookmarks.move 的 index 语义：目标插入位置。向下移动时，因源项先“占位”，
// 需要 +1 才能落在视觉目标之后。
export function computeMoveIndex(from: number, to: number): number {
  return to > from ? to + 1 : to;
}
```

- [ ] **Step 4: 运行验证通过**

Run: `npm test -- reorder`
Expected: PASS。

- [ ] **Step 5: 在 Grid 接入 dnd-kit 排序**

改写 `src/newtab/components/Grid.tsx` 用 `@dnd-kit` 包裹（书签磁贴可拖拽排序；拖到文件夹磁贴上触发移入）：

```tsx
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { SpeedDialItem } from '@/types';
import { Tile } from './Tile';
import { FolderTile } from './FolderTile';

interface Props {
  items: SpeedDialItem[];
  columns: number;
  thumbnails: Record<string, string>;
  onOpen: (url: string) => void;
  onEnter: (id: string) => void;
  onContextMenu: (e: React.MouseEvent, id: string) => void;
  onReorder: (activeId: string, fromIndex: number, toIndex: number) => void;
  onMoveInto: (activeId: string, folderId: string) => void;
}

function SortableCell({ item, children }: { item: SpeedDialItem; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }} {...attributes} {...listeners}>
      {children}
    </div>
  );
}

export function Grid({ items, columns, thumbnails, onOpen, onEnter, onContextMenu, onReorder, onMoveInto }: Props) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const activeId = String(active.id);
    const overItem = items.find((it) => it.id === over.id);
    if (overItem?.kind === 'folder') { onMoveInto(activeId, overItem.id); return; }
    const from = items.findIndex((it) => it.id === active.id);
    const to = items.findIndex((it) => it.id === over.id);
    if (from !== -1 && to !== -1) onReorder(activeId, from, to);
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map((i) => i.id)} strategy={rectSortingStrategy}>
        <div className="grid" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
          {items.map((it) => (
            <SortableCell key={it.id} item={it}>
              {it.kind === 'bookmark' ? (
                <Tile id={it.id} title={it.title} url={it.url} thumbnail={thumbnails[it.url]} onOpen={onOpen} onContextMenu={onContextMenu} />
              ) : (
                <FolderTile id={it.id} title={it.title} preview={it.childrenPreview} onEnter={onEnter} onContextMenu={onContextMenu} />
              )}
            </SortableCell>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
export { arrayMove };
```

> 注意：`Grid.test.tsx`（Task 16）需补两个新 props：`onReorder={() => {}} onMoveInto={() => {}}`。现在更新该测试文件的 `render(<Grid ... />)` 调用，加上这两个空回调，保持通过。

- [ ] **Step 6: 更新 Grid.test.tsx 的 props**

把 Task 16 中 `Grid` 的渲染改为：

```tsx
render(<Grid items={items} columns={6} thumbnails={{}} onOpen={onOpen} onEnter={onEnter} onContextMenu={() => {}} onReorder={() => {}} onMoveInto={() => {}} />);
```

- [ ] **Step 7: 在 App 接入 onReorder / onMoveInto**

`src/newtab/App.tsx` import 追加 `moveBookmark` 与 `computeMoveIndex`：

```tsx
import { moveBookmark } from '@/lib/bookmarks';
import { computeMoveIndex } from '@/lib/reorder';
```

追加处理并传入 `Grid`：

```tsx
  const handleReorder = useCallback(async (activeId: string, from: number, to: number) => {
    if (folderId === null) return;
    // 目标父目录：当前激活 Tab 对应的文件夹（主页则为当前文件夹）
    const parentId = tabId === HOME_TAB_ID ? folderId : tabId;
    await moveBookmark(activeId, { parentId, index: computeMoveIndex(from, to) });
  }, [folderId, tabId]);

  const handleMoveInto = useCallback(async (activeId: string, targetFolderId: string) => {
    await moveBookmark(activeId, { parentId: targetFolderId });
  }, []);
```

`Grid` 使用处补 `onReorder={handleReorder} onMoveInto={handleMoveInto}`。

- [ ] **Step 8: 测试 + 构建 + 手动验证拖拽 + 提交**

Run: `npm test` 然后 `npm run build`。手动：刷新扩展，拖动磁贴排序、拖到文件夹磁贴上移入，确认书签管理器里顺序/归属同步变化。

```bash
git add -A
git commit -m "feat: 拖拽排序与移入文件夹（dnd-kit + 索引纯函数）"
```

---

# Phase 5：导航状态记忆

## Task 24：恢复上次位置 + 失效校验（TDD）

**Files:**
- Create: `src/lib/navState.validate.test.ts`
- Modify: `src/lib/navState.ts`（加 `resolveInitialNav` 纯函数），`src/newtab/App.tsx`

- [ ] **Step 1: 写失败测试**

`src/lib/navState.validate.test.ts`：

```ts
import { describe, it, expect } from 'vitest';
import { resolveInitialNav } from './navState';
import { HOME_TAB_ID } from './constants';
import type { BookmarkNode } from '@/types';

const tree: BookmarkNode = { id: 'root', title: 'R', children: [
  { id: 'f1', title: '工作', children: [{ id: 'f2', title: '后端', children: [] }] },
] };

describe('resolveInitialNav', () => {
  it('uses saved nav when folder & tab valid', () => {
    const r = resolveInitialNav(tree, { currentFolderId: 'f1', selectedTabId: 'f2' }, true);
    expect(r).toEqual({ currentFolderId: 'f1', selectedTabId: 'f2' });
  });
  it('falls back to root when folder missing', () => {
    const r = resolveInitialNav(tree, { currentFolderId: 'gone', selectedTabId: 'x' }, true);
    expect(r).toEqual({ currentFolderId: 'root', selectedTabId: HOME_TAB_ID });
  });
  it('falls back to folder home when tab invalid but folder valid', () => {
    const r = resolveInitialNav(tree, { currentFolderId: 'f1', selectedTabId: 'zzz' }, true);
    expect(r).toEqual({ currentFolderId: 'f1', selectedTabId: HOME_TAB_ID });
  });
  it('ignores saved nav when restore disabled', () => {
    const r = resolveInitialNav(tree, { currentFolderId: 'f1', selectedTabId: 'f2' }, false);
    expect(r).toEqual({ currentFolderId: 'root', selectedTabId: HOME_TAB_ID });
  });
  it('uses root when no saved nav', () => {
    const r = resolveInitialNav(tree, null, true);
    expect(r).toEqual({ currentFolderId: 'root', selectedTabId: HOME_TAB_ID });
  });
});
```

- [ ] **Step 2: 运行验证失败**

Run: `npm test -- navState.validate`
Expected: FAIL。

- [ ] **Step 3: 实现 resolveInitialNav**

在 `src/lib/navState.ts` 追加（引入 mapping 的工具与常量）：

```ts
import { HOME_TAB_ID } from './constants';
import { findNode, buildTabs } from './mapping';
import type { BookmarkNode } from '@/types';

export function resolveInitialNav(
  root: BookmarkNode,
  saved: NavState | null,
  restoreEnabled: boolean,
): NavState {
  const fallback: NavState = { currentFolderId: root.id, selectedTabId: HOME_TAB_ID };
  if (!restoreEnabled || !saved) return fallback;
  const folder = findNode(root, saved.currentFolderId);
  if (!folder) return fallback;
  const tabs = buildTabs(folder);
  const tabValid = tabs.some((t) => t.id === saved.selectedTabId);
  return { currentFolderId: folder.id, selectedTabId: tabValid ? saved.selectedTabId : HOME_TAB_ID };
}
```

- [ ] **Step 4: 运行验证通过**

Run: `npm test -- navState.validate`
Expected: PASS。

- [ ] **Step 5: App 用 resolveInitialNav 替换初始化逻辑**

把 Task 18 中 App 的初始化 `useEffect` 改为：

```tsx
import { resolveInitialNav } from '@/lib/navState';
// ...
  useEffect(() => {
    if (!root || !ready || folderId !== null) return;
    const init = resolveInitialNav(root, navState, settings?.restoreLastPosition ?? true);
    setFolderId(init.currentFolderId);
    setTabId(init.selectedTabId);
  }, [root, ready, navState, settings, folderId]);
```

- [ ] **Step 6: 测试 + 构建 + 提交**

Run: `npm test` 然后 `npm run build`
Expected: 全绿。手动：钻入某目录 → 关闭再开新标签页 → 停在上次位置；到设置关掉「恢复上次位置」→ 新标签页回到根。

```bash
git add -A
git commit -m "feat: 导航状态记忆（恢复+失效校验纯函数）"
```

---

# Phase 6：磁贴样式与回退

## Task 25：useThumbnail hook 与样式接线（TDD）

**Files:**
- Create: `src/newtab/hooks/useThumbnails.ts`
- Modify: `src/newtab/App.tsx`, `src/newtab/components/Tile.tsx`
- Test: `src/newtab/hooks/useThumbnails.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { renderHook, waitFor } from '@testing-library/react';
import { installChromeMock } from '../../../tests/setup';
import { putThumbnail } from '@/lib/thumbnails';
import { useThumbnails } from './useThumbnails';

beforeEach(() => { installChromeMock(); indexedDB = new IDBFactory(); });

describe('useThumbnails', () => {
  it('loads thumbnails for given urls when style is screenshot', async () => {
    await putThumbnail({ url: 'https://a.com', dataUrl: 'data:img', capturedAt: 1 });
    const { result } = renderHook(() => useThumbnails(['https://a.com'], 'screenshot'));
    await waitFor(() => expect(result.current['https://a.com']).toBe('data:img'));
  });
  it('returns empty map when style is not screenshot', async () => {
    await putThumbnail({ url: 'https://a.com', dataUrl: 'data:img', capturedAt: 1 });
    const { result } = renderHook(() => useThumbnails(['https://a.com'], 'favicon'));
    await waitFor(() => expect(result.current).toEqual({}));
  });
});
```

- [ ] **Step 2: 运行验证失败**

Run: `npm test -- useThumbnails`
Expected: FAIL。

- [ ] **Step 3: 实现 useThumbnails.ts**

```ts
import { useEffect, useState } from 'react';
import { getThumbnail } from '@/lib/thumbnails';
import type { TileStyle } from '@/types';

export function useThumbnails(urls: string[], style: TileStyle): Record<string, string> {
  const [map, setMap] = useState<Record<string, string>>({});
  const key = urls.join('|');

  useEffect(() => {
    if (style !== 'screenshot') { setMap({}); return; }
    let cancelled = false;
    (async () => {
      const next: Record<string, string> = {};
      for (const u of urls) {
        const rec = await getThumbnail(u);
        if (rec) next[u] = rec.dataUrl;
      }
      if (!cancelled) setMap(next);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, style]);

  return map;
}
```

- [ ] **Step 4: 运行验证通过**

Run: `npm test -- useThumbnails`
Expected: PASS。

- [ ] **Step 5: App 接入 useThumbnails + Tile 支持 themeColor 样式**

App 内计算当前书签 urls 并调用 hook，传给 `Grid`：

```tsx
import { useThumbnails } from './hooks/useThumbnails';
// ...
  const bookmarkUrls = useMemo(
    () => (view?.items.filter((i) => i.kind === 'bookmark') as { url: string }[] | undefined)?.map((i) => i.url) ?? [],
    [view],
  );
  const thumbnails = useThumbnails(bookmarkUrls, settings?.tileStyle ?? 'favicon');
```

`Grid` 使用处 `thumbnails={{}}` 改为 `thumbnails={thumbnails}`；并把 `settings.tileStyle` 透传给 `Grid`→`Tile`（新增 `tileStyle` prop）。

`Tile.tsx` 加 `tileStyle?: TileStyle` prop，当 `tileStyle==='themeColor'` 且无 screenshot 时用主题色渐变背景 + 大 favicon：

```tsx
import type { TileStyle } from '@/types';
// props 追加 tileStyle?: TileStyle
  const themeMode = tileStyle === 'themeColor' && !thumbnail;
  // 在 tile__thumb 外层 style 里，themeMode 时加背景：
  // style={themeMode ? { background: `linear-gradient(135deg, ${colorFromString(url)}, #1e2130)` } : undefined}
```

（把 `Tile` 根 `button` 的 `style` 设为上面表达式；`Grid` 与其 `Tile` 调用、`Grid` 的 Props 增加 `tileStyle` 并透传。相应更新 `Tile.test.tsx`/`Grid.test.tsx` 调用加 `tileStyle="favicon"` 保持通过。）

- [ ] **Step 6: 更新受影响测试的 props**

- `Tile.test.tsx`：`render(<Tile ... tileStyle="favicon" />)`
- `Grid.test.tsx`：`render(<Grid ... tileStyle="favicon" />)`

- [ ] **Step 7: 测试 + 构建 + 提交**

Run: `npm test` 然后 `npm run build`
Expected: 全绿。回退链：screenshot 无图 → themeColor（若选）→ favicon → 首字母（Tile 内 `onError`）。

```bash
git add -A
git commit -m "feat: 磁贴样式（favicon/主题色/截图）与缩略图读取 + 回退"
```

---

# Phase 7：搜索

## Task 26：搜索过滤纯函数（TDD）

**Files:**
- Create: `src/lib/search.ts`, `src/lib/search.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
import { describe, it, expect } from 'vitest';
import { flattenBookmarks, filterBookmarks, buildSearchUrl } from './search';
import type { BookmarkNode } from '@/types';

const tree: BookmarkNode = { id: 'root', title: 'R', children: [
  { id: 'b1', title: 'GitHub', url: 'https://github.com' },
  { id: 'f1', title: '工作', children: [
    { id: 'b2', title: 'Jira Board', url: 'https://jira.com' },
  ] },
] };

describe('search', () => {
  it('flattenBookmarks collects all bookmarks recursively', () => {
    expect(flattenBookmarks(tree).map((b) => b.id)).toEqual(['b1', 'b2']);
  });
  it('filterBookmarks matches title case-insensitively', () => {
    expect(filterBookmarks(tree, 'jira').map((b) => b.id)).toEqual(['b2']);
  });
  it('filterBookmarks matches url', () => {
    expect(filterBookmarks(tree, 'github.com').map((b) => b.id)).toEqual(['b1']);
  });
  it('empty query returns nothing', () => {
    expect(filterBookmarks(tree, '  ')).toEqual([]);
  });
  it('buildSearchUrl substitutes %s encoded', () => {
    expect(buildSearchUrl('https://g.com/s?q=%s', 'a b')).toBe('https://g.com/s?q=a%20b');
  });
});
```

- [ ] **Step 2: 运行验证失败**

Run: `npm test -- search`
Expected: FAIL。

- [ ] **Step 3: 实现 search.ts**

```ts
import type { BookmarkNode, SpeedDialBookmark } from '@/types';

export function flattenBookmarks(root: BookmarkNode): SpeedDialBookmark[] {
  const out: SpeedDialBookmark[] = [];
  const walk = (n: BookmarkNode) => {
    for (const c of n.children ?? []) {
      if (c.url) out.push({ kind: 'bookmark', id: c.id, title: c.title, url: c.url, index: c.index ?? 0 });
      else walk(c);
    }
  };
  walk(root);
  return out;
}

export function filterBookmarks(root: BookmarkNode, query: string): SpeedDialBookmark[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return flattenBookmarks(root).filter(
    (b) => b.title.toLowerCase().includes(q) || b.url.toLowerCase().includes(q),
  );
}

export function buildSearchUrl(template: string, query: string): string {
  return template.replace('%s', encodeURIComponent(query));
}
```

- [ ] **Step 4: 运行验证通过 & 提交**

Run: `npm test -- search`
Expected: PASS。

```bash
git add -A
git commit -m "feat: 搜索纯函数（扁平化/过滤/搜索URL）+ 测试"
```

---

## Task 27：SearchBar 组件与接入（TDD）

**Files:**
- Create: `src/newtab/components/SearchBar.tsx`
- Modify: `src/newtab/App.tsx`
- Test: `src/newtab/components/SearchBar.test.tsx`

- [ ] **Step 1: 写失败测试**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SearchBar } from './SearchBar';
import type { SpeedDialBookmark } from '@/types';

const results: SpeedDialBookmark[] = [
  { kind: 'bookmark', id: 'b', title: 'GitHub', url: 'https://github.com', index: 0 },
];

describe('SearchBar', () => {
  it('calls onQueryChange while typing', async () => {
    const onQueryChange = vi.fn();
    render(<SearchBar query="" results={[]} onQueryChange={onQueryChange} onSubmit={() => {}} onPick={() => {}} />);
    await userEvent.type(screen.getByRole('searchbox'), 'gi');
    expect(onQueryChange).toHaveBeenLastCalledWith('gi');
  });
  it('shows results and picks one', async () => {
    const onPick = vi.fn();
    render(<SearchBar query="gi" results={results} onQueryChange={() => {}} onSubmit={() => {}} onPick={onPick} />);
    await userEvent.click(screen.getByText('GitHub'));
    expect(onPick).toHaveBeenCalledWith('https://github.com');
  });
  it('submits on Enter with no result focus', async () => {
    const onSubmit = vi.fn();
    render(<SearchBar query="hello" results={[]} onQueryChange={() => {}} onSubmit={onSubmit} onPick={() => {}} />);
    await userEvent.type(screen.getByRole('searchbox'), '{Enter}');
    expect(onSubmit).toHaveBeenCalledWith('hello');
  });
});
```

- [ ] **Step 2: 运行验证失败**

Run: `npm test -- SearchBar`
Expected: FAIL。

- [ ] **Step 3: 实现 SearchBar.tsx**

```tsx
import type { SpeedDialBookmark } from '@/types';

interface Props {
  query: string;
  results: SpeedDialBookmark[];
  onQueryChange: (q: string) => void;
  onSubmit: (q: string) => void;
  onPick: (url: string) => void;
}

export function SearchBar({ query, results, onQueryChange, onSubmit, onPick }: Props) {
  return (
    <div className="search">
      <input
        type="search"
        role="searchbox"
        className="search__input"
        placeholder="搜索书签或按回车用搜索引擎搜索"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') onSubmit(query); }}
      />
      {query.trim() && results.length > 0 && (
        <ul className="search__results">
          {results.slice(0, 8).map((r) => (
            <li key={r.id}>
              <button className="search__result" onClick={() => onPick(r.url)}>{r.title}</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 4: 运行验证通过**

Run: `npm test -- SearchBar`
Expected: PASS。

- [ ] **Step 5: App 接入搜索**

`src/newtab/App.tsx` import 追加：

```tsx
import { SearchBar } from './components/SearchBar';
import { filterBookmarks, buildSearchUrl } from '@/lib/search';
```

App 内追加状态与派生：

```tsx
  const [query, setQuery] = useState('');
  const searchResults = useMemo(() => (root ? filterBookmarks(root, query) : []), [root, query]);
  const submitSearch = useCallback((q: string) => {
    if (!q.trim() || !settings) return;
    window.location.href = buildSearchUrl(settings.searchEngine, q);
  }, [settings]);
```

在 `.app` 容器顶部（`Breadcrumb` 之前）渲染：

```tsx
      <SearchBar query={query} results={searchResults} onQueryChange={setQuery} onSubmit={submitSearch} onPick={openUrl} />
```

- [ ] **Step 6: 追加样式**

`src/newtab/styles.css` 末尾追加：

```css
.search { position: relative; max-width: 560px; margin: 0 auto 28px; }
.search__input { width: 100%; padding: 12px 16px; border-radius: 24px; border: none; background: #2a2e42; color: #e8eaed; font-size: 15px; }
.search__results { list-style: none; margin: 6px 0 0; padding: 6px; position: absolute; width: 100%; background: #262a3d; border-radius: 12px; z-index: 50; }
.search__result { display: block; width: 100%; text-align: left; background: none; border: none; color: #e8eaed; padding: 8px 12px; border-radius: 8px; cursor: pointer; }
.search__result:hover { background: #333852; }
```

- [ ] **Step 7: 测试 + 构建 + 提交**

Run: `npm test` 然后 `npm run build`
Expected: 全绿。

```bash
git add -A
git commit -m "feat: 搜索框（实时过滤 + 搜索引擎跳转）"
```

---

# Phase 8：截图缩略图

## Task 28：截图限流纯函数（TDD）

**Files:**
- Create: `src/lib/capturePolicy.ts`, `src/lib/capturePolicy.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
import { describe, it, expect } from 'vitest';
import { shouldCapture } from './capturePolicy';

const DAY = 86400000;

describe('shouldCapture', () => {
  it('never policy → false', () => {
    expect(shouldCapture('never', undefined, 7, 1000)).toBe(false);
  });
  it('always policy → true even if fresh', () => {
    expect(shouldCapture('always', 999, 7, 1000)).toBe(true);
  });
  it('stale policy → true when no existing capture', () => {
    expect(shouldCapture('stale', undefined, 7, 1000)).toBe(true);
  });
  it('stale policy → false when within N days', () => {
    expect(shouldCapture('stale', 1000, 7, 1000 + 3 * DAY)).toBe(false);
  });
  it('stale policy → true when older than N days', () => {
    expect(shouldCapture('stale', 1000, 7, 1000 + 8 * DAY)).toBe(true);
  });
});
```

- [ ] **Step 2: 运行验证失败**

Run: `npm test -- capturePolicy`
Expected: FAIL。

- [ ] **Step 3: 实现 capturePolicy.ts**

```ts
import type { ThumbnailPolicy } from '@/types';

const DAY_MS = 86400000;

export function shouldCapture(
  policy: ThumbnailPolicy,
  lastCapturedAt: number | undefined,
  staleDays: number,
  now: number,
): boolean {
  if (policy === 'never') return false;
  if (policy === 'always') return true;
  if (lastCapturedAt === undefined) return true;
  return now - lastCapturedAt > staleDays * DAY_MS;
}
```

- [ ] **Step 4: 运行验证通过 & 提交**

Run: `npm test -- capturePolicy`
Expected: PASS。

```bash
git add -A
git commit -m "feat: 截图限流/新鲜度策略纯函数 + 测试"
```

---

## Task 29：background service worker 自动抓取

**Files:**
- Modify: `src/background/service-worker.ts`
- Create: `src/lib/messages.ts`

> 说明：Service Worker 逻辑依赖大量 Chrome 事件与真实截图，端到端在浏览器手动验证；纯策略已在 Task 28 单测。

- [ ] **Step 1: 定义消息类型 messages.ts**

```ts
export type RsdMessage =
  | { type: 'capture-visible'; url: string }
  | { type: 'save-current-as'; url: string }
  | { type: 'capture-url'; url: string };

export interface RsdResponse {
  ok: boolean;
  error?: string;
}
```

- [ ] **Step 2: 实现 service-worker.ts（自动抓取 + 限流 + 写库）**

```ts
import { loadSettings } from '@/lib/settings';
import { getThumbnail, putThumbnail } from '@/lib/thumbnails';
import { shouldCapture } from '@/lib/capturePolicy';
import type { RsdMessage, RsdResponse } from '@/lib/messages';

const MIN_INTERVAL_MS = 1100; // captureVisibleTab 频率限制约 1/s
let lastCaptureAt = 0;

async function hasCapturePermission(): Promise<boolean> {
  return chrome.permissions.contains({ permissions: ['tabs'], origins: ['<all_urls>'] });
}

async function captureAndStore(url: string, windowId?: number): Promise<void> {
  const wait = MIN_INTERVAL_MS - (Date.now() - lastCaptureAt);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCaptureAt = Date.now();
  const dataUrl = await chrome.tabs.captureVisibleTab(windowId as number, { format: 'jpeg', quality: 70 });
  if (dataUrl) await putThumbnail({ url, dataUrl, capturedAt: Date.now() });
}

// 自动抓取：页面加载完成时，如该 URL 是被访问的当前活动页且策略允许
chrome.tabs.onUpdated.addListener(async (_tabId, info, tab) => {
  if (info.status !== 'complete' || !tab.active || !tab.url) return;
  if (!/^https?:/.test(tab.url)) return;
  if (!(await hasCapturePermission())) return;
  const settings = await loadSettings();
  if (settings.tileStyle !== 'screenshot') return;
  const existing = await getThumbnail(tab.url);
  if (!shouldCapture(settings.thumbnailPolicy, existing?.capturedAt, settings.thumbnailStaleDays, Date.now())) return;
  try { await captureAndStore(tab.url, tab.windowId); } catch (e) { console.warn('[RSD] capture failed', e); }
});

// 手动抓取消息
chrome.runtime.onMessage.addListener((msg: RsdMessage, _sender, sendResponse: (r: RsdResponse) => void) => {
  (async () => {
    try {
      if (msg.type === 'save-current-as') {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        await captureAndStore(msg.url, tab?.windowId);
      } else if (msg.type === 'capture-url') {
        const tab = await chrome.tabs.create({ url: msg.url, active: true });
        await new Promise<void>((resolve) => {
          const listener = (id: number, info: chrome.tabs.TabChangeInfo) => {
            if (id === tab.id && info.status === 'complete') { chrome.tabs.onUpdated.removeListener(listener); resolve(); }
          };
          chrome.tabs.onUpdated.addListener(listener);
        });
        await captureAndStore(msg.url, tab.windowId);
        if (tab.id) await chrome.tabs.remove(tab.id);
      }
      sendResponse({ ok: true });
    } catch (e) {
      sendResponse({ ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  })();
  return true; // async
});

console.info('[RSD] service worker ready');
```

- [ ] **Step 3: 构建验证**

Run: `npm run build`
Expected: 构建成功（TS 通过）。

- [ ] **Step 4: 提交**

```bash
git add -A
git commit -m "feat: 后台自动截图（限流+策略+消息处理）"
```

---

## Task 30：截图权限按需申请 + 手动刷新接入

**Files:**
- Modify: `src/options/Options.tsx`（启用截图样式时请求权限）
- Modify: `src/newtab/App.tsx`（右键「刷新缩略图」发消息；「保存当前页为缩略图」入口）
- Create: `src/lib/permissions.ts`, `src/lib/permissions.test.ts`

- [ ] **Step 1: 写失败测试（permissions 封装）**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { installChromeMock, type ChromeMock } from '../../tests/setup';
import { ensureCapturePermission } from './permissions';

let c: ChromeMock;
beforeEach(() => { c = installChromeMock(); });

describe('ensureCapturePermission', () => {
  it('returns true immediately if already granted', async () => {
    c.permissions.contains.mockResolvedValue(true);
    expect(await ensureCapturePermission()).toBe(true);
    expect(c.permissions.request).not.toHaveBeenCalled();
  });
  it('requests when missing', async () => {
    c.permissions.contains.mockResolvedValue(false);
    c.permissions.request.mockResolvedValue(true);
    expect(await ensureCapturePermission()).toBe(true);
    expect(c.permissions.request).toHaveBeenCalledWith({ permissions: ['tabs'], origins: ['<all_urls>'] });
  });
});
```

- [ ] **Step 2: 运行验证失败**

Run: `npm test -- permissions`
Expected: FAIL。

- [ ] **Step 3: 实现 permissions.ts**

```ts
const CAPTURE_PERMS: chrome.permissions.Permissions = { permissions: ['tabs'], origins: ['<all_urls>'] };

export async function ensureCapturePermission(): Promise<boolean> {
  if (await chrome.permissions.contains(CAPTURE_PERMS)) return true;
  return chrome.permissions.request(CAPTURE_PERMS);
}
```

- [ ] **Step 4: 运行验证通过**

Run: `npm test -- permissions`
Expected: PASS。

- [ ] **Step 5: Options 里启用截图样式时申请权限**

`Options.tsx` import `ensureCapturePermission`，把磁贴样式 onChange 改为：

```tsx
onChange={async (e) => {
  const style = e.target.value as TileStyle;
  if (style === 'screenshot') {
    const ok = await ensureCapturePermission();
    if (!ok) { alert('未授予截图所需权限，已保持当前样式'); return; }
  }
  await patch({ tileStyle: style });
}}
```

- [ ] **Step 6: App 右键「刷新缩略图」发消息**

在 `handleMenuAction` 的 `refresh-thumb` 分支实现：

```tsx
    } else if (a === 'refresh-thumb' && item.kind === 'bookmark') {
      const ok = await ensureCapturePermission();
      if (ok) chrome.runtime.sendMessage({ type: 'capture-url', url: item.url });
    }
```

（`App.tsx` import `ensureCapturePermission`。）

- [ ] **Step 7: 测试 + 构建 + 手动验证 + 提交**

Run: `npm test` 然后 `npm run build`。手动：设置里切「网页截图」→ 弹权限请求 → 允许 → 访问几个书签站点后回到新标签页看到截图；右键某磁贴「刷新缩略图」应新开-抓取-关闭并更新。

```bash
git add -A
git commit -m "feat: 截图权限按需申请 + 手动刷新缩略图"
```

---

# Phase 9：外观增强

## Task 31：主题（深浅/跟随系统）与列数应用

**Files:**
- Modify: `src/newtab/App.tsx`, `src/newtab/styles.css`
- Create: `src/lib/theme.ts`, `src/lib/theme.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
import { describe, it, expect } from 'vitest';
import { resolveTheme } from './theme';

describe('resolveTheme', () => {
  it('returns explicit theme', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });
  it('system follows prefersDark', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });
});
```

- [ ] **Step 2: 运行验证失败**

Run: `npm test -- theme`
Expected: FAIL。

- [ ] **Step 3: 实现 theme.ts**

```ts
import type { Settings } from '@/types';

export function resolveTheme(theme: Settings['theme'], prefersDark: boolean): 'light' | 'dark' {
  if (theme === 'system') return prefersDark ? 'dark' : 'light';
  return theme;
}
```

- [ ] **Step 4: 运行验证通过**

Run: `npm test -- theme`
Expected: PASS。

- [ ] **Step 5: App 应用主题到 document + 背景色**

在 App 内追加：

```tsx
import { resolveTheme } from '@/lib/theme';
// ...
  useEffect(() => {
    if (!settings) return;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const mode = resolveTheme(settings.theme, prefersDark);
    document.documentElement.dataset.theme = mode;
    if (settings.background.type === 'color') {
      document.body.style.background = settings.background.value;
    }
  }, [settings]);
```

`styles.css` 追加浅色主题变量覆盖：

```css
html[data-theme="light"] body { background: #f6f7f9; color: #1c1e21; }
html[data-theme="light"] .tile, html[data-theme="light"] .tab { background: #fff; color: #1c1e21; }
html[data-theme="light"] .tab--active { background: #4a9eff; color: #fff; }
html[data-theme="light"] .search__input { background: #fff; color: #1c1e21; box-shadow: 0 1px 3px rgba(0,0,0,.1); }
```

- [ ] **Step 6: 测试 + 构建 + 提交**

Run: `npm test` 然后 `npm run build`
Expected: 全绿。列数已由 `settings.columns` 驱动 Grid。

```bash
git add -A
git commit -m "feat: 主题切换（深浅/跟随系统）与背景色"
```

---

## Task 32：自定义壁纸（上传存 IndexedDB 并应用）

**Files:**
- Modify: `src/options/Options.tsx`（上传壁纸）, `src/newtab/App.tsx`（读取并应用）
- 复用 `src/lib/thumbnails.ts` 的 `putAsset/getAsset`

- [ ] **Step 1: Options 增加壁纸上传**

在「外观」section 追加背景类型选择与文件上传：

```tsx
import { putAsset } from '@/lib/thumbnails';
import { WALLPAPER_KEY } from '@/lib/constants';
// ...
<label className="field">
  <span>背景</span>
  <select aria-label="背景类型" value={settings.background.type} onChange={(e) =>
    void patch({ background: e.target.value === 'wallpaper' ? { type: 'wallpaper' } : { type: 'color', value: '#1e2130' } })
  }>
    <option value="color">纯色</option>
    <option value="wallpaper">壁纸图片</option>
  </select>
</label>
{settings.background.type === 'color' && (
  <label className="field"><span>背景色</span>
    <input type="color" value={settings.background.value} onChange={(e) => void patch({ background: { type: 'color', value: e.target.value } })} />
  </label>
)}
{settings.background.type === 'wallpaper' && (
  <label className="field"><span>上传壁纸</span>
    <input type="file" accept="image/*" onChange={async (e) => {
      const file = e.target.files?.[0];
      if (file) { await putAsset(WALLPAPER_KEY, file); await patch({ background: { type: 'wallpaper' } }); }
    }} />
  </label>
)}
```

- [ ] **Step 2: App 读取壁纸并应用**

在 App 的主题 `useEffect` 内，`background.type === 'wallpaper'` 分支：

```tsx
import { getAsset } from '@/lib/thumbnails';
import { WALLPAPER_KEY } from '@/lib/constants';
// 在应用背景处：
    if (settings.background.type === 'wallpaper') {
      const blob = await getAsset(WALLPAPER_KEY);
      if (blob) {
        const url = URL.createObjectURL(blob);
        document.body.style.background = `url(${url}) center/cover no-repeat fixed`;
      }
    }
```

（把该 effect 的回调改为 async IIFE 以便 await；注意 `getAsset` 在 jsdom 无 IndexedDB，effect 内已在浏览器运行，无需为此加测试——属手动验证范畴。）

- [ ] **Step 3: 构建 + 手动验证 + 提交**

Run: `npm run build`。手动：设置里选壁纸并上传图片 → 新标签页背景变为该图片。

```bash
git add -A
git commit -m "feat: 自定义壁纸（上传存 IndexedDB 并应用）"
```

---

## Task 33：收尾（README + 图标 + 全量校验）

**Files:**
- Create: `README.md`
- Replace: `public/icons/*`（可选，替换为正式图标）

- [ ] **Step 1: 写 README.md**

包含：项目简介、功能列表、开发命令（`npm i` / `npm run dev` / `npm run build` / `npm test`）、加载 unpacked 步骤（选 `dist/`）、权限说明（`bookmarks/storage/favicon` 必需；`tabs`+`<all_urls>` 截图时按需申请）、目录映射与导航模型简述、已知限制（截图只抓可见活动页、favicon 权限可能触发一次安装警告）。

- [ ] **Step 2: 全量测试 + 构建**

Run: `npm test` 然后 `npm run build`
Expected: 全部测试通过、构建产物在 `dist/`。

- [ ] **Step 3: 端到端手动回归**

覆盖：选根目录 → 平铺 → 切 Tab → 钻入子目录（整屏替换）→ 面包屑/后退返回 → 新增/重命名/删除 → 拖拽排序/移入 → 搜索过滤与跳转 → 状态记忆 → 截图样式与权限 → 主题/背景/列数。

- [ ] **Step 4: 提交**

```bash
git add -A
git commit -m "docs: README 与收尾校验"
```

---

## Self-Review（计划对照 spec）

**1. Spec 覆盖检查：**
- §2 架构（newtab/options/background/存储）→ Task 1、11–18、19–20、29；存储：settings(Task9)/navState(Task9,24)/IndexedDB(Task10)。✅
- §3 数据模型与映射（含边界：无散装书签隐藏主页 Tab、只有书签不显示 Tab 栏、空态）→ Task 5（buildTabs 边界）、Task 14（TabBar 隐藏）、Task 17（空态）、Task 6/7。✅
- §4 递归替换导航（含 §4.0 语义、面包屑、后退键）→ Task 6–7、16、18。✅
- §5 交互（打开/钻入/右键/拖拽/新增，搜索，状态记忆）→ Task 21–23、26–27、24。✅
- §6 缩略图（自动/手动/策略/回退）→ Task 25、28–30。✅
- §7 权限（必需 + 截图按需申请）→ Task 1（manifest）、30。✅
- §8 项目结构与模块边界 → Task 1 + 全程 lib/组件分层。✅
- §9 错误处理与边界（未选根/失效/空/favicon 回退/截图回退/权限被拒）→ Task 18（引导）、24（失效回退）、17（空）、15（favicon 回退）、25（截图回退）、30（权限被拒提示）。✅
- §10 测试策略（Vitest 覆盖 mapping/settings/navState/thumbnails + 组件测试 + 手动）→ 全程 TDD。✅

**2. Placeholder 扫描：** 各步骤含完整代码/命令与预期输出；无 TBD/TODO/“类似 Task N”。UI 中依赖 Chrome 运行时的部分（SW、壁纸）明确标注为手动验证并给出完整实现代码。✅

**3. 类型/命名一致性：** `FolderView/TabModel/SpeedDialItem/Settings/NavState/ThumbnailRecord` 全程一致；`buildFolderView/buildTabs/buildItems/resolveActiveTabId/resolveInitialNav/shouldCapture/ensureCapturePermission` 命名在定义与调用处一致；`HOME_TAB_ID` 常量统一。Grid/Tile 的 props 在引入新能力时同步更新了对应测试（Task 23/25 明确回填 props）。✅

**结论：** 计划完整覆盖 spec，可按任务顺序独立执行，每个任务产出可测试的增量并提交。
