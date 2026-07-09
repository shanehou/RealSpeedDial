# Real Speed Dial 体验改进 实现计划（第二轮）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在既有 Real Speed Dial 扩展上落地 7 项体验改进 + 搜索增强：MIT LICENSE、中英双语 i18n、面包屑（浏览器书签根→当前目录，可点）、Tab「进入」按钮、主题色磁贴可读性、磁贴改真链接、整树分组搜索、自动更新壁纸（Bing/Picsum/Unsplash）。

**Architecture:** 纯逻辑收敛在 `src/lib/*`（`i18n`/`search`/`wallpaper`/`mapping`/`navState`，可单测）；React 组件只渲染与交互；Chrome API 封装在 lib 内便于 mock。导航数据源从「配置目录子树」改为「整棵书签树」（`getTree()`），配置目录降级为「默认落地目录」。

**Tech Stack:** React 19 + TypeScript + Vite + @crxjs/vite-plugin（MV3）；Vitest + Testing Library；@dnd-kit；IndexedDB（缩略图/壁纸 blob）。

**规范提醒（每个 Task 通用）：**
- TDD：先写失败测试 → 跑失败 → 最小实现 → 跑通过 → 提交。
- 提交信息用仓库风格（`feat:`/`fix:`/`docs:` + 中文），每个 Task 至少 1 次提交。
- 跑单测：`npm test`（全部）或 `npx vitest run <file>`（单文件）。
- 类型检查/构建：`npm run build`（= `tsc -b && vite build`）。
- 忽略 clang 报错（本项目为 TS，不涉及）。

---

## 阶段与任务总览

- **阶段 1 基础**：Task 1 LICENSE/元数据 · Task 2 类型与常量 · Task 3 测试语言钉死
- **阶段 2 i18n**：Task 4 i18n 核心库 · Task 5 useI18n · Task 6 新标签页组件接线 · Task 7 设置页接线 + 语言下拉
- **阶段 3 导航**：Task 8 整树加载 + 初始化 · Task 9 面包屑（根渲染 + 可点回归） · Task 10 Tab「进入」按钮
- **阶段 4 磁贴**：Task 11 主题色可读性 · Task 12 磁贴改真链接
- **阶段 5 搜索**：Task 13 searchBookmarks（整树+分组+路径） · Task 14 SearchResults 组件接线
- **阶段 6 壁纸**：Task 15 wallpaper.ts · Task 16 权限 + manifest · Task 17 App 背景 + Attribution · Task 18 设置页壁纸 UI
- **阶段 7 文档**：Task 19 README 英文 + 中文

---

## 阶段 1：基础

### Task 1：LICENSE 与 package.json 元数据（#1）

**Files:**
- Create: `LICENSE`
- Modify: `package.json:14-16`

- [ ] **Step 1: 创建 `LICENSE`（MIT 全文）**

```text
MIT License

Copyright (c) 2026 shanehou

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 2: 修改 `package.json` 的 `author` 与 `license`**

把：
```json
  "keywords": [],
  "author": "",
  "license": "ISC",
```
改为：
```json
  "keywords": ["chrome-extension", "speed-dial", "bookmarks", "new-tab"],
  "author": "shanehou",
  "license": "MIT",
```

- [ ] **Step 3: 验证并提交**

Run: `npm run build`
Expected: 构建通过（无类型错误）。

```bash
git add LICENSE package.json
git commit -m "chore: 新增 MIT LICENSE 与 package.json 元数据"
```

---

### Task 2：类型与常量（Settings/BackgroundSetting/新类型 + constants）

**Files:**
- Modify: `src/types.ts:11-91`
- Modify: `src/lib/constants.ts:1-9`
- Test: `src/lib/settings.test.ts`（补一条默认值断言）

- [ ] **Step 1: 写失败测试（默认 language）**

在 `src/lib/settings.test.ts` 末尾（`describe` 内）新增：
```ts
  it('provides default language "auto" when unset', async () => {
    const s = await loadSettings();
    expect(s.language).toBe('auto');
  });
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/lib/settings.test.ts`
Expected: FAIL（`language` 为 undefined）。

- [ ] **Step 3: 修改 `src/types.ts`**

把 `BackgroundSetting` 与 `Settings`/`DEFAULT_SETTINGS` 段落替换为：
```ts
export type WallpaperSource = 'bing' | 'picsum' | 'unsplash';

export type BackgroundSetting =
  | { type: 'color'; value: string }
  | { type: 'wallpaper' }
  | { type: 'auto'; source: WallpaperSource };

export type Language = 'auto' | 'zh' | 'en';

export interface WallpaperAttribution {
  photographer: string;
  photographerUrl: string; // 含 utm
  unsplashUrl: string;     // 含 utm
}

export interface Settings {
  rootFolderId: string | null; // 语义：新标签页默认落地目录
  tileStyle: TileStyle;
  thumbnailPolicy: ThumbnailPolicy;
  thumbnailStaleDays: number;
  openInNewTab: boolean;
  restoreLastPosition: boolean;
  theme: 'system' | 'light' | 'dark';
  background: BackgroundSetting;
  columns: number;
  searchEngine: string;
  language: Language;
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
  language: 'auto',
};
```

- [ ] **Step 4: 修改 `src/lib/constants.ts`（新增壁纸/Unsplash 键）**

在文件末尾追加：
```ts
export const UNSPLASH_KEY = 'unsplashAccessKey'; // storage.local
export const WALLPAPER_AUTO_KEY = 'wallpaper-auto'; // IndexedDB ASSET_STORE blob key
export const WALLPAPER_META_KEY = 'wallpaperMeta';  // storage.local: { source, date, attribution? }
```

- [ ] **Step 5: 跑测试确认通过**

Run: `npx vitest run src/lib/settings.test.ts`
Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add src/types.ts src/lib/constants.ts src/lib/settings.test.ts
git commit -m "feat: 类型扩展（language/auto 壁纸/署名）与壁纸常量"
```

---

### Task 3：测试语言钉死为 zh（保住现有中文断言）

i18n 默认 `auto` 会按 `navigator.language` 解析；jsdom 默认 `en-US` 会让 UI 变英文、导致现有中文断言失败。这里把测试环境语言钉成 `zh-CN`。

**Files:**
- Modify: `tests/setup.ts:1-2`

- [ ] **Step 1: 在 `tests/setup.ts` 顶部追加 navigator.language 钉死**

把开头两行：
```ts
import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';
```
改为：
```ts
import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// i18n：把测试环境语言钉成中文，使现有中文断言在 language:'auto' 下稳定通过。
// 需要 English 的用例请显式设置 settings.language='en'。
Object.defineProperty(globalThis.navigator, 'language', { value: 'zh-CN', configurable: true });
```

- [ ] **Step 2: 跑全量测试确认仍全绿（基线）**

Run: `npm test`
Expected: PASS（改动仅新增一行 stub，尚未接入 i18n，行为不变）。

- [ ] **Step 3: 提交**

```bash
git add tests/setup.ts
git commit -m "test: 钉死测试语言为 zh-CN 以适配后续 i18n"
```

## 阶段 2：i18n（#2）

### Task 4：i18n 核心库（`src/lib/i18n.ts`）+ 文案字典

**Files:**
- Create: `src/lib/i18n.ts`
- Test: `src/lib/i18n.test.ts`

- [ ] **Step 1: 写失败测试**

Create `src/lib/i18n.test.ts`:
```ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { t, resolveLang } from './i18n';

describe('i18n', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('translates by language', () => {
    expect(t('zh', 'tab.home')).toBe('主页');
    expect(t('en', 'tab.home')).toBe('Home');
  });

  it('interpolates params', () => {
    expect(t('en', 'options.currentRoot', { name: 'Work' })).toContain('Work');
    expect(t('zh', 'options.currentRoot', { name: '工作' })).toContain('工作');
  });

  it('resolveLang honors explicit setting', () => {
    expect(resolveLang('zh')).toBe('zh');
    expect(resolveLang('en')).toBe('en');
  });

  it('resolveLang auto follows navigator.language', () => {
    vi.stubGlobal('navigator', { language: 'zh-CN' });
    expect(resolveLang('auto')).toBe('zh');
    vi.stubGlobal('navigator', { language: 'en-US' });
    expect(resolveLang('auto')).toBe('en');
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/lib/i18n.test.ts`
Expected: FAIL（模块不存在）。

- [ ] **Step 3: 实现 `src/lib/i18n.ts`（含完整中英文案字典）**

