# Real Speed Dial 体验改进设计（第二轮）

- 日期：2026-07-09
- 状态：已与用户确认，待评审
- 范围：在既有 Real Speed Dial 扩展上做 7 项改进，不改变"书签是唯一事实来源 + 递归替换导航"的核心模型。

## 背景

Real Speed Dial 是一个类 Vivaldi 的书签 Speed Dial 新标签页扩展（Manifest V3，React + TS + Vite + @crxjs）。当前所有 UI 文案硬编码中文、无 LICENSE、无自动壁纸、磁贴为 `<button>`、面包屑仅按 `folderId` 生成。本轮针对使用中暴露的问题做打磨。

## 目标（7 项）

1. 新增 MIT LICENSE。
2. 多语言：README 默认英文 + 中文链接切换；扩展 UI 中英双语，可在设置页手动切换。
3. **【最重要】修复面包屑**：可点击，且显示从"浏览器书签根目录 → 当前目录"的完整路径（"根目录"= 整棵书签树的根，非设置里选的目录）。
4. 非主页 Tab 上提供"一键把该 Tab 设为当前目录"的入口。
5. 修复主题色磁贴文字可读性（亮色相与白字对比不足）。
6. 磁贴 hover 时像普通链接那样在浏览器左下角显示目标网址。
7. 支持自动更新壁纸：Bing 每日、Lorem Picsum、Unsplash（自备 key），每天一张。

## 非目标

- 不重构核心导航模型：仍是 `folderId` 深度轴 + `tabId` 横向轴 + 递归替换。但本轮**扩大可导航范围到整棵浏览器书签树**（见 §3），"配置的根目录"语义改为"新标签页默认落地目录"。
- 不引入后端/代理服务。
- 不做除中/英以外的语言。
- 不本地化 Chrome 商店清单的名称/描述（见"已知限制"）。

---

## 1. LICENSE 与元数据（#1）

- 新增根目录 `LICENSE`，MIT，版权行：`Copyright (c) 2026 shanehou`。
- `package.json`：`license` 由 `ISC` 改为 `MIT`；`author` 填 `shanehou`。
- README 中补充许可说明段落，链接到 `LICENSE`。

---

## 2. 多语言 i18n（#2）

选型：**自建轻量 i18n**（非 `chrome.i18n`），以支持设置页手动切换，与 README"点击切换"体验一致。

### 2.1 运行时 i18n
- 新增 `src/lib/i18n.ts`：
  - `type Lang = 'zh' | 'en'`
  - `messages: Record<Lang, Record<MessageKey, string>>`：集中所有文案，key 用语义命名（如 `tab.home`、`ctx.edit`、`dialog.save`、`options.title` 等）。
  - `resolveLang(setting: 'auto'|'zh'|'en'): Lang`：`auto` 时按 `navigator.language` 以 `zh` 前缀判断，否则回退 `en`。
  - `t(lang, key, params?)`：支持 `{name}` 占位符插值；缺失 key 时回退英文并在 dev 下告警。
- 新增 hook `src/newtab/hooks/useI18n.ts`（或放共享处供两个入口复用）：从 `useSettings()` 读取 `language`，返回 `{ t, lang }`。
- `Settings` 增字段 `language: 'auto' | 'zh' | 'en'`，默认 `'auto'`。

### 2.2 文案替换范围
将以下组件的硬编码中文改为 `t(...)`：`App`、`TabBar`、`Breadcrumb`、`ContextMenu`、`EditDialog`、`EmptyState`、`Guidance`、`SearchBar`、`States`、`Options`、`FolderTreeSelect`。`aria-label`/`title`/占位符一并纳入。

### 2.3 设置页
`Options` 顶部"外观"区新增「语言 / Language」下拉：自动 / 中文 / English，即时生效。