```ts
import type { Language } from '@/types';

export type Lang = 'zh' | 'en';

export const messages = {
  en: {
    'tab.home': 'Home',
    'tab.enter': 'Enter this folder',
    'breadcrumb.root': 'Bookmarks',
    'action.settings': 'Settings',
    'action.newBookmark': 'New bookmark',
    'action.newFolder': 'New folder',
    'action.cancel': 'Cancel',
    'action.save': 'Save',
    'ctx.edit': 'Edit',
    'ctx.openNewTab': 'Open in new tab',
    'ctx.refreshThumb': 'Refresh thumbnail',
    'ctx.delete': 'Delete',
    'dialog.createBookmark': 'New bookmark',
    'dialog.createFolder': 'New folder',
    'dialog.editBookmark': 'Edit bookmark',
    'dialog.renameFolder': 'Rename folder',
    'dialog.title': 'Title',
    'dialog.url': 'URL',
    'empty.noBookmarks': 'No bookmarks in this folder yet',
    'empty.addBookmark': '+ New bookmark',
    'guidance.desc': 'Choose a default landing folder (shown when you open a new tab).',
    'guidance.select': 'Choose folder',
    'search.placeholder': 'Search bookmarks, or press Enter to search the web',
    'search.groupCurrent': 'Current folder',
    'search.groupOthers': 'Other folders',
    'search.noMatch': 'No matching bookmarks',
    'options.title': 'Real Speed Dial Settings',
    'options.instantHint': 'All changes apply instantly, no saving needed.',
    'options.saved': '✓ Saved',
    'options.preview': 'Open a new tab to preview',
    'options.rootTitle': 'Default landing folder',
    'options.rootHint': 'The folder shown by default on a new tab (you can still browse the whole tree).',
    'options.currentRoot': '✓ Current default: {name}',
    'options.unnamed': '(unnamed)',
    'options.noRoot': 'No folder selected yet; a new tab will prompt you to pick one here.',
    'options.appearance': 'Appearance',
    'options.language': 'Language',
    'options.langAuto': 'Auto',
    'options.langZh': '中文',
    'options.langEn': 'English',
    'options.tileStyle': 'Tile style',
    'options.tileFavicon': 'Icon + title',
    'options.tileTheme': 'Theme color',
    'options.tileShot': 'Screenshot',
    'options.captureDenied': 'Screenshot permission was not granted; keeping the current style',
    'options.autoReshot': 'Auto re-capture',
    'options.reshotAlways': 'Every time you visit the site',
    'options.reshotStale': 'Only when the existing screenshot is stale',
    'options.reshotNever': 'Never (manual refresh only)',
    'options.staleDays': 'Consider a screenshot stale after N days',
    'options.staleDaysUnit': 'days, then auto-update on next visit',
    'options.theme': 'Theme',
    'options.themeSystem': 'Follow system',
    'options.themeLight': 'Light',
    'options.themeDark': 'Dark',
    'options.background': 'Background',
    'options.bgColor': 'Solid color',
    'options.bgWallpaper': 'Wallpaper image',
    'options.bgAuto': 'Auto wallpaper (daily)',
    'options.bgColorLabel': 'Background color',
    'options.uploadWallpaper': 'Upload wallpaper',
    'options.columns': 'Columns',
    'options.openInNewTab': 'Open bookmarks in a new tab',
    'options.restore': 'Restore last position on open',
    'options.loading': 'Loading…',
    'options.wallpaperSource': 'Wallpaper source',
    'options.srcBing': 'Bing daily',
    'options.srcPicsum': 'Lorem Picsum (random)',
    'options.srcUnsplash': 'Unsplash (bring your own key)',
    'options.unsplashKey': 'Unsplash Access Key',
    'options.unsplashKeyPlaceholder': 'Paste your Access Key',
    'options.unsplashHelp': 'Get one from the Unsplash developers page',
    'options.unsplashNote': 'Using Unsplash shows photographer attribution per their guidelines; your key stays on this device only.',
    'options.shuffle': 'Shuffle',
    'attribution.by': 'Photo by',
    'attribution.on': 'on',
  },
  zh: {
    'tab.home': '主页',
    'tab.enter': '进入此目录',
    'breadcrumb.root': '书签',
    'action.settings': '设置',
    'action.newBookmark': '新增书签',
    'action.newFolder': '新增文件夹',
    'action.cancel': '取消',
    'action.save': '保存',
    'ctx.edit': '编辑',
    'ctx.openNewTab': '在新标签页打开',
    'ctx.refreshThumb': '刷新缩略图',
    'ctx.delete': '删除',
    'dialog.createBookmark': '新增书签',
    'dialog.createFolder': '新增文件夹',
    'dialog.editBookmark': '编辑书签',
    'dialog.renameFolder': '重命名文件夹',
    'dialog.title': '标题',
    'dialog.url': '网址',
    'empty.noBookmarks': '这个目录还没有书签',
    'empty.addBookmark': '+ 新增书签',
    'guidance.desc': '请先选择一个默认落地目录（新标签页打开时显示的目录）。',
    'guidance.select': '选择目录',
    'search.placeholder': '搜索书签，或按回车用搜索引擎搜索',
    'search.groupCurrent': '当前目录',
    'search.groupOthers': '其他目录',
    'search.noMatch': '没有匹配的书签',
    'options.title': 'Real Speed Dial 设置',
    'options.instantHint': '所有更改即时生效，无需保存。',
    'options.saved': '✓ 已保存',
    'options.preview': '打开新标签页查看效果',
    'options.rootTitle': '默认落地目录',
    'options.rootHint': '选择新标签页打开时默认显示的目录（仍可浏览整棵书签树）。',
    'options.currentRoot': '✓ 当前默认目录：{name}',
    'options.unnamed': '（未命名）',
    'options.noRoot': '尚未选择目录，新标签页会提示你来这里选择。',
    'options.appearance': '外观',
    'options.language': '语言',
    'options.langAuto': '自动',
    'options.langZh': '中文',
    'options.langEn': 'English',
    'options.tileStyle': '磁贴样式',
    'options.tileFavicon': '图标 + 标题',
    'options.tileTheme': '主题色背景',
    'options.tileShot': '网页截图',
    'options.captureDenied': '未授予截图所需权限，已保持当前样式',
    'options.autoReshot': '自动重新截图',
    'options.reshotAlways': '每次访问该网站时',
    'options.reshotStale': '仅当已有截图过旧时',
    'options.reshotNever': '从不（只手动刷新）',
    'options.staleDays': '截图超过多少天视为过旧',
    'options.staleDaysUnit': '天后再次访问时自动更新',
    'options.theme': '主题',
    'options.themeSystem': '跟随系统',
    'options.themeLight': '浅色',
    'options.themeDark': '深色',
    'options.background': '背景',
    'options.bgColor': '纯色',
    'options.bgWallpaper': '壁纸图片',
    'options.bgAuto': '自动壁纸（每日更新）',
    'options.bgColorLabel': '背景色',
    'options.uploadWallpaper': '上传壁纸',
    'options.columns': '列数',
    'options.openInNewTab': '在新标签页打开书签',
    'options.restore': '打开时恢复上次位置',
    'options.loading': '加载中…',
    'options.wallpaperSource': '壁纸来源',
    'options.srcBing': 'Bing 每日',
    'options.srcPicsum': 'Lorem Picsum 随机',
    'options.srcUnsplash': 'Unsplash（自备 Access Key）',
    'options.unsplashKey': 'Unsplash Access Key',
    'options.unsplashKeyPlaceholder': '粘贴你的 Access Key',
    'options.unsplashHelp': '到 Unsplash 开发者页面申请',
    'options.unsplashNote': '使用 Unsplash 会按其规范显示摄影师署名；Key 仅存于本机。',
    'options.shuffle': '换一张',
    'attribution.by': '摄影',
    'attribution.on': '来自',
  },
} as const;

export type MessageKey = keyof (typeof messages)['en'];

export function resolveLang(setting: Language): Lang {
  if (setting === 'zh' || setting === 'en') return setting;
  const nav = (globalThis.navigator?.language ?? 'en').toLowerCase();
  return nav.startsWith('zh') ? 'zh' : 'en';
}

export function t(lang: Lang, key: MessageKey, params?: Record<string, string | number>): string {
  const dict = messages[lang] as Record<string, string>;
  const en = messages.en as Record<string, string>;
  let s = dict[key] ?? en[key] ?? String(key);
  if (params) for (const [k, v] of Object.entries(params)) s = s.split(`{${k}}`).join(String(v));
  return s;
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/lib/i18n.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/lib/i18n.ts src/lib/i18n.test.ts
git commit -m "feat(i18n): 核心库 + 完整中英文案字典"
```

---

### Task 5：React i18n 上下文（`src/i18n.tsx`）+ `useI18n`

**Files:**
- Create: `src/i18n.tsx`
- Test: `src/i18n.test.tsx`

- [ ] **Step 1: 写失败测试**

Create `src/i18n.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nProvider, useI18n } from './i18n';

function Probe() {
  const { t, lang } = useI18n();
  return <div>{lang}:{t('tab.home')}</div>;
}

describe('I18nProvider', () => {
  it('provides zh translations', () => {
    render(<I18nProvider language="zh"><Probe /></I18nProvider>);
    expect(screen.getByText('zh:主页')).toBeInTheDocument();
  });
  it('provides en translations', () => {
    render(<I18nProvider language="en"><Probe /></I18nProvider>);
    expect(screen.getByText('en:Home')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/i18n.test.tsx`
Expected: FAIL（模块不存在）。

- [ ] **Step 3: 实现 `src/i18n.tsx`**

```tsx
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { resolveLang, t as translate, type Lang, type MessageKey } from '@/lib/i18n';
import type { Language } from '@/types';

export interface I18nValue {
  lang: Lang;
  t: (key: MessageKey, params?: Record<string, string | number>) => string;
}

// 默认值（无 Provider 时）：按 navigator.language 解析。
// 测试环境已把 navigator.language 钉成 zh-CN，故独立渲染的组件默认得到中文。
const I18nContext = createContext<I18nValue>({
  lang: resolveLang('auto'),
  t: (key, params) => translate(resolveLang('auto'), key, params),
});

export function I18nProvider({ language, children }: { language?: Language; children: ReactNode }) {
  const value = useMemo<I18nValue>(() => {
    const lang = resolveLang(language ?? 'auto');
    return { lang, t: (key, params) => translate(lang, key, params) };
  }, [language]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  return useContext(I18nContext);
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/i18n.test.tsx`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/i18n.tsx src/i18n.test.tsx
git commit -m "feat(i18n): React 上下文与 useI18n"
```

---

### Task 6：新标签页组件接入 i18n（ContextMenu / EditDialog / EmptyState / Guidance / SearchBar / App）

> TabBar 与 Breadcrumb 的 i18n 分别在 Task 10、Task 9 一并处理（避免重复改动）。独立组件测试无 Provider，靠默认 context（zh），现有中文断言不变。

**Files:**
- Modify: `src/newtab/components/ContextMenu.tsx`
- Modify: `src/newtab/components/EditDialog.tsx`
- Modify: `src/newtab/components/EmptyState.tsx`
- Modify: `src/newtab/components/Guidance.tsx`
- Modify: `src/newtab/components/SearchBar.tsx`
- Modify: `src/newtab/App.tsx`

- [ ] **Step 1: 改 `ContextMenu.tsx`**

顶部加 `import { useI18n } from '@/i18n';`，函数体首行加 `const { t } = useI18n();`，把四个按钮文案替换：
```tsx
      <button className="ctxmenu__item" onClick={() => onAction('edit')}>{t('ctx.edit')}</button>
      {!isFolder && <button className="ctxmenu__item" onClick={() => onAction('open-new-tab')}>{t('ctx.openNewTab')}</button>}
      {!isFolder && <button className="ctxmenu__item" onClick={() => onAction('refresh-thumb')}>{t('ctx.refreshThumb')}</button>}
      <button className="ctxmenu__item ctxmenu__item--danger" onClick={() => onAction('delete')}>{t('ctx.delete')}</button>
```

- [ ] **Step 2: 改 `EditDialog.tsx`**

顶部 `import { useI18n } from '@/i18n';`；函数体首行 `const { t } = useI18n();`；替换 titleMap 与标签/按钮：
```tsx
  const titleMap: Record<EditMode, string> = {
    'create-bookmark': t('dialog.createBookmark'), 'create-folder': t('dialog.createFolder'),
    'edit-bookmark': t('dialog.editBookmark'), 'rename-folder': t('dialog.renameFolder'),
  };
```
```tsx
        <label className="dialog-field"><span>{t('dialog.title')}</span>
          <input aria-label={t('dialog.title')} value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
        </label>
        {hasUrl && (
          <label className="dialog-field"><span>{t('dialog.url')}</span>
            <input aria-label={t('dialog.url')} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" />
          </label>
        )}
        <div className="dialog-actions">
          <button className="btn" onClick={onCancel}>{t('action.cancel')}</button>
          <button className="btn btn--primary" onClick={() => onSubmit(hasUrl ? { title, url } : { title })}>{t('action.save')}</button>
        </div>
```

- [ ] **Step 3: 改 `EmptyState.tsx`**

```tsx
import { useI18n } from '@/i18n';
interface Props { onAdd: () => void; }
export function EmptyState({ onAdd }: Props) {
  const { t } = useI18n();
  return (
    <div className="empty">
      <p>{t('empty.noBookmarks')}</p>
      <button className="btn" onClick={onAdd}>{t('empty.addBookmark')}</button>
    </div>
  );
}
```

- [ ] **Step 4: 改 `Guidance.tsx`**

```tsx
import { useI18n } from '@/i18n';
interface Props { onOpenOptions: () => void; }
export function Guidance({ onOpenOptions }: Props) {
  const { t } = useI18n();
  return (
    <div className="guidance">
      <h1>Real Speed Dial</h1>
      <p>{t('guidance.desc')}</p>
      <button className="btn btn--primary" onClick={onOpenOptions}>{t('guidance.select')}</button>
    </div>
  );
}
```

- [ ] **Step 5: 改 `SearchBar.tsx`**

顶部 `import { useI18n } from '@/i18n';`，函数体首行 `const { t } = useI18n();`，把 `placeholder="搜索书签，或按回车用搜索引擎搜索"` 改为 `placeholder={t('search.placeholder')}`。

- [ ] **Step 6: 改 `App.tsx`——挂 Provider + 本地 t + 本地化设置/FAB**

顶部新增导入：
```tsx
import { I18nProvider } from '@/i18n';
import { resolveLang, t as translate } from '@/lib/i18n';
```
在组件内（`const rootId = ...` 附近）加：
```tsx
  const lang = resolveLang(settings?.language ?? 'auto');
  const t = useCallback((key: Parameters<typeof translate>[1], params?: Parameters<typeof translate>[2]) => translate(lang, key, params), [lang]);
```
把设置按钮与两个 FAB 的中文替换为 `t(...)`：
- 设置按钮 `title="设置" aria-label="设置"` → `title={t('action.settings')} aria-label={t('action.settings')}`
- 新增文件夹 FAB `title="新增文件夹" aria-label="新增文件夹"` → `t('action.newFolder')`
- 新增书签 FAB `title="新增书签" aria-label="新增书签"` → `t('action.newBookmark')`

把结尾的三处 `return`（loading / guidance / view 主体）改为「先算 content 再用 Provider 包裹」：
```tsx
  let content: React.ReactNode;
  if (!settings || loading) content = <div className="loading" />;
  else if (!rootId) content = <Guidance onOpenOptions={openOptions} />;
  else if (!view) content = <div className="loading" />;
  else content = (
    <div className="app">
      {/* …原有 app 内 JSX 原样保留，其中中文按上面替换为 t(...)… */}
    </div>
  );
  return <I18nProvider language={settings?.language}>{content}</I18nProvider>;
```
> 注：搜索分支内的「搜索结果/没有匹配」文案在 Task 14 随搜索改造一并替换，本 Task 不动。

- [ ] **Step 7: 跑相关测试确认仍绿**

Run: `npx vitest run src/newtab/components/ContextMenu.test.tsx src/newtab/components/EditDialog.test.tsx src/newtab/components/States.test.tsx src/newtab/components/SearchBar.test.tsx src/newtab/App.test.tsx`
Expected: PASS（测试环境语言 zh，文案不变）。

- [ ] **Step 8: 提交**

```bash
git add src/newtab
git commit -m "feat(i18n): 新标签页组件接入 t()（含 App Provider）"
```

---

### Task 7：设置页接入 i18n + 语言下拉

**Files:**
- Modify: `src/options/Options.tsx`
- Test: `src/options/Options.test.tsx`（补语言切换用例）

- [ ] **Step 1: 写失败测试（切到英文后标题变英文）**

在 `src/options/Options.test.tsx` 的 `describe` 内新增（若文件顶部已 import 了 render/screen/installChromeMock 则复用）：
```ts
  it('switches UI language to English when language=en', async () => {
    await c.storage.sync.set({ [SETTINGS_KEY]: { rootFolderId: null, language: 'en' } });
    render(<Options />);
    expect(await screen.findByText('Real Speed Dial Settings')).toBeInTheDocument();
  });
```
（`Options.test.tsx` 顶部已有 `let c` 与 `import { SETTINGS_KEY }`，直接复用。）

并把该文件已有用例「shows confirmation ...」里的断言（因文案由「当前首页目录」改为「当前默认目录」）：
```tsx
    expect(await screen.findByText(/当前首页目录/)).toBeInTheDocument();
```
改为：
```tsx
    expect(await screen.findByText(/当前默认目录/)).toBeInTheDocument();
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/options/Options.test.tsx`
Expected: FAIL（当前标题为中文「Real Speed Dial 设置」）。

- [ ] **Step 3: 改 `Options.tsx`——本地 t + 语言下拉 + 全量文案替换**

顶部导入：
```tsx
import { resolveLang, t as translate } from '@/lib/i18n';
```
`if (!tree || !settings) return <div>加载中…</div>;` 改为使用默认语言的加载提示（settings 尚未就绪，用 `resolveLang('auto')`）：
```tsx
  if (!tree || !settings) return <div>{translate(resolveLang('auto'), 'options.loading')}</div>;
```
就绪后计算本地 t：
```tsx
  const lang = resolveLang(settings.language);
  const t = (key: Parameters<typeof translate>[1], params?: Parameters<typeof translate>[2]) => translate(lang, key, params);
```
把页面内所有中文替换为 `t(...)`（逐条对照 Task 4 字典 key）：标题 `options.title`、hint `options.instantHint`、已保存 `options.saved`、预览按钮 `options.preview`、根目录小节标题 `options.rootTitle`、根目录说明 `options.rootHint`、当前目录 `t('options.currentRoot',{name: selectedFolder.title || t('options.unnamed')})`、未选择 `options.noRoot`、外观 `options.appearance`、磁贴样式与三选项、截图权限提示 `options.captureDenied`、自动重新截图与三选项、过旧天数与单位、主题与三选项、背景与选项、背景色、上传壁纸、列数、在新标签打开、恢复上次位置。
在「外观」小节最前面新增语言下拉：
```tsx
        <label className="field">
          <span>{t('options.language')}</span>
          <select aria-label={t('options.language')} value={settings.language} onChange={(e) => void patch({ language: e.target.value as Settings['language'] })}>
            <option value="auto">{t('options.langAuto')}</option>
            <option value="zh">{t('options.langZh')}</option>
            <option value="en">{t('options.langEn')}</option>
          </select>
        </label>
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/options/Options.test.tsx`
Expected: PASS（中文用例仍绿 + 新英文用例通过）。

- [ ] **Step 5: 类型检查 + 提交**

Run: `npm run build`
Expected: 通过。

```bash
git add src/options/Options.tsx src/options/Options.test.tsx
git commit -m "feat(i18n): 设置页接入 t() 并新增语言下拉"
```

## 阶段 3：导航（整树 + 面包屑 + 进入按钮）

### Task 8：整树加载 + 默认落地初始化（#3 数据层）

**Files:**
- Modify: `src/newtab/hooks/useBookmarkTree.ts`
- Modify: `src/lib/navState.ts:16-28`
- Modify: `src/newtab/App.tsx`
- Test: `src/newtab/hooks/useBookmarkTree.test.ts`（重写）
- Test: `src/newtab/App.test.tsx`（改 mock 与两处断言）

- [ ] **Step 1: 重写 `useBookmarkTree.test.ts`（改为整树）**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { installChromeMock, type ChromeMock } from '../../../tests/setup';
import { useBookmarkTree } from './useBookmarkTree';

let c: ChromeMock;
beforeEach(() => { c = installChromeMock(); });

describe('useBookmarkTree', () => {
  it('loads the whole bookmark tree (root id 0)', async () => {
    c.bookmarks.getTree.mockResolvedValue([{ id: '0', title: '', children: [] }]);
    const { result } = renderHook(() => useBookmarkTree());
    await waitFor(() => expect(result.current.root?.id).toBe('0'));
  });
  it('reloads on bookmark change event', async () => {
    c.bookmarks.getTree.mockResolvedValue([{ id: '0', title: '', children: [{ id: '1', title: '书签栏', children: [] }] }]);
    const { result } = renderHook(() => useBookmarkTree());
    await waitFor(() => expect(result.current.root).toBeTruthy());
    c.bookmarks.getTree.mockResolvedValue([{ id: '0', title: '', children: [{ id: '1', title: 'BookmarksBar', children: [] }] }]);
    act(() => { c.bookmarks.onChanged._emit(); });
    await waitFor(() => expect(result.current.root?.children?.[0].title).toBe('BookmarksBar'));
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/newtab/hooks/useBookmarkTree.test.ts`
Expected: FAIL（当前 hook 需 rootId 且用 getSubTree）。

- [ ] **Step 3: 重写 `src/newtab/hooks/useBookmarkTree.ts`**

```ts
import { useCallback, useEffect, useState } from 'react';
import { getTree, onBookmarksChanged } from '@/lib/bookmarks';
import type { BookmarkNode } from '@/types';

// 加载整棵书签树（根节点 id="0"）。落地目录由 App 用 settings.rootFolderId 决定，与加载无关。
export function useBookmarkTree() {
  const [root, setRoot] = useState<BookmarkNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const tree = await getTree();
      setRoot(tree[0] ?? null);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setRoot(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => onBookmarksChanged(() => { void reload(); }), [reload]);

  return { root, loading, error, reload };
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/newtab/hooks/useBookmarkTree.test.ts`
Expected: PASS

- [ ] **Step 5: 修改 `resolveInitialNav` 增加落地目录参数**

把 `src/lib/navState.ts` 的 `resolveInitialNav` 整体替换为：
```ts
export function resolveInitialNav(
  root: BookmarkNode,
  saved: NavState | null,
  restoreEnabled: boolean,
  landingId?: string,
): NavState {
  // 默认落地：优先配置目录；失效则回退到「书签栏」(id="1")；再退到整树根。
  const landing = landingId && findNode(root, landingId)
    ? landingId
    : (findNode(root, '1') ? '1' : root.id);
  const fallback: NavState = { currentFolderId: landing, selectedTabId: HOME_TAB_ID };
  if (!restoreEnabled || !saved) return fallback;
  const folder = findNode(root, saved.currentFolderId);
  if (!folder) return fallback;
  const tabs = buildTabs(folder);
  const tabValid = tabs.some((t) => t.id === saved.selectedTabId);
  return { currentFolderId: folder.id, selectedTabId: tabValid ? saved.selectedTabId : HOME_TAB_ID };
}
```
> 现有 `navState.validate.test.ts` 用 3 参调用、树中无 id="1"，落地回退到 `root.id`，断言不变，保持通过。

- [ ] **Step 6: 修改 `App.tsx` 用整树 + 传落地目录**

- 把 `const { root, loading } = useBookmarkTree(rootId);` 改为 `const { root, loading } = useBookmarkTree();`
- 把初始化那行：
```tsx
    const init = resolveInitialNav(root, navState, settings?.restoreLastPosition ?? true);
```
改为：
```tsx
    const init = resolveInitialNav(root, navState, settings?.restoreLastPosition ?? true, rootId ?? undefined);
```

- [ ] **Step 7: 重写 `App.test.tsx`（整树 mock + 落地='1' + 两处断言）**

把文件顶部 tree 定义与 `beforeEach` 改为：
```tsx
const tree = { id: '0', title: '', children: [
  { id: '1', title: '书签栏', children: [
    { id: 'b1', title: 'GitHub', url: 'https://github.com', index: 0 },
    { id: 'f1', title: '工作', index: 1, children: [
      { id: 'b2', title: 'Jira', url: 'https://jira.com', index: 0 },
      { id: 'f2', title: '后端', index: 1, children: [
        { id: 'b3', title: 'MySQL', url: 'https://mysql.com', index: 0 },
      ] },
    ] },
  ] },
] };

beforeEach(async () => {
  c = installChromeMock();
  await c.storage.sync.set({ [SETTINGS_KEY]: { rootFolderId: '1' } });
  c.bookmarks.getTree.mockResolvedValue([tree]);
});
```
把「drills into folder tile」用例里的断言：
```tsx
    expect(screen.getByRole('button', { name: /根/ })).toBeInTheDocument();
```
改为（面包屑此时为 书签 › 书签栏 › 工作 › 后端，断言可点的「工作」在）：
```tsx
    expect(screen.getByRole('button', { name: '工作' })).toBeInTheDocument();
```
把「restores root Home when browser Back」用例里两处：
```tsx
    expect(screen.getByRole('button', { name: /根/ })).toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate', { state: { folderId: 'root', tabId: '__home__' } }));
    });
```
改为：
```tsx
    expect(screen.getByRole('button', { name: '工作' })).toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate', { state: { folderId: '1', tabId: '__home__' } }));
    });
```
> 其余用例不变（「搜索」用例仍断言 `/搜索结果/`，将在 Task 14 更新）。

- [ ] **Step 8: 跑相关测试**

Run: `npx vitest run src/lib/navState.validate.test.ts src/newtab/App.test.tsx`
Expected: PASS

- [ ] **Step 9: 提交**

```bash
git add src/newtab/hooks/useBookmarkTree.ts src/newtab/hooks/useBookmarkTree.test.ts src/lib/navState.ts src/newtab/App.tsx src/newtab/App.test.tsx
git commit -m "feat(nav): 加载整棵书签树 + 落地目录初始化（#3 数据层）"
```

---

### Task 9：面包屑根节点渲染 + 可点回归测试（#3 视图层）

**Files:**
- Modify: `src/newtab/components/Breadcrumb.tsx`
- Test: `src/newtab/App.test.tsx`（新增祖先级点击回归用例）

- [ ] **Step 1: 改 `Breadcrumb.tsx`——根级标题回退为本地化「书签」**

顶部加 `import { useI18n } from '@/i18n';`；函数体首行加 `const { t } = useI18n();`；把 `{c.title}` 那段（label 定义里）改为：
```tsx
            {isHome ? (c.title || t('breadcrumb.root')) : c.title}
```
（即根节点 `id="0"` 空标题时显示「书签 / Bookmarks」，其余显示真实标题。）

- [ ] **Step 2: 写失败测试（App 集成：点面包屑祖先级回到该级）**