### 2.4 README
- `README.md` 改为英文（默认），顶部放语言切换：`English | [中文](README.zh-CN.md)`。
- 新增 `README.zh-CN.md`：迁移现有中文内容，顶部放 `[English](README.md) | 中文`。
- 两份内容对齐，均补充"自动壁纸""语言切换""LICENSE"等新特性。

---

## 3. 面包屑修复（#3，最重要）

### 3.1 "根目录"的定义（关键澄清）
- **"根目录" = 整个浏览器书签的根**（`chrome.bookmarks` 的不可见根节点 `id="0"`，其直接子级为「书签栏」「其他书签」「移动设备书签」等），**不是**设置里选择的目录。
- 设置里选择的目录（`rootFolderId`）语义改为**"新标签页默认落地的目录"**，不再是导航边界。
- 用户选择：**完整可导航**——面包屑每一级都可点，可一路向上导航到整棵书签树。

### 3.2 现状与根因
- 现状 `useBookmarkTree` 用 `getSubTree(rootId)` 只取"配置目录子树"，`buildFolderView` 的 `getAncestors(root, folderId)` 因此只能从配置目录起算 → 无法显示其上层，且平时用 Tab 浏览时 `folderId` 停在配置目录、面包屑常年仅 1 级、观感"点不动、没路径"。

### 3.3 设计
- **数据加载改为整棵树**：`useBookmarkTree` 用 `chrome.bookmarks.getTree()`，`root` = 浏览器书签根节点（`id="0"`）。`buildFolderView(root, folderId, tabId)` 的 `getAncestors` 于是天然产出"浏览器根 → 当前目录"的完整路径。
- **面包屑语义**：从浏览器书签根到当前目录 `folderId` 的完整路径，**不包含**横向预览的 `tabId`；每个非末级 crumb 可点，点击 → `navigate(crumb.id, HOME_TAB_ID, true)`；末级为当前目录（不可点当前态）。
- **根节点渲染**：不可见根 `id="0"` 标题为空 → 面包屑首级用 home 图标 + 本地化文案「书签 / Bookmarks」；点击它进入根视图（Tab 栏 = 书签栏/其他书签/移动设备书签，无"主页"Tab，因根无直接书签，符合原设计 §3.3 边界规则）。
- **默认落地与初始化**：`resolveInitialNav` 校验 `navState` 是否仍存在于整棵树；默认落地 = `rootFolderId`；`rootFolderId` 失效则回退到「书签栏」(`id="1"`)；`rootFolderId` 未设置 → 仍显示引导页（其文案改为"选择默认落地目录"）。
- **导航无边界**：面包屑（向上/任意）、Tab、「进入」按钮（#4）、文件夹磁贴（向下）都在整棵树内自由导航。
- **回归测试**：现有测试仅断言 crumb 存在，需补"点击祖先级 crumb 确实导航""能从深层一路点回到书签根"的测试。
- **搜索范围（本轮保持不变）**：实时过滤仍限定在"配置的默认落地目录子树"内（`findNode(fullRoot, rootFolderId)` 后过滤），避免行为突变；如需改为整树搜索可后续再议。

---

## 4. 一键把 Tab 设为当前目录（#4）

选型：**B —— 激活 Tab 上的「⤵ 进入」按钮**。

### 设计
- `TabBar` 对**当前激活且非主页**的 Tab，在其右侧渲染一个"进入"图标按钮（`aria-label` 走 i18n）。
- 新增回调 `onEnter(tabId)`；`App` 接线为 `navigate(tabId, HOME_TAB_ID, true)` —— 与点击文件夹磁贴的 `onEnter` 完全一致（递归替换）。
- 进入后：该子目录成为 `folderId`；它的直接书签进入"主页"Tab、它的子目录成为新的 Tab 行；面包屑 +1 级。
- 事件隔离：进入按钮点击调用 `onEnter` 并 `stopPropagation`，避免与 Tab 本身的 `onSelect` 冲突；Tab 主体点击仍是 `onSelect`（切换预览）。
- 主页 Tab 不显示进入按钮（它不是子目录）。