在 `src/newtab/App.test.tsx` 的 `describe('App navigation')` 内新增：
```tsx
  it('navigates back to an ancestor when a breadcrumb crumb is clicked', async () => {
    render(<App />);
    await screen.findByRole('tab', { name: '工作' });
    await userEvent.click(screen.getByRole('tab', { name: '工作' }));
    await userEvent.click(await screen.findByText('后端'));
    await waitFor(() => expect(screen.getByText('MySQL')).toBeInTheDocument());
    // 面包屑：书签 › 书签栏 › 工作 › 后端；点「书签栏」应回到其主页（GitHub 可见，MySQL 消失）
    await userEvent.click(screen.getByRole('button', { name: '书签栏' }));
    await waitFor(() => expect(screen.getByText('GitHub')).toBeInTheDocument());
    expect(screen.queryByText('MySQL')).not.toBeInTheDocument();
  });
```

- [ ] **Step 3: 跑测试确认通过**

Run: `npx vitest run src/newtab/App.test.tsx src/newtab/components/Grid.test.tsx`
Expected: PASS（Grid.test 的 Breadcrumb 用例用非空标题「根」，不受影响）。

- [ ] **Step 4: 提交**

```bash
git add src/newtab/components/Breadcrumb.tsx src/newtab/App.test.tsx
git commit -m "feat(nav): 面包屑根节点显示为本地化「书签」+ 祖先级点击回归"
```

---

### Task 10：Tab「进入」按钮（#4）+ Home 标签本地化

**Files:**
- Modify: `src/newtab/components/TabBar.tsx`（重写）
- Modify: `src/newtab/App.tsx`（TabBar 接线 onEnter）
- Modify: `src/newtab/styles.css`（进入按钮样式）
- Test: `src/newtab/components/TabBar.test.tsx`（重写：补 onEnter + 进入按钮用例）