---

## 5. 主题色磁贴可读性（#5）

选型：**A —— 保留鲜艳色相 + 文字可读层**，并与截图磁贴统一。

### 设计
- 保留 `colorFromString`（`hsl(hash%360,55%,45%)`）与彩色渐变。
- `Tile.tsx`：主题色模式加类名 `tile--theme`。
- `styles.css`：
  - 新增 `.tile--theme::after`：底部 `linear-gradient(180deg, transparent, rgba(0,0,0,.6))` 蒙层（层级在背景之上、标题/图标之下），与既有 `.tile--shot::after` 同思路。
  - `.tile__title` 常驻 `text-shadow: 0 1px 3px rgba(0,0,0,.6)`；`.tile__fav-letter` 加轻投影。
- favicon 样式（纯深色底）不受影响；截图样式沿用其暗色蒙层。三种样式的文字层观感统一。

---

## 6. 磁贴改真链接（#6）

选型：**把书签磁贴改为真正的 `<a href>`**，从而获得浏览器原生"左下角显示目标网址"。

### 设计
- `Tile.tsx` 根元素 `<button>` → `<a href={url}>`：
  - `draggable={false}`，内部 `<img>` 亦 `draggable={false}`，避免原生链接/图片拖拽干扰 dnd 排序。
  - `onContextMenu` 仍 `preventDefault` 走自定义右键菜单（编辑/删除等）。
  - `openInNewTab` 为真时设 `target="_blank" rel="noopener noreferrer"`；为假则默认同标签打开。中键/Cmd/Ctrl 点击由浏览器原生处理（新标签打开）。
  - 保留 `title={title}` 作为标题气泡；网址由浏览器状态栏呈现。
- `FolderTile` **保持 `<button>`**（语义是"进入文件夹"而非导航到 URL）。
- `Grid.tsx`：`SortableCell` 仍在外层 div 持有 dnd listeners；需验证"拖拽结束后的 click 不触发链接跳转"（dnd-kit 会在拖拽后拦截 click；如实测有跳转，补一个拖拽态守卫）。
- 补测试：磁贴渲染为带正确 `href` 的链接；`openInNewTab` 影响 `target`；拖拽与点击并存不误触。

---

## 7. 自动更新壁纸（#7）

来源：**Bing 每日 / Lorem Picsum / Unsplash（自备 key）**，三选一；频率：**每天一张**；缓存离线回退；**按屏幕尺寸取图、`cover` 裁切不拉伸**。

### 7.1 数据模型（`types.ts`）
```ts
type WallpaperSource = 'bing' | 'picsum' | 'unsplash';
type BackgroundSetting =
  | { type: 'color'; value: string }
  | { type: 'wallpaper' }                       // 用户上传（保留）
  | { type: 'auto'; source: WallpaperSource };  // 新增
interface Settings {
  // ...既有字段（存 chrome.storage.sync）
  language: 'auto' | 'zh' | 'en';
}
interface WallpaperAttribution {                // 仅 Unsplash 需要
  photographer: string;
  photographerUrl: string;   // 带 utm
  unsplashUrl: string;       // 带 utm
}
```
- **Unsplash Access Key 不放进同步的 `Settings`**，而是单独存 `chrome.storage.local`（设备本地、不跨设备同步），新增常量 `UNSPLASH_KEY` 与读写 helper（`getUnsplashKey()` / `setUnsplashKey()`）。这样才符合"仅存本地"的合规取舍。

### 7.2 取图逻辑（新增 `src/lib/wallpaper.ts`）
- `screenPx()`：`{ w, h }` = `screen.width/height * devicePixelRatio`，上限钳制（如 3840）避免超大请求。
- `todayKey()`：本地日期 `YYYY-MM-DD`，作为"每天一张"的缓存键。
- `resolveBing()`：请求 `https://www.bing.com/HPImageArchive.aspx?format=js&idx=0&n=1&mkt=<locale>` → 取 `images[0].urlbase` → 拼 `https://www.bing.com{urlbase}_UHD.jpg`（够清晰，`cover` 裁切）。
- `resolvePicsum(screen)`：`https://picsum.photos/seed/{todayKey}/{w}/{h}`（当天固定一张）。
- `resolveUnsplash(key, screen)`：`GET https://api.unsplash.com/photos/random?orientation=landscape&client_id={key}` → 用 `urls.raw` 拼尺寸参 `&w={w}&h={h}&fit=crop&dpr={dpr}&q=80`（合规技术①，同时满足不拉伸）→ 返回 `imageUrl` + `attribution`（含 UTM）+ `downloadLocation`。
- `getDailyWallpaper(settings)`：
  - 缓存键 = `source + todayKey`；命中且非"换一张"→ 用 IndexedDB `ASSET_STORE`（key 如 `wallpaper-auto`）里的 blob。
  - 未命中 → 按 source 解析 → `fetch` 图片 blob 存缓存 → 写元数据（source/date/attribution）。
  - Unsplash：设为壁纸时**触发一次 `downloadLocation`**（合规技术②，带 `client_id`）。
  - **离线/失败 → 回退到上次缓存 blob，绝不白屏**。
- 绝不日志输出 `unsplashAccessKey`。

### 7.3 权限（`manifest.config.ts` + `permissions.ts`）
- `optional_host_permissions` 增：`https://www.bing.com/*`、`https://picsum.photos/*`、`https://*.picsum.photos/*`、`https://api.unsplash.com/*`、`https://images.unsplash.com/*`。
- 新增 `ensureWallpaperPermission(source)`：在用户手势中按 source 申请对应主机权限（沿用截图权限的"按需申请"模式）。

### 7.4 应用背景（`App.tsx`）
- 背景 effect 支持 `type:'auto'`：`getDailyWallpaper` → `URL.createObjectURL(blob)` → `document.body.style.background = url(objectURL) center/cover no-repeat fixed`（`cover` 不拉伸）；卸载时 `revokeObjectURL`。
- 当 source 为 unsplash 且有 attribution → 渲染 `<Attribution>`（右下角小字，可点，链接带 UTM）。

### 7.5 设置页（`Options.tsx`）
- 背景类型下拉新增「自动壁纸（每日更新）」。
- 选中"自动壁纸"时显示：
  - 源下拉：Bing 每日 / Lorem Picsum / Unsplash。
  - source=unsplash 时：**Access Key 输入框** + 申请指引外链 + 合规提示（署名/自带 key）。
  - 「换一张」按钮：绕过当日缓存换一张（Bing 换 idx、Picsum 换随机种子、Unsplash 取新随机）。
  - 开启时触发 `ensureWallpaperPermission(source)`。

### 7.6 Unsplash 合规（依据 https://help.unsplash.com/en/articles/2511245-unsplash-api-guidelines ）
- 技术①：仅用 API 返回的 `urls.raw` 热链 + Imgix 参数，不重托管。
- 技术②：图片被"使用"（设为壁纸）时请求 `links.download_location`。
- 技术③：显示"Photo by {摄影师} on Unsplash"，两处链接带 `?utm_source=real_speed_dial&utm_medium=referral`。
- 技术④：无后台无法代理；改为用户自带 key，仅存其本地浏览器、仅发往 `api.unsplash.com`。
- 使用①：App 名/图标不含 Unsplash 元素。
- **已知张力（用户已知情接受）**：
  - 使用⑥（不应要求用户注册开发者账号）：缓解 = Unsplash 为可选源、默认关闭；Bing/Picsum 免 key 开箱即用，故"使用本插件"不需要 Unsplash 账号。
  - 使用③（禁止复制 Unsplash 核心体验/壁纸类应用）：缓解 = 本插件是书签 Speed Dial，壁纸仅为次要背景选项之一，非专门壁纸应用。