- [ ] **Step 1: 重写 `TabBar.test.tsx`**

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
    render(<TabBar tabs={tabs} activeTabId="f1" onSelect={() => {}} onEnter={() => {}} />);
    expect(screen.getByRole('tab', { name: '工作' })).toHaveAttribute('aria-selected', 'true');
  });
  it('calls onSelect on click', async () => {
    const onSelect = vi.fn();
    render(<TabBar tabs={tabs} activeTabId="f1" onSelect={onSelect} onEnter={() => {}} />);
    await userEvent.click(screen.getByRole('tab', { name: '主页' }));
    expect(onSelect).toHaveBeenCalledWith(HOME_TAB_ID);
  });
  it('shows an Enter button only on the active non-home tab and calls onEnter', async () => {
    const onEnter = vi.fn();
    render(<TabBar tabs={tabs} activeTabId="f1" onSelect={() => {}} onEnter={onEnter} />);
    const enter = screen.getByRole('button', { name: '进入此目录' });
    await userEvent.click(enter);
    expect(onEnter).toHaveBeenCalledWith('f1');
  });
  it('hides Enter button when the active tab is Home', () => {
    render(<TabBar tabs={tabs} activeTabId={HOME_TAB_ID} onSelect={() => {}} onEnter={() => {}} />);
    expect(screen.queryByRole('button', { name: '进入此目录' })).not.toBeInTheDocument();
  });
  it('renders nothing when only Home tab', () => {
    const { container } = render(
      <TabBar tabs={[{ id: HOME_TAB_ID, title: '主页', isHome: true }]} activeTabId={HOME_TAB_ID} onSelect={() => {}} onEnter={() => {}} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/newtab/components/TabBar.test.tsx`
Expected: FAIL（onEnter 未定义 / 无进入按钮）。

- [ ] **Step 3: 重写 `src/newtab/components/TabBar.tsx`**

```tsx
import type { TabModel } from '@/types';
import { useI18n } from '@/i18n';

interface Props {
  tabs: TabModel[];
  activeTabId: string;
  onSelect: (id: string) => void;
  onEnter: (id: string) => void;
}

export function TabBar({ tabs, activeTabId, onSelect, onEnter }: Props) {
  const { t } = useI18n();
  const onlyHome = tabs.length === 1 && tabs[0].isHome;
  if (tabs.length === 0 || onlyHome) return null;
  return (
    <div className="tabbar" role="tablist">
      {tabs.map((tab) => {
        const active = tab.id === activeTabId;
        return (
          <span key={tab.id} className={`tab-wrap ${active ? 'tab-wrap--active' : ''}`}>
            <button
              role="tab"
              aria-selected={active}
              className={`tab ${active ? 'tab--active' : ''}`}
              onClick={() => onSelect(tab.id)}
            >
              {tab.isHome ? t('tab.home') : tab.title}
            </button>
            {active && !tab.isHome && (
              <button
                type="button"
                className="tab__enter"
                aria-label={t('tab.enter')}
                title={t('tab.enter')}
                onClick={(e) => { e.stopPropagation(); onEnter(tab.id); }}
              >
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M4 4v7a4 4 0 0 0 4 4h12" />
                  <path d="M15 11l4 4-4 4" />
                </svg>
              </button>
            )}
          </span>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/newtab/components/TabBar.test.tsx`
Expected: PASS

- [ ] **Step 5: `App.tsx` 给 TabBar 接线 onEnter**

把：
```tsx
          <TabBar tabs={view.tabs} activeTabId={view.activeTabId} onSelect={(id) => navigate(view.folderId, id, true)} />
```
改为：
```tsx
          <TabBar tabs={view.tabs} activeTabId={view.activeTabId} onSelect={(id) => navigate(view.folderId, id, true)} onEnter={(id) => navigate(id, HOME_TAB_ID, true)} />
```

- [ ] **Step 6: `styles.css` 新增进入按钮样式**

在 `.tab--active { ... }` 之后追加：
```css
.tab-wrap { position: relative; display: inline-flex; align-items: center; }
.tab-wrap--active .tab { padding-right: 34px; }
.tab__enter { position: absolute; right: 4px; top: 50%; transform: translateY(-50%); display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; padding: 0; border: none; border-radius: 6px; background: rgba(255,255,255,.18); color: #fff; cursor: pointer; }
.tab__enter:hover { background: rgba(255,255,255,.3); }
.tab__enter svg { display: block; }
```

- [ ] **Step 7: 全量测试 + 构建**

Run: `npm test`
Expected: PASS
Run: `npm run build`
Expected: 通过。

- [ ] **Step 8: 提交**

```bash
git add src/newtab/components/TabBar.tsx src/newtab/components/TabBar.test.tsx src/newtab/App.tsx src/newtab/styles.css
git commit -m "feat(nav): 激活子目录 Tab 的「进入」按钮 + Home 标签本地化（#4）"
```

## 阶段 4：磁贴

### Task 11：书签磁贴改真链接 `<a href>`（#6）

**Files:**
- Modify: `src/newtab/components/Tile.tsx`（重写）
- Modify: `src/newtab/components/Grid.tsx`
- Modify: `src/newtab/App.tsx`
- Test: `src/newtab/components/Tile.test.tsx`（重写角色断言）
- Test: `src/newtab/components/Grid.test.tsx`（改为断言链接）

- [ ] **Step 1: 重写 `Tile.test.tsx`**

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { installChromeMock } from '../../../tests/setup';
import { Tile } from './Tile';
import { FolderTile } from './FolderTile';
import userEvent from '@testing-library/user-event';

beforeEach(() => { installChromeMock(); });

describe('Tile', () => {
  it('renders title and is a link to the url', () => {
    render(<Tile id="b" title="GitHub" url="https://github.com" onContextMenu={() => {}} />);
    const link = screen.getByRole('link', { name: /GitHub/ });
    expect(link).toHaveAttribute('href', 'https://github.com');
  });

  it('opens in a new tab when openInNewTab is set', () => {
    render(<Tile id="b" title="GitHub" url="https://github.com" openInNewTab onContextMenu={() => {}} />);
    expect(screen.getByRole('link', { name: /GitHub/ })).toHaveAttribute('target', '_blank');
  });

  it('opens in the same tab by default (no target)', () => {
    render(<Tile id="b" title="GitHub" url="https://github.com" onContextMenu={() => {}} />);
    expect(screen.getByRole('link', { name: /GitHub/ })).not.toHaveAttribute('target');
  });

  it('renders the screenshot image when a thumbnail is provided', () => {
    const { container } = render(
      <Tile id="b" title="GitHub" url="https://github.com" thumbnail="data:img" onContextMenu={() => {}} />,
    );
    const shot = container.querySelector('img.tile__screenshot');
    expect(shot).toBeInTheDocument();
    expect(shot).toHaveAttribute('src', 'data:img');
  });

  it('renders a small favicon in the corner by default', () => {
    const { container } = render(
      <Tile id="b" title="GitHub" url="https://github.com" onContextMenu={() => {}} />,
    );
    const fav = container.querySelector('.tile__fav img');
    expect(fav).toBeInTheDocument();
    expect(fav?.getAttribute('src')).toContain('/_favicon/');
    expect(container.querySelector('img.tile__screenshot')).toBeNull();
  });

  it('falls back to the first-letter block when the favicon fails to load', () => {
    const { container } = render(
      <Tile id="b" title="GitHub" url="https://github.com" onContextMenu={() => {}} />,
    );
    const fav = container.querySelector('.tile__fav img');
    fireEvent.error(fav!);
    expect(container.querySelector('.tile__fav img')).toBeNull();
    const letter = screen.getByText('G');
    expect(letter).toHaveClass('tile__fav-letter');
  });

  it('applies a theme-color gradient background in themeColor style without a thumbnail', () => {
    render(<Tile id="b" title="GitHub" url="https://github.com" tileStyle="themeColor" onContextMenu={() => {}} />);
    expect(screen.getByRole('link', { name: /GitHub/ }).getAttribute('style')).toContain('linear-gradient');
  });

  it('does not add a gradient in favicon style', () => {
    render(<Tile id="b" title="GitHub" url="https://github.com" tileStyle="favicon" onContextMenu={() => {}} />);
    expect(screen.getByRole('link', { name: /GitHub/ }).getAttribute('style') ?? '').not.toContain('linear-gradient');
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

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/newtab/components/Tile.test.tsx`
Expected: FAIL（当前 Tile 是 `<button>`，无 link 角色/href）。

- [ ] **Step 3: 重写 `src/newtab/components/Tile.tsx`**

```tsx
import { useState } from 'react';
import { faviconUrl, firstLetter, colorFromString } from '@/lib/favicon';
import type { TileStyle } from '@/types';

interface Props {
  id: string;
  title: string;
  url: string;
  thumbnail?: string;
  tileStyle?: TileStyle;
  openInNewTab?: boolean;
  onContextMenu: (e: React.MouseEvent, id: string) => void;
}

// 书签磁贴是真正的 <a>：浏览器原生在左下角显示网址，并支持中键/Cmd 点击、右键复制链接。
// draggable=false 让 dnd-kit 的指针拖拽不被原生链接/图片拖拽劫持。
export function Tile({ id, title, url, thumbnail, tileStyle = 'favicon', openInNewTab, onContextMenu }: Props) {
  const [imgOk, setImgOk] = useState(true);
  const themeMode = !thumbnail && (tileStyle === 'themeColor' || tileStyle === 'screenshot');
  return (
    <a
      className={`tile${thumbnail ? ' tile--shot' : ''}${themeMode ? ' tile--theme' : ''}`}
      href={url}
      target={openInNewTab ? '_blank' : undefined}
      rel={openInNewTab ? 'noopener noreferrer' : undefined}
      draggable={false}
      style={themeMode ? { background: `linear-gradient(135deg, ${colorFromString(url)}, #262a3d)` } : undefined}
      onContextMenu={(e) => onContextMenu(e, id)}
      title={title}
    >
      {thumbnail && <img src={thumbnail} alt="" className="tile__screenshot" draggable={false} />}
      <span className="tile__fav">
        {imgOk ? (
          <img src={faviconUrl(url, 32)} alt="" draggable={false} onError={() => setImgOk(false)} />
        ) : (
          <span className="tile__fav-letter" style={{ background: colorFromString(url) }}>{firstLetter(url)}</span>
        )}
      </span>
      <span className="tile__title">{title}</span>
    </a>
  );
}
```

- [ ] **Step 4: 重写 `Grid.test.tsx` 的 Grid 用例（Breadcrumb 用例保持不动）**

把 `describe('Grid', ...)` 整块替换为：
```tsx
describe('Grid', () => {
  it('renders bookmarks as links and folders trigger onEnter', async () => {
    const onEnter = vi.fn();
    render(<Grid items={items} columns={6} thumbnails={{}} tileStyle="favicon" openInNewTab={false} onEnter={onEnter} onContextMenu={() => {}} onReorder={() => {}} onMoveInto={() => {}} />);
    expect(screen.getByRole('link', { name: /GitHub/ })).toHaveAttribute('href', 'https://github.com');
    await userEvent.click(screen.getByText(/工作/));
    expect(onEnter).toHaveBeenCalledWith('f');
  });
});
```

- [ ] **Step 5: 修改 `Grid.tsx`（去 onOpen，加 openInNewTab）**

- Props 接口：删除 `onOpen: (url: string) => void;`，新增 `openInNewTab: boolean;`
- 解构处相应改名。
- 渲染书签处：
```tsx
                <Tile id={it.id} title={it.title} url={it.url} thumbnail={thumbnails[it.url]} tileStyle={tileStyle} openInNewTab={openInNewTab} onContextMenu={onContextMenu} />
```

- [ ] **Step 6: 修改 `App.tsx`（删除 openUrl，Grid/搜索磁贴改 openInNewTab）**

- 删除 `const openUrl = useCallback(...)` 整段（约 4 行）。
- Grid：把 `onOpen={openUrl}` 改为 `openInNewTab={settings.openInNewTab}`。
- 搜索分支里的 `<Tile ... onOpen={openUrl} ... />` 改为 `<Tile ... openInNewTab={settings.openInNewTab} ... />`（该分支将在 Task 14 整体替换，这里先保编译通过）。

- [ ] **Step 7: 跑测试 + 构建**

Run: `npx vitest run src/newtab/components/Tile.test.tsx src/newtab/components/Grid.test.tsx src/newtab/App.test.tsx`
Expected: PASS
Run: `npm run build`
Expected: 通过（无未使用变量报错）。

- [ ] **Step 8: 提交**

```bash
git add src/newtab/components/Tile.tsx src/newtab/components/Tile.test.tsx src/newtab/components/Grid.tsx src/newtab/components/Grid.test.tsx src/newtab/App.tsx
git commit -m "feat(tile): 书签磁贴改真链接（原生状态栏显示网址）（#6）"
```

> 手动验证（无法在 jsdom 可靠断言）：拖拽排序后松手不会误触发跳转；hover 磁贴时浏览器左下角显示网址；中键/Cmd 点击新标签打开。

---

### Task 12：主题色磁贴文字可读性（#5）

**Files:**
- Modify: `src/newtab/styles.css`
- Test: `src/newtab/components/Tile.test.tsx`（补一条 class 断言）

- [ ] **Step 1: 补失败测试**

在 `Tile.test.tsx` 的 `describe('Tile')` 内新增：
```tsx
  it('adds the readable theme layer class in themeColor mode', () => {
    render(<Tile id="b" title="GitHub" url="https://github.com" tileStyle="themeColor" onContextMenu={() => {}} />);
    expect(screen.getByRole('link', { name: /GitHub/ })).toHaveClass('tile--theme');
  });
```

- [ ] **Step 2: 跑测试**

Run: `npx vitest run src/newtab/components/Tile.test.tsx`
Expected: PASS（Task 11 已在 themeMode 下加了 `tile--theme` 类，本条应直接通过；若失败说明 Task 11 类名未加，回补）。

- [ ] **Step 3: `styles.css` 追加可读层样式**

在 `.tile--shot::after { ... }` 之后追加：
```css
.tile--theme::after { content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 60%; background: linear-gradient(180deg, transparent, rgba(0,0,0,.6)); z-index: 1; pointer-events: none; }
.tile__title { text-shadow: 0 1px 3px rgba(0,0,0,.55); }
.tile__fav-letter { text-shadow: 0 1px 2px rgba(0,0,0,.5); }
```
> `.tile__title`/`.tile__fav-letter` 已有其他属性；此处同选择器追加只补 `text-shadow`，其余属性不受影响。`.tile` 已是 `position: relative; isolation: isolate`，`::after` 定位正确、层级在标题（z-index:2）之下。

- [ ] **Step 4: 构建 + 提交**

Run: `npm run build`
Expected: 通过。

```bash
git add src/newtab/styles.css src/newtab/components/Tile.test.tsx
git commit -m "feat(tile): 主题色磁贴暗色蒙层+文字阴影，统一可读层（#5）"
```

## 阶段 5：搜索增强（§8）

### Task 13：`searchBookmarks`（整树 + 分组 + 路径）

**Files:**
- Modify: `src/lib/search.ts`（新增，不删旧函数）
- Test: `src/lib/search.test.ts`（新增用例）

- [ ] **Step 1: 追加失败测试**

在 `src/lib/search.test.ts` 顶部 import 处补 `searchBookmarks`，并在文件末尾追加：
```ts
const tree2 = { id: '0', title: '', children: [
  { id: '1', title: '书签栏', children: [
    { id: 'b1', title: 'GitHub', url: 'https://github.com' },
    { id: 'work', title: '工作', children: [
      { id: 'b2', title: 'Jira Board', url: 'https://jira.com' },
      { id: 'proj', title: '项目A', children: [
        { id: 'b3', title: 'Jira Sprint', url: 'https://jira.com/sprint' },
      ] },
    ] },
    { id: 'study', title: '学习', children: [
      { id: 'b4', title: 'Jira Tutorial', url: 'https://learn.com/jira' },
    ] },
  ] },
] } as const;

describe('searchBookmarks', () => {
  it('searches the whole tree and groups by current folder subtree', () => {
    const r = searchBookmarks(tree2 as never, 'jira', 'work');
    expect(r.current.map((h) => h.id)).toEqual(['b2', 'b3']);
    expect(r.others.map((h) => h.id)).toEqual(['b4']);
  });
  it('attaches the full folder path excluding the invisible root', () => {
    const r = searchBookmarks(tree2 as never, 'sprint', 'work');
    expect(r.current[0].path.map((c) => c.title)).toEqual(['书签栏', '工作', '项目A']);
  });
  it('returns empty groups for blank query', () => {
    expect(searchBookmarks(tree2 as never, '  ', 'work')).toEqual({ current: [], others: [] });
  });
  it('treats all hits as current when current folder is the root', () => {
    const r = searchBookmarks(tree2 as never, 'jira', '0');
    expect(r.current.map((h) => h.id)).toEqual(['b2', 'b3', 'b4']);
    expect(r.others).toEqual([]);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/lib/search.test.ts`
Expected: FAIL（`searchBookmarks` 未定义）。

- [ ] **Step 3: 在 `src/lib/search.ts` 追加实现（保留原有函数）**

在文件顶部 import 改为：
```ts
import type { BookmarkNode, SpeedDialBookmark, Crumb } from '@/types';
```
在文件末尾追加：
```ts
export interface SearchHit { id: string; title: string; url: string; path: Crumb[]; }
export interface GroupedSearch { current: SearchHit[]; others: SearchHit[]; }

// 整棵树搜索；命中位于 currentFolderId 子树内 → current，否则 others。
// path = 从顶层书签目录到该书签父目录的文件夹链（排除不可见根 id="0"）。
export function searchBookmarks(root: BookmarkNode, query: string, currentFolderId: string): GroupedSearch {
  const q = query.trim().toLowerCase();
  const current: SearchHit[] = [];
  const others: SearchHit[] = [];
  if (!q) return { current, others };
  const stack: Crumb[] = [];
  const walk = (node: BookmarkNode, inCurrent: boolean) => {
    for (const c of node.children ?? []) {
      if (c.url) {
        if (c.title.toLowerCase().includes(q) || c.url.toLowerCase().includes(q)) {
          (inCurrent ? current : others).push({ id: c.id, title: c.title, url: c.url, path: stack.slice() });
        }
      } else {
        stack.push({ id: c.id, title: c.title });
        walk(c, inCurrent || c.id === currentFolderId);
        stack.pop();
      }
    }
  };
  walk(root, root.id === currentFolderId);
  return { current, others };
}
```
> 保留 `flattenBookmarks` / `filterBookmarks` / `buildSearchUrl` 不动（`SpeedDialBookmark` 仍被它们使用）。

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/lib/search.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/lib/search.ts src/lib/search.test.ts
git commit -m "feat(search): 整树搜索 + 当前/其他分组 + 完整路径（§8）"
```

---

### Task 14：SearchResults 组件 + App 搜索分支接线

**Files:**
- Create: `src/newtab/components/SearchResults.tsx`
- Test: `src/newtab/components/SearchResults.test.tsx`
- Modify: `src/newtab/App.tsx`
- Modify: `src/newtab/styles.css`
- Test: `src/newtab/App.test.tsx`（更新搜索用例）

- [ ] **Step 1: 写 SearchResults 失败测试**

Create `src/newtab/components/SearchResults.test.tsx`:
```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { installChromeMock } from '../../../tests/setup';
import { SearchResults } from './SearchResults';
import type { GroupedSearch } from '@/lib/search';

beforeEach(() => { installChromeMock(); });

const results: GroupedSearch = {
  current: [{ id: 'b2', title: 'Jira Board', url: 'https://jira.com', path: [{ id: '1', title: '书签栏' }, { id: 'work', title: '工作' }] }],
  others: [{ id: 'b4', title: 'Jira Tutorial', url: 'https://learn.com/jira', path: [{ id: '1', title: '书签栏' }, { id: 'study', title: '学习' }] }],
};

describe('SearchResults', () => {
  it('renders grouped rows with links and full paths', () => {
    render(<SearchResults results={results} openInNewTab={false} onContextMenu={() => {}} />);
    expect(screen.getByText('当前目录')).toBeInTheDocument();
    expect(screen.getByText('其他目录')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Jira Board/ })).toHaveAttribute('href', 'https://jira.com');
    expect(screen.getByText('书签栏 › 工作')).toBeInTheDocument();
  });
  it('shows empty state when no hits', () => {
    render(<SearchResults results={{ current: [], others: [] }} openInNewTab={false} onContextMenu={() => {}} />);
    expect(screen.getByText('没有匹配的书签')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/newtab/components/SearchResults.test.tsx`
Expected: FAIL（组件不存在）。

- [ ] **Step 3: 实现 `src/newtab/components/SearchResults.tsx`**

```tsx
import type { GroupedSearch, SearchHit } from '@/lib/search';
import { faviconUrl } from '@/lib/favicon';
import { useI18n } from '@/i18n';

interface Props {
  results: GroupedSearch;
  openInNewTab: boolean;
  onContextMenu: (e: React.MouseEvent, id: string) => void;
}

function Row({ hit, openInNewTab, onContextMenu }: { hit: SearchHit; openInNewTab: boolean; onContextMenu: (e: React.MouseEvent, id: string) => void; }) {
  const pathText = hit.path.map((c) => c.title).join(' › ');
  return (
    <a
      className="sresult"
      href={hit.url}
      target={openInNewTab ? '_blank' : undefined}
      rel={openInNewTab ? 'noopener noreferrer' : undefined}
      onContextMenu={(e) => onContextMenu(e, hit.id)}
    >
      <img className="sresult__fav" src={faviconUrl(hit.url, 32)} alt="" draggable={false}
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }} />
      <span className="sresult__text">
        <span className="sresult__title">{hit.title}</span>
        {pathText && <span className="sresult__path">{pathText}</span>}
      </span>
    </a>
  );
}

export function SearchResults({ results, openInNewTab, onContextMenu }: Props) {
  const { t } = useI18n();
  if (results.current.length + results.others.length === 0) {
    return <div className="empty"><p>{t('search.noMatch')}</p></div>;
  }
  return (
    <div className="sresults">
      {results.current.length > 0 && (
        <section>
          <p className="sresults__group">{t('search.groupCurrent')}</p>
          {results.current.map((h) => <Row key={h.id} hit={h} openInNewTab={openInNewTab} onContextMenu={onContextMenu} />)}
        </section>
      )}
      {results.others.length > 0 && (
        <section>
          <p className="sresults__group">{t('search.groupOthers')}</p>
          {results.others.map((h) => <Row key={h.id} hit={h} openInNewTab={openInNewTab} onContextMenu={onContextMenu} />)}
        </section>
      )}
    </div>
  );
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/newtab/components/SearchResults.test.tsx`
Expected: PASS

- [ ] **Step 5: 改 `App.tsx` 接线搜索**

- 顶部导入：把 `import { filterBookmarks, buildSearchUrl } from '@/lib/search';` 改为 `import { searchBookmarks, buildSearchUrl } from '@/lib/search';`；新增 `import { SearchResults } from './components/SearchResults';`；删除不再使用的 `import { Tile } from './components/Tile';`。
- 把 `searchResults` 计算改为：
```tsx
  const searchResults = useMemo(
    () => (root && folderId !== null ? searchBookmarks(root, query, folderId) : { current: [], others: [] }),
    [root, query, folderId],
  );
```
- 把 `findItem` 改为在分组命中中查找：
```tsx
  const findItem = useCallback(
    (id: string) => {
      const inView = view?.items.find((it) => it.id === id);
      if (inView) return inView;
      const hit = [...searchResults.current, ...searchResults.others].find((b) => b.id === id);
      return hit ? ({ kind: 'bookmark', id: hit.id, title: hit.title, url: hit.url, index: 0 } as const) : undefined;
    },
    [view, searchResults],
  );
```
- 把搜索分支整段：
```tsx
      {searching ? (
        <>
          <p className="search-header">搜索结果：{searchResults.length} 个匹配「{query.trim()}」</p>
          {searchResults.length === 0 ? (
            <div className="empty"><p>没有匹配的书签</p></div>
          ) : (
            <div className="grid" style={{ ['--cols']: String(settings.columns) } as React.CSSProperties}>
              {searchResults.map((b) => (
                <div className="grid__cell" key={b.id}>
                  <Tile id={b.id} title={b.title} url={b.url} thumbnail={thumbnails[b.url]} tileStyle={settings.tileStyle} openInNewTab={settings.openInNewTab} onContextMenu={openContextMenu} />
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
```
替换为：
```tsx
      {searching ? (
        <SearchResults results={searchResults} openInNewTab={settings.openInNewTab} onContextMenu={openContextMenu} />
      ) : (
```

- [ ] **Step 6: `styles.css` 追加搜索结果样式**

在 `.search-header { ... }` 之后追加：
```css
.sresults { display: flex; flex-direction: column; gap: 18px; }
.sresults__group { margin: 0 0 6px; font-size: 12px; letter-spacing: .04em; text-transform: uppercase; color: #8791ad; }
.sresult { display: flex; align-items: center; gap: 12px; padding: 9px 10px; border-radius: 10px; color: inherit; text-decoration: none; }
.sresult:hover { background: #262a3d; }
.sresult__fav { width: 26px; height: 26px; border-radius: 6px; flex: 0 0 auto; }
.sresult__text { display: flex; flex-direction: column; min-width: 0; }
.sresult__title { font-size: 14px; font-weight: 600; color: #eef1f7; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sresult__path { font-size: 12px; color: #8791ad; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
html[data-theme="light"] .sresult:hover { background: #eef1f6; }
html[data-theme="light"] .sresult__title { color: #1c1e21; }
```

- [ ] **Step 7: 更新 `App.test.tsx` 的搜索用例**

把「filters tiles live as you type in the search box」用例整体替换为：
```tsx
  it('filters bookmarks live and groups by current folder', async () => {
    render(<App />);
    await screen.findByRole('tab', { name: '工作' });
    await userEvent.type(screen.getByRole('searchbox'), 'jira');
    await waitFor(() => expect(screen.getByRole('link', { name: /Jira/ })).toBeInTheDocument());
    expect(screen.getByText('当前目录')).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: '工作' })).not.toBeInTheDocument();
    expect(screen.queryByText('GitHub')).not.toBeInTheDocument();
  });
```

- [ ] **Step 8: 跑测试 + 构建**

Run: `npx vitest run src/newtab/components/SearchResults.test.tsx src/newtab/App.test.tsx`
Expected: PASS
Run: `npm run build`
Expected: 通过（确认 App 已删除未使用的 Tile 导入）。

- [ ] **Step 9: 提交**

```bash
git add src/newtab/components/SearchResults.tsx src/newtab/components/SearchResults.test.tsx src/newtab/App.tsx src/newtab/styles.css src/newtab/App.test.tsx
git commit -m "feat(search): 分组行列表结果 + 完整路径 UI（§8）"
```

## 阶段 6：自动壁纸（#7）

### Task 15：`wallpaper.ts`（取图/缓存/Unsplash 合规）

**Files:**
- Create: `src/lib/wallpaper.ts`
- Test: `src/lib/wallpaper.test.ts`

- [ ] **Step 1: 写失败测试**

Create `src/lib/wallpaper.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { installChromeMock } from '../../tests/setup';
import { todayKey, screenPx, resolvePicsum, resolveUnsplash, getDailyWallpaper, setUnsplashKey } from './wallpaper';

beforeEach(() => { installChromeMock(); });
afterEach(() => { vi.unstubAllGlobals(); });

describe('wallpaper helpers', () => {
  it('todayKey formats YYYY-MM-DD', () => {
    expect(todayKey(new Date(2026, 6, 9))).toBe('2026-07-09');
  });
  it('screenPx applies dpr and caps at 3840', () => {
    vi.stubGlobal('screen', { width: 2000, height: 1000 });
    vi.stubGlobal('devicePixelRatio', 2);
    expect(screenPx()).toEqual({ w: 3840, h: 2000 });
  });
  it('resolvePicsum builds a seeded sized url', () => {
    vi.stubGlobal('screen', { width: 1000, height: 800 });
    vi.stubGlobal('devicePixelRatio', 1);
    expect(resolvePicsum('2026-07-09').imageUrl).toBe('https://picsum.photos/seed/2026-07-09/1000/800');
  });
});

describe('resolveUnsplash', () => {
  it('uses raw url + sizing params + attribution + download location', async () => {
    vi.stubGlobal('screen', { width: 1000, height: 800 });
    vi.stubGlobal('devicePixelRatio', 1);
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        urls: { raw: 'https://images.unsplash.com/photo-1' },
        links: { download_location: 'https://api.unsplash.com/photos/x/download' },
        user: { name: 'Ansel', links: { html: 'https://unsplash.com/@ansel' } },
      }),
    })));
    const r = await resolveUnsplash('KEY');
    expect(r.imageUrl).toContain('https://images.unsplash.com/photo-1');
    expect(r.imageUrl).toContain('w=1000');
    expect(r.imageUrl).toContain('h=800');
    expect(r.imageUrl).toContain('fit=crop');
    expect(r.attribution?.photographer).toBe('Ansel');
    expect(r.attribution?.photographerUrl).toContain('utm_source=real_speed_dial');
    expect(r.downloadLocation).toContain('/download');
  });
});

describe('getDailyWallpaper', () => {
  it('fetches + caches + triggers unsplash download, then serves cache', async () => {
    await setUnsplashKey('KEY');
    vi.stubGlobal('screen', { width: 100, height: 100 });
    vi.stubGlobal('devicePixelRatio', 1);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({
        urls: { raw: 'https://images.unsplash.com/p' },
        links: { download_location: 'https://api.unsplash.com/photos/x/download' },
        user: { name: 'Ansel', links: { html: 'https://unsplash.com/@ansel' } },
      }) })
      .mockResolvedValueOnce({ ok: true, blob: async () => new Blob(['img'], { type: 'image/jpeg' }) })
      .mockResolvedValueOnce({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    const first = await getDailyWallpaper('unsplash');
    expect(first?.blob).toBeInstanceOf(Blob);
    expect(first?.attribution?.photographer).toBe('Ansel');
    expect(fetchMock).toHaveBeenCalledTimes(3);

    const second = await getDailyWallpaper('unsplash');
    expect(second?.blob).toBeInstanceOf(Blob);
    expect(fetchMock).toHaveBeenCalledTimes(3); // 命中缓存，无新请求
  });

  it('falls back to cached blob when the network fails', async () => {
    vi.stubGlobal('screen', { width: 100, height: 100 });
    vi.stubGlobal('devicePixelRatio', 1);
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ images: [{ urlbase: '/th?id=OHR.Test' }] }) })
      .mockResolvedValueOnce({ ok: true, blob: async () => new Blob(['bing'], { type: 'image/jpeg' }) }));
    await getDailyWallpaper('bing');

    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    const r = await getDailyWallpaper('bing', { force: true });
    expect(r?.blob).toBeInstanceOf(Blob);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/lib/wallpaper.test.ts`
Expected: FAIL（模块不存在）。

- [ ] **Step 3: 实现 `src/lib/wallpaper.ts`**

```ts
import { getAsset, putAsset } from './thumbnails';
import { WALLPAPER_AUTO_KEY, WALLPAPER_META_KEY, UNSPLASH_KEY } from './constants';
import type { WallpaperSource, WallpaperAttribution } from '@/types';

const UTM = '?utm_source=real_speed_dial&utm_medium=referral';

export function todayKey(d: Date = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function screenPx(): { w: number; h: number } {
  const dpr = Math.min(globalThis.devicePixelRatio || 1, 3);
  const cap = (n: number) => Math.min(Math.round(n), 3840);
  return {
    w: cap((globalThis.screen?.width ?? 1920) * dpr),
    h: cap((globalThis.screen?.height ?? 1080) * dpr),
  };
}

export async function getUnsplashKey(): Promise<string | undefined> {
  const got = await chrome.storage.local.get(UNSPLASH_KEY);
  return (got[UNSPLASH_KEY] as string) || undefined;
}
export async function setUnsplashKey(key: string): Promise<void> {
  await chrome.storage.local.set({ [UNSPLASH_KEY]: key });
}

interface Meta { source: WallpaperSource; date: string; salt: string; attribution?: WallpaperAttribution; }
interface Resolved { imageUrl: string; attribution?: WallpaperAttribution; downloadLocation?: string; }

async function loadMeta(): Promise<Meta | null> {
  const got = await chrome.storage.local.get(WALLPAPER_META_KEY);
  return (got[WALLPAPER_META_KEY] as Meta) ?? null;
}

export async function resolveBing(): Promise<Resolved> {
  const res = await fetch('https://www.bing.com/HPImageArchive.aspx?format=js&idx=0&n=1');
  const data = (await res.json()) as { images: { urlbase: string }[] };
  const base = data.images?.[0]?.urlbase ?? '';
  return { imageUrl: `https://www.bing.com${base}_UHD.jpg` };
}

export function resolvePicsum(salt: string): Resolved {
  const { w, h } = screenPx();
  return { imageUrl: `https://picsum.photos/seed/${encodeURIComponent(salt)}/${w}/${h}` };
}

export async function resolveUnsplash(key: string): Promise<Resolved> {
  const { w, h } = screenPx();
  const res = await fetch(`https://api.unsplash.com/photos/random?orientation=landscape&client_id=${encodeURIComponent(key)}`);
  if (!res.ok) throw new Error(`unsplash ${res.status}`);
  const p = (await res.json()) as {
    urls: { raw: string };
    links: { download_location: string };
    user: { name: string; links: { html: string } };
  };
  return {
    imageUrl: `${p.urls.raw}&w=${w}&h=${h}&fit=crop&dpr=1&q=80`,
    downloadLocation: p.links.download_location,
    attribution: {
      photographer: p.user.name,
      photographerUrl: `${p.user.links.html}${UTM}`,
      unsplashUrl: `https://unsplash.com/${UTM}`,
    },
  };
}

async function triggerUnsplashDownload(downloadLocation: string, key: string): Promise<void> {
  const sep = downloadLocation.includes('?') ? '&' : '?';
  try { await fetch(`${downloadLocation}${sep}client_id=${encodeURIComponent(key)}`); } catch { /* 合规上报失败不影响展示 */ }
}

async function resolveFor(source: WallpaperSource, salt: string): Promise<Resolved> {
  if (source === 'bing') return resolveBing();
  if (source === 'picsum') return resolvePicsum(salt);
  const key = await getUnsplashKey();
  if (!key) throw new Error('missing unsplash key');
  return resolveUnsplash(key);
}

// 取当日壁纸 blob；命中缓存直接用（force 强制换一张）；网络失败回退到上次缓存，绝不白屏。
export async function getDailyWallpaper(
  source: WallpaperSource,
  opts?: { force?: boolean },
): Promise<{ blob: Blob; attribution?: WallpaperAttribution } | null> {
  const meta = await loadMeta();
  const today = todayKey();
  const cached = await getAsset(WALLPAPER_AUTO_KEY);
  if (!opts?.force && cached && meta && meta.source === source && meta.date === today) {
    return { blob: cached, attribution: meta.attribution };
  }
  try {
    const salt = opts?.force ? `${today}-${Date.now()}` : today;
    const resolved = await resolveFor(source, salt);
    const imgRes = await fetch(resolved.imageUrl);
    if (!imgRes.ok) throw new Error(`image ${imgRes.status}`);
    const blob = await imgRes.blob();
    await putAsset(WALLPAPER_AUTO_KEY, blob);
    const nextMeta: Meta = { source, date: today, salt, attribution: resolved.attribution };
    await chrome.storage.local.set({ [WALLPAPER_META_KEY]: nextMeta });
    if (source === 'unsplash' && resolved.downloadLocation) {
      const key = await getUnsplashKey();
      if (key) void triggerUnsplashDownload(resolved.downloadLocation, key);
    }
    return { blob, attribution: resolved.attribution };
  } catch {
    if (cached) return { blob: cached, attribution: meta?.attribution };
    return null;
  }
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/lib/wallpaper.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/lib/wallpaper.ts src/lib/wallpaper.test.ts
git commit -m "feat(wallpaper): Bing/Picsum/Unsplash 取图 + 缓存回退 + Unsplash 合规（#7）"
```

---

### Task 16：壁纸主机权限（按需申请）+ manifest

**Files:**
- Modify: `src/lib/permissions.ts`
- Modify: `manifest.config.ts:17`
- Test: `src/lib/permissions.wallpaper.test.ts`

- [ ] **Step 1: 写失败测试**

Create `src/lib/permissions.wallpaper.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { installChromeMock } from '../../tests/setup';
import { ensureWallpaperPermission } from './permissions';

describe('ensureWallpaperPermission', () => {
  it('returns true without requesting when already granted', async () => {
    const c = installChromeMock();
    c.permissions.contains.mockResolvedValue(true);
    await expect(ensureWallpaperPermission('picsum')).resolves.toBe(true);
    expect(c.permissions.request).not.toHaveBeenCalled();
  });
  it('requests the source origins when missing', async () => {
    const c = installChromeMock();
    c.permissions.contains.mockResolvedValue(false);
    c.permissions.request.mockResolvedValue(true);
    await expect(ensureWallpaperPermission('bing')).resolves.toBe(true);
    expect(c.permissions.request).toHaveBeenCalledWith({ origins: ['https://www.bing.com/*'] });
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/lib/permissions.wallpaper.test.ts`
Expected: FAIL（函数不存在）。

- [ ] **Step 3: 在 `src/lib/permissions.ts` 追加实现**

顶部加 `import type { WallpaperSource } from '@/types';`，文件末尾追加：
```ts
const WALLPAPER_ORIGINS: Record<WallpaperSource, string[]> = {
  bing: ['https://www.bing.com/*'],
  picsum: ['https://picsum.photos/*', 'https://*.picsum.photos/*'],
  unsplash: ['https://api.unsplash.com/*', 'https://images.unsplash.com/*'],
};

// 仅在用户开启自动壁纸/切换来源时按需申请对应主机权限（须在用户手势中调用）。
export async function ensureWallpaperPermission(source: WallpaperSource): Promise<boolean> {
  const origins = WALLPAPER_ORIGINS[source];
  if (await chrome.permissions.contains({ origins })) return true;
  return chrome.permissions.request({ origins });
}
```

- [ ] **Step 4: 修改 `manifest.config.ts` 的 optional_host_permissions**

把：
```ts
  optional_host_permissions: ['<all_urls>'],
```
改为：
```ts
  optional_host_permissions: [
    '<all_urls>',
    'https://www.bing.com/*',
    'https://picsum.photos/*',
    'https://*.picsum.photos/*',
    'https://api.unsplash.com/*',
    'https://images.unsplash.com/*',
  ],
```

- [ ] **Step 5: 跑测试 + 构建**

Run: `npx vitest run src/lib/permissions.wallpaper.test.ts`
Expected: PASS
Run: `npm run build`
Expected: 通过。

- [ ] **Step 6: 提交**

```bash
git add src/lib/permissions.ts src/lib/permissions.wallpaper.test.ts manifest.config.ts
git commit -m "feat(wallpaper): 壁纸来源主机权限按需申请 + manifest 声明"
```

### Task 17：App 应用自动壁纸背景 + Unsplash 署名组件

**Files:**
- Create: `src/newtab/components/Attribution.tsx`
- Test: `src/newtab/components/Attribution.test.tsx`
- Modify: `src/newtab/App.tsx`
- Modify: `src/newtab/styles.css`

- [ ] **Step 1: 写 Attribution 失败测试**

Create `src/newtab/components/Attribution.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nProvider } from '@/i18n';
import { Attribution } from './Attribution';

describe('Attribution', () => {
  it('renders photographer + Unsplash links carrying utm', () => {
    render(
      <I18nProvider language="en">
        <Attribution data={{
          photographer: 'Ansel',
          photographerUrl: 'https://unsplash.com/@ansel?utm_source=real_speed_dial&utm_medium=referral',
          unsplashUrl: 'https://unsplash.com/?utm_source=real_speed_dial&utm_medium=referral',
        }} />
      </I18nProvider>,
    );
    expect(screen.getByRole('link', { name: 'Ansel' }).getAttribute('href')).toContain('utm_source=real_speed_dial');
    expect(screen.getByRole('link', { name: 'Unsplash' }).getAttribute('href')).toContain('unsplash.com');
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/newtab/components/Attribution.test.tsx`
Expected: FAIL（组件不存在）。

- [ ] **Step 3: 实现 `src/newtab/components/Attribution.tsx`**

```tsx
import type { WallpaperAttribution } from '@/types';
import { useI18n } from '@/i18n';

export function Attribution({ data }: { data: WallpaperAttribution }) {
  const { t } = useI18n();
  return (
    <div className="attribution">
      {t('attribution.by')} <a href={data.photographerUrl} target="_blank" rel="noopener noreferrer">{data.photographer}</a> {t('attribution.on')} <a href={data.unsplashUrl} target="_blank" rel="noopener noreferrer">Unsplash</a>
    </div>
  );
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/newtab/components/Attribution.test.tsx`
Expected: PASS

- [ ] **Step 5: 修改 `App.tsx`——背景 effect 支持 auto + 渲染署名**

顶部新增导入：
```tsx
import { getDailyWallpaper } from '@/lib/wallpaper';
import { Attribution } from './components/Attribution';
import type { WallpaperAttribution } from '@/types';
```
在组件状态区新增：
```tsx
  const [attribution, setAttribution] = useState<WallpaperAttribution | null>(null);
```
把整段背景 `useEffect`（`if (settings.background.type === 'color') {...} else {...}`）替换为：
```tsx
    const bg = settings.background;
    if (bg.type === 'color') {
      document.body.style.background = bg.value;
      setAttribution(null);
    } else if (bg.type === 'wallpaper') {
      setAttribution(null);
      void getAsset(WALLPAPER_KEY).then((blob) => {
        if (cancelled || !blob) return;
        objectUrl = URL.createObjectURL(blob);
        document.body.style.background = `url(${objectUrl}) center/cover no-repeat fixed`;
      });
    } else {
      void getDailyWallpaper(bg.source).then((res) => {
        if (cancelled || !res) return;
        objectUrl = URL.createObjectURL(res.blob);
        document.body.style.background = `url(${objectUrl}) center/cover no-repeat fixed`;
        setAttribution(res.attribution ?? null);
      });
    }
```
在主体 `content` 的 `.app` 容器内（`fab-group` 之后、`dialog`/`menu` 之前）加：
```tsx
      {attribution && <Attribution data={attribution} />}
```

- [ ] **Step 6: `styles.css` 追加署名样式**

```css
.attribution { position: fixed; right: 12px; bottom: 12px; z-index: 40; font-size: 12px; color: rgba(255,255,255,.9); background: rgba(0,0,0,.4); padding: 4px 10px; border-radius: 8px; backdrop-filter: blur(4px); }
.attribution a { color: #fff; text-decoration: underline; }
```

- [ ] **Step 7: 测试 + 构建**

Run: `npx vitest run src/newtab/App.test.tsx src/newtab/components/Attribution.test.tsx`
Expected: PASS（App 默认背景为纯色，不触发壁纸抓取）。
Run: `npm run build`
Expected: 通过。

- [ ] **Step 8: 提交**

```bash
git add src/newtab/components/Attribution.tsx src/newtab/components/Attribution.test.tsx src/newtab/App.tsx src/newtab/styles.css
git commit -m "feat(wallpaper): 新标签页应用自动壁纸 + Unsplash 署名（#7）"
```

---

### Task 18：设置页壁纸 UI（来源/Key/换一张）

**Files:**
- Modify: `src/options/Options.tsx`
- Modify: `src/options/styles.css`（如需 hint-link 样式）
- Test: `src/options/Options.test.tsx`（新增自动壁纸用例）

- [ ] **Step 1: 写失败测试**

在 `src/options/Options.test.tsx` 的 `describe('Options')` 内新增：
```tsx
  it('enables auto wallpaper and reveals the source dropdown', async () => {
    render(<Options />);
    const bg = await screen.findByLabelText('背景');
    await userEvent.selectOptions(bg, 'auto');
    expect(await screen.findByLabelText('壁纸来源')).toBeInTheDocument();
  });
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/options/Options.test.tsx`
Expected: FAIL（尚无「自动壁纸」选项与来源下拉）。

- [ ] **Step 3: 改 `Options.tsx`**

顶部新增导入：
```tsx
import { ensureWallpaperPermission } from '@/lib/permissions';
import { getUnsplashKey, setUnsplashKey, getDailyWallpaper } from '@/lib/wallpaper';
import type { BookmarkNode, Settings, TileStyle, WallpaperSource } from '@/types';
```
（把原有 `import type { BookmarkNode, Settings, TileStyle } from '@/types';` 替换为上面这行。）
在组件状态区新增并加载 Unsplash Key：
```tsx
  const [unsplashKey, setUnsplashKeyState] = useState('');
  useEffect(() => { void getUnsplashKey().then((k) => setUnsplashKeyState(k ?? '')); }, []);
```
把「背景」整段（背景类型 select + 纯色/壁纸两个条件块）替换为：
```tsx
        <label className="field">
          <span>{t('options.background')}</span>
          <select
            aria-label={t('options.background')}
            value={settings.background.type}
            onChange={async (e) => {
              const type = e.target.value;
              if (type === 'wallpaper') return void patch({ background: { type: 'wallpaper' } });
              if (type === 'auto') {
                if (!(await ensureWallpaperPermission('bing'))) return;
                return void patch({ background: { type: 'auto', source: 'bing' } });
              }
              void patch({ background: { type: 'color', value: '#1e2130' } });
            }}
          >
            <option value="color">{t('options.bgColor')}</option>
            <option value="wallpaper">{t('options.bgWallpaper')}</option>
            <option value="auto">{t('options.bgAuto')}</option>
          </select>
        </label>
        {settings.background.type === 'color' && (
          <label className="field">
            <span>{t('options.bgColorLabel')}</span>
            <input type="color" value={settings.background.value} onChange={(e) => void patch({ background: { type: 'color', value: e.target.value } })} />
          </label>
        )}
        {settings.background.type === 'wallpaper' && (
          <label className="field">
            <span>{t('options.uploadWallpaper')}</span>
            <input type="file" accept="image/*" onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) { await putAsset(WALLPAPER_KEY, file); await patch({ background: { type: 'wallpaper' } }); }
            }} />
          </label>
        )}
        {settings.background.type === 'auto' && (
          <>
            <label className="field">
              <span>{t('options.wallpaperSource')}</span>
              <select
                aria-label={t('options.wallpaperSource')}
                value={settings.background.source}
                onChange={async (e) => {
                  const source = e.target.value as WallpaperSource;
                  if (!(await ensureWallpaperPermission(source))) return;
                  void patch({ background: { type: 'auto', source } });
                }}
              >
                <option value="bing">{t('options.srcBing')}</option>
                <option value="picsum">{t('options.srcPicsum')}</option>
                <option value="unsplash">{t('options.srcUnsplash')}</option>
              </select>
            </label>
            {settings.background.source === 'unsplash' && (
              <>
                <label className="field">
                  <span>{t('options.unsplashKey')}</span>
                  <input
                    type="password"
                    value={unsplashKey}
                    placeholder={t('options.unsplashKeyPlaceholder')}
                    onChange={(e) => { setUnsplashKeyState(e.target.value); void setUnsplashKey(e.target.value); }}
                  />
                </label>
                <p className="hint"><a href="https://unsplash.com/developers" target="_blank" rel="noopener noreferrer">{t('options.unsplashHelp')}</a> · {t('options.unsplashNote')}</p>
              </>
            )}
            <label className="field">
              <span></span>
              <button className="btn" onClick={() => { const bg = settings.background; if (bg.type === 'auto') void getDailyWallpaper(bg.source, { force: true }); }}>{t('options.shuffle')}</button>
            </label>
          </>
        )}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/options/Options.test.tsx`
Expected: PASS

- [ ] **Step 5: 全量测试 + 构建**

Run: `npm test`
Expected: PASS
Run: `npm run build`
Expected: 通过。

- [ ] **Step 6: 提交**

```bash
git add src/options/Options.tsx src/options/Options.test.tsx src/options/styles.css
git commit -m "feat(wallpaper): 设置页自动壁纸来源/Unsplash Key/换一张（#7）"
```

## 阶段 7：文档

### Task 19：README 英文（默认）+ 中文 + 语言切换链接

**Files:**
- Modify: `README.md`（改为英文 + 顶部语言切换）
- Create: `README.zh-CN.md`（迁移中文 + 顶部语言切换）

- [ ] **Step 1: 覆盖 `README.md` 为英文版**

```markdown
# Real Speed Dial

English | [中文](README.zh-CN.md)

A true Vivaldi-style Speed Dial for Chrome (Manifest V3): it takes over the new tab page and tiles a bookmark folder you choose. Subfolders show as top **Tabs**; deeper levels use "recursive replacement". Bookmarks are the single source of truth — every edit writes back to Chrome bookmarks and syncs live.

![icon](public/icons/icon128.png)

## Features

- **Bookmark-driven Speed Dial**: pick a default landing folder in Settings; its direct bookmarks tile on the "Home" tab and each subfolder becomes a tab.
- **Whole-tree navigation**: a clickable breadcrumb runs from the browser bookmarks root to the current folder; press **⤵ Enter** on a subfolder tab to make it the current folder. The browser Back key steps out level by level.
- **Grouped search** across the whole tree — "Current folder" vs "Other folders" — with the full path shown on every result.
- **Real-link tiles**: hover shows the target URL in the browser status bar; middle/Cmd-click opens a new tab; right-click gives the in-app menu.
- **Tile styles**: favicon / theme color / screenshot, all with a readable text layer.
- **Auto-updating wallpaper**: Bing daily / Lorem Picsum / Unsplash (bring your own key), one per day, cached for offline, sized to your screen with `cover` (no stretching).
- **Bilingual UI** (English / 中文): follows the browser language by default, switchable in Settings.
- **Appearance**: dark / light / system theme, solid color or wallpaper background, adjustable columns, and last-position memory.

## Development

\`\`\`bash
npm install
npm run dev
npm test
npm run build
\`\`\`

## Load unpacked

1. `npm run build`
2. Open `chrome://extensions`, enable "Developer mode".
3. "Load unpacked" → choose the `dist/` folder.
4. Open a new tab → first run prompts you to pick a default landing folder in the extension Options.

## Package & publish

\`\`\`bash
npm run build
cd dist && zip -r ../real-speed-dial.zip . && cd ..
\`\`\`

Upload `real-speed-dial.zip` to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole). Bump `version` in `manifest.config.ts` for each update.

## Permissions

| Permission | Purpose | When |
|---|---|---|
| `bookmarks` | read/write bookmarks (core) | install |
| `storage` | settings & nav state | install |
| `favicon` | show site icons | install |
| `tabs` + `<all_urls>` | screenshot thumbnails (`captureVisibleTab`) | **requested on demand** (screenshot style / manual refresh) |
| host perms for `bing.com` / `picsum.photos` / `api.unsplash.com` / `images.unsplash.com` | fetch the daily wallpaper | **requested on demand** (when Auto wallpaper is enabled) |

## Unsplash

Enabling the Unsplash source requires **your own Access Key** (stored locally on your device only, since this extension has no backend). Attribution to the photographer and Unsplash is shown as required by the [Unsplash API Guidelines](https://help.unsplash.com/en/articles/2511245-unsplash-api-guidelines). Bing and Lorem Picsum need no key and are the defaults.

## License

MIT — see [LICENSE](LICENSE).

## Design & implementation docs

- Spec (round 2): `docs/superpowers/specs/2026-07-09-real-speed-dial-improvements-design.md`
- Plan (round 2): `docs/superpowers/plans/2026-07-09-real-speed-dial-improvements.md`
\`\`\`
```
> 注意：以上代码块内出现的 `\`\`\`bash` 等是 README 内容的一部分；写入 `README.md` 时请去掉最外层为展示而转义的反斜杠，即 README 内正常使用三反引号围栏。

- [ ] **Step 2: 创建 `README.zh-CN.md`（中文版）**

```markdown
# Real Speed Dial

[English](README.md) | 中文

一个真正类似 Vivaldi Speed Dial 的 Chrome 浏览器插件（Manifest V3）：接管新标签页，把你选定的某个**书签目录**平铺呈现；子目录以顶部 **Tab** 呈现，更深层级采用「递归替换」进入。书签是唯一事实来源——所有编辑都直接写回 Chrome 书签并实时同步。

![icon](public/icons/icon128.png)

## 功能

- **书签驱动的 Speed Dial**：设置里选一个「默认落地目录」，其直接书签平铺在「主页」Tab，子目录各成一个 Tab。
- **整树导航**：面包屑从「浏览器书签根」一路显示到当前目录、每一级可点；在子目录 Tab 上点 **⤵ 进入** 即可把它设为当前目录；浏览器后退键逐层返回。
- **分组搜索**：跨整棵书签树搜索，分「当前目录 / 其他目录」两组，每条结果都带完整路径。
- **真链接磁贴**：hover 时浏览器左下角显示网址；中键/Cmd 点击新标签打开；右键为应用内菜单。
- **磁贴样式**：图标 / 主题色 / 网页截图，均带可读文字层。
- **自动更新壁纸**：Bing 每日 / Lorem Picsum / Unsplash（自备 key），每天一张，缓存离线可用，按屏幕尺寸 `cover` 裁切不拉伸。
- **中英双语**：默认跟随浏览器语言，可在设置页手动切换。
- **外观**：深色 / 浅色 / 跟随系统主题、纯色或壁纸背景、列数可调、状态记忆。

## 开发

\`\`\`bash
npm install
npm run dev
npm test
npm run build
\`\`\`

## 本地体验（加载未打包扩展）

1. `npm run build`
2. Chrome 打开 `chrome://extensions`，开启「开发者模式」。
3. 点「加载已解压的扩展程序」，选择 `dist/` 目录。
4. 新建标签页 → 首次提示到扩展「选项」页选一个默认落地目录。

## 权限说明

| 权限 | 用途 | 时机 |
|---|---|---|
| `bookmarks` | 读写书签（核心） | 安装时 |
| `storage` | 设置与导航状态 | 安装时 |
| `favicon` | 显示网站图标 | 安装时 |
| `tabs` + `<all_urls>` | 网页截图缩略图 | **按需申请** |
| `bing.com` / `picsum.photos` / `api.unsplash.com` / `images.unsplash.com` 主机权限 | 抓取每日壁纸 | **按需申请**（启用自动壁纸时） |

## Unsplash

启用 Unsplash 来源需**自备 Access Key**（因本插件无后台，Key 仅存于本机浏览器）。会按 [Unsplash API 规范](https://help.unsplash.com/en/articles/2511245-unsplash-api-guidelines) 显示摄影师与 Unsplash 署名。Bing 与 Lorem Picsum 免 key，为默认来源。

## 许可

MIT，见 [LICENSE](LICENSE)。

## 设计与实现文档

- 设计规格（第二轮）：`docs/superpowers/specs/2026-07-09-real-speed-dial-improvements-design.md`
- 实现计划（第二轮）：`docs/superpowers/plans/2026-07-09-real-speed-dial-improvements.md`
\`\`\`
```
> 同样：写入文件时使用正常的三反引号围栏（去掉为展示而加的转义反斜杠）。

- [ ] **Step 3: 提交**

```bash
git add README.md README.zh-CN.md
git commit -m "docs: README 英文默认 + 中文版 + 语言切换链接（#2）"
```

---

## 收尾校验（全部完成后）

- [ ] 跑全量测试：`npm test` → 全绿。
- [ ] 类型检查 + 打包：`npm run build` → 通过。
- [ ] 手动验证清单（加载 `dist/` 未打包扩展）：
  - 面包屑从「书签」根显示到当前目录，逐级可点；子目录 Tab 出现「进入」按钮并能下钻。
  - hover 磁贴左下角显示网址；中键/Cmd 点击新标签打开；拖拽排序不误触跳转。
  - 主题色磁贴在黄/青/绿等亮色相下文字清晰。
  - 搜索跨整树、分「当前目录/其他目录」、每条显示完整路径。
  - 设置页切换语言即时生效；README 英文默认、可切中文。
  - 自动壁纸：Bing/Picsum 免 key 可用；Unsplash 填 Key 后显示署名；断网回退缓存；不同屏幕不拉伸。

---

## 计划自查（Self-Review 结论）

**1. Spec 覆盖：**
- #1 LICENSE/元数据 → Task 1；类型/常量 → Task 2；测试语言 → Task 3。
- #2 i18n → Task 4/5/6/7 + README Task 19。
- #3 面包屑（整树、根定义、可点） → Task 8/9。
- #4 Tab 进入按钮 → Task 10。
- #5 磁贴可读性 → Task 12。
- #6 磁贴真链接 → Task 11。
- #7 自动壁纸（Bing/Picsum/Unsplash、缓存、权限、署名、不拉伸） → Task 15/16/17/18。
- §8 搜索（整树/分组/路径/行式） → Task 13/14。
无遗漏项。

**2. 占位符扫描：** 无 TBD/TODO；每个改代码的 Step 均给出完整代码或精确改动。README 两处「转义反斜杠」提示为写入注意事项，非占位。

**3. 类型/签名一致性核对：**
- `Language`（types）↔ `resolveLang`/`Settings.language`/Options 下拉 一致。
- `WallpaperSource` ↔ `BackgroundSetting.auto.source`/`wallpaper.ts`/`permissions.ts`/Options 一致。
- `SearchHit`/`GroupedSearch` ↔ `search.ts`/`SearchResults`/App 一致。
- `getDailyWallpaper(source, {force?})` ↔ App（默认）/Options（force）一致。
- `useI18n()`→`{t,lang}` ↔ 各组件消费一致；App/Options 另用 `resolveLang+translate` 本地 t（因其位于 Provider 之上/自管 settings）。
- `Tile`（`openInNewTab`，无 `onOpen`）↔ Grid（`openInNewTab`）↔ App（`settings.openInNewTab`）一致。
- `TabBar` 新增 `onEnter` ↔ App 传参一致。
- `resolveInitialNav(root, saved, restore, landingId?)` ↔ App 传 `rootId`；旧 3 参测试向后兼容。