---

## 数据模型变更汇总（`types.ts`）
- `BackgroundSetting` 增 `{ type:'auto'; source:WallpaperSource }`。
- `Settings` 增 `language`（`unsplashAccessKey` 不入同步的 `Settings`，改存 `storage.local`）。
- `DEFAULT_SETTINGS` 增 `language:'auto'`。
- 新增 `WallpaperSource`、`WallpaperAttribution`。
- `rootFolderId` 语义变化：由"导航边界/唯一可见范围"改为"新标签页默认落地目录"（无类型变更）。
- `constants.ts` 增 `UNSPLASH_KEY`（storage.local）、壁纸缓存相关键。

## 权限变更汇总
- `optional_host_permissions` 增 Bing / Picsum / Unsplash 相关主机。
- 均为按需申请，默认不索取；不启用自动壁纸则完全不涉及。

## 测试策略（Vitest + Testing Library）
- 导航：面包屑从浏览器书签根（`id="0"` 渲染为「书签/Bookmarks」home 级）显示到当前目录；点击祖先级（含根级）确实导航（回归）；从深层能一路点回书签根；`TabBar` 进入按钮仅在激活的非主页 Tab 出现、点击后 `folderId` 变更且面包屑加深。
- 数据加载：`useBookmarkTree` 走 `getTree()`；`resolveInitialNav` 默认落地 = `rootFolderId`、失效回退到书签栏。
- 磁贴：渲染为带正确 `href` 的 `<a>`；`openInNewTab` 影响 `target`；拖拽后不误触跳转。
- i18n：`t()` 插值与回退；`resolveLang('auto')` 判定；切换语言后 UI 文案更新。
- 壁纸：`todayKey` 缓存命中/未命中；离线回退到缓存；`resolveUnsplash` 产出的 URL 含尺寸参、`download_location` 被调用；`screenPx` 钳制。
- 配色：主题色磁贴带 `tile--theme` 及可读层类。

## 已知限制
- 导航范围现在是**整棵书签树**（可越过默认落地目录向上/向任意分支浏览）；而实时搜索本轮仍限定在默认落地目录子树——两者范围不对称，属有意取舍（见 §3.3）。
- 因采用自建 i18n（非 `chrome.i18n`），Chrome 商店清单的**名称/描述**保持单一语言（英文）；仅 App 内 UI 双语可切换。
- Unsplash 需用户自备 Access Key（默认关闭），且 key 以客户端方式存于本地浏览器（无代理）。
- Bing/Picsum 通过其公共服务取图，可用性受第三方服务影响；离线时回退到缓存。

## 涉及文件（预估）
- 新增：`LICENSE`、`README.zh-CN.md`、`src/lib/i18n.ts`、`src/lib/wallpaper.ts`、`src/newtab/hooks/useI18n.ts`、`src/newtab/components/Attribution.tsx`、以及相应测试。
- 修改：`package.json`、`README.md`、`manifest.config.ts`、`src/types.ts`、`src/lib/constants.ts`、`src/lib/permissions.ts`、`src/lib/mapping.ts`（面包屑根节点/整树祖先）、`src/lib/navState.ts`（对整树校验、失效回退）、`src/lib/search.ts`（过滤限定到默认落地目录子树）、`src/newtab/hooks/useBookmarkTree.ts`（改用 `getTree()`）、`src/newtab/hooks/useNavState.ts`、`src/newtab/App.tsx`、`src/newtab/components/{TabBar,Breadcrumb,Tile,Grid,ContextMenu,EditDialog,EmptyState,Guidance,SearchBar,States}.tsx`、`src/options/Options.tsx`、`src/options/components/FolderTreeSelect.tsx`、`src/newtab/styles.css`、`src/options/styles.css`。
