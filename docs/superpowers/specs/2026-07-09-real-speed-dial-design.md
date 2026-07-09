# Real Speed Dial — 设计规格

> 一个真正类似 Vivaldi Speed Dial 的 Chrome 浏览器插件：用户选择一个书签目录，插件把该目录中的书签平铺在新标签页上；子目录以 Tab 形式呈现，更深的层级通过「递归替换」进入。

- 日期：2026-07-09
- 状态：设计已确认，待生成实现计划
- 技术栈：React + TypeScript + Vite（`@crxjs/vite-plugin`），Chrome Manifest V3

---

## 1. 目标与非目标

### 1.1 目标

- 接管 Chrome **新标签页**，呈现为 Speed Dial 首页（最接近 Vivaldi 体验）。
- 用户在设置里选定一个书签**根目录**，插件按规则把其内容铺在首页。
- 子目录以顶部 **Tab** 呈现；进入更深的文件夹时采用**递归替换**导航模型。
- 支持对书签的**完整编辑**（新增/重命名/删除/拖拽排序/移动），全部写回 Chrome 书签。
- 磁贴样式**可配置**：favicon 图标 / 主题色背景 / 网页截图，三者共存并优雅回退。
- 记住导航状态（当前层级 + 选中 Tab），下次打开恢复现场。
- 附加能力：顶部搜索框、自定义背景、列数/磁贴大小、深浅主题。

### 1.2 非目标（YAGNI，本版不做）

- 不做后台离屏批量预抓取所有书签截图（太重）。
- 不接入第三方截图服务（隐私）。
- 不做书签的云端账户/自有同步（直接复用 Chrome 书签同步）。
- 不做磁贴网格虚拟化（首版常规渲染，测量后按需增强）。
- 不做「记住每个 Tab 各自钻入位置」的多路径记忆（只记全局当前位置）。
- 不做自动化 E2E（首版手动验证）。

---

## 2. 架构总览

Chrome MV3 插件，四个组成部分 + Chrome API + 本地存储：

1. **新标签页（New Tab，React 应用）** — 接管新标签页。包含 Tab 栏、磁贴网格、面包屑、拖拽/新增/重命名/删除、搜索框、背景/主题/列数渲染。
2. **设置页（Options，React 应用）** — 选根目录、磁贴样式、缩略图策略、外观默认值、打开方式、状态记忆开关。
3. **Service Worker（后台）** — 监听页面加载完成自动抓截图（限流）、处理手动/批量抓取请求、写缩略图到 IndexedDB。
4. **存储**：
   - `chrome.storage.sync`：设置项（跨设备同步）。
   - `chrome.storage.local`：导航状态（本机当前位置）。
   - `IndexedDB`：缩略图二进制、自定义壁纸图片（体积大，不入 sync）。

### 2.1 核心原则

**Chrome 书签是唯一事实来源（single source of truth）。**

- 页面直接读书签树渲染，不维护独立的可变副本。
- 所有编辑操作直接写回 `chrome.bookmarks.*`。
- 监听 `chrome.bookmarks.onChanged/onCreated/onRemoved/onMoved/onChildrenReordered` 事件回流并重渲染，实现实时同步（在别处改书签，首页自动更新）。
- 设置与缩略图是「附加数据」，分别存 `storage` 与 `IndexedDB`，以书签节点 `id` / `url` 关联。

---

## 3. 数据模型与目录映射

### 3.1 数据来源

`chrome.bookmarks.getSubTree(rootFolderId)` 取根目录整棵子树，节点为 Chrome 原生 `BookmarkTreeNode`（`id / title / url / children / parentId / index`）。有 `url` 的是书签，无 `url` 且有 `children` 的是文件夹。

### 3.2 映射规则

```text
某个文件夹（根目录，或递归进入的任意文件夹）
├─ 直接书签         → 该层「主页」Tab 的磁贴
├─ 子目录 A         → 顶部 Tab「A」
│   ├─ 书签         → 进入 Tab A 后平铺的磁贴
│   └─ 子目录 A-1   → Tab A 里的一个「文件夹磁贴」，点击递归进入
└─ 子目录 B         → 顶部 Tab「B」
```

- **Tab 栏** = 当前文件夹的直接子文件夹们，外加一个「主页」Tab（承载当前文件夹的散装书签）。
- **文件夹磁贴** = 当前所在 Tab（文件夹）内部的子文件夹，显示 2×2 内容预览，点击递归进入。

### 3.3 边界规则（对每一层都成立）

- 当前文件夹下**没有散装书签** → 不显示「主页」Tab，直接从第一个子文件夹 Tab 开始（避免空 Tab）。
- 当前文件夹下**只有散装书签、没有子文件夹** → 不显示 Tab 栏，直接平铺磁贴。
- 当前文件夹为**空** → 显示友好空态（提示 + 新增按钮）。

### 3.4 视图模型（从书签树派生的只读投影，不额外持久化）

```ts
type SpeedDialItem =
  | { kind: 'bookmark'; id: string; title: string; url: string; index: number }
  | { kind: 'folder'; id: string; title: string; index: number; childrenPreview: string[] };
  // childrenPreview: 取前 4 个子项用于文件夹磁贴的 2×2 预览（favicon/截图）

type TabModel = { id: string; title: string; isHome: boolean };

interface FolderView {
  folderId: string;
  tabs: TabModel[];          // 含可能的「主页」Tab；可能为空（不显示 Tab 栏）
  activeTabId: string;
  items: SpeedDialItem[];    // 当前 Tab 对应文件夹的直接子项
  breadcrumb: { id: string; title: string }[]; // 根 → 当前
}
```

`lib/mapping.ts` 负责 `BookmarkTreeNode → FolderView` 的纯函数转换，可独立单测。

---

## 4. 导航模型：递归替换

进入更深文件夹时，**整屏（面包屑 + Tab 栏 + 磁贴网格）替换为该文件夹的视图**。每个文件夹都是自相似的 Speed Dial：「散装书签(主页 Tab) + 子目录(Tab)」。

### 4.0 导航语义（精确定义）

为消除实现歧义，明确三个概念：

- **当前文件夹 F**（recursion root）：= 面包屑末端。视图的 Tab 栏由它决定。
- **Tab 栏** = `[主页(仅当 F 有直接书签)]` + `F 的直接子文件夹`。
- **激活 Tab 决定磁贴网格内容**：
  - 激活「主页」 → 网格 = **F 自己的直接书签**。
  - 激活某子文件夹 Tab `S` → 网格 = **S 的直接书签** + **S 的子文件夹（渲染为文件夹磁贴）**。
- **文件夹磁贴点击（递归替换）**：点击网格中的文件夹磁贴 `G`（即 S 的子文件夹）→ 令 `F ← G`，整屏替换为 G 的视图（Tab 栏变为 G 的主页 + G 的子文件夹），面包屑追加到 G。

即：`selectedTabId` 是「主页」或 F 的某个直接子文件夹；只有点击**文件夹磁贴**才会改变当前文件夹 F。同一文件夹的书签可能经由两条路径展示（作为上层的某个 Tab，或作为自身为 F 时的主页），网格内容一致，仅 Tab 栏/面包屑不同——这是自相似模型的自然结果，可接受。

### 4.1 进入方式

- **顶层子目录**：点顶部 **Tab** 进入。
- **更深文件夹**：点磁贴网格里的**文件夹磁贴**，整屏替换为该文件夹视图。

### 4.2 返回方式

- **面包屑**：`根 › 工作 › 后端`，点任意一层跳回该层。
- **浏览器后退键**：每次进入文件夹压入一条 history 记录（`history.pushState`），后退键可逐层返回，符合直觉。

### 4.3 取舍说明

递归替换的代价：深入后顶层分类 Tab 会被替换掉，跨分类跳转需先用面包屑/返回退回上层。考虑到书签通常只有 1–2 层，代价很小；换来的是模型一致性与干净的递归实现。

---

## 5. 交互设计

### 5.1 磁贴交互

- 单击**书签磁贴** → 打开链接（默认当前标签页；设置可切「新标签页打开」）。
- 单击**文件夹磁贴** → 递归进入（整屏替换）。
- 右键磁贴 → 上下文菜单：编辑（重命名 / 改 URL）、删除、刷新缩略图、在新标签页打开。
- 拖拽磁贴 → 排序；拖到文件夹磁贴上 → 移入该文件夹（`chrome.bookmarks.move`）。
- 空白处「+」按钮 → 新增书签 / 新增文件夹（弹窗输入）。

### 5.2 编辑写回

所有增删改移调用 `chrome.bookmarks.create/update/remove/move`，靠事件回流重渲染，保证与 Chrome 书签一致，不维护独立可变前端副本。

### 5.3 顶部搜索框

- 回车 → 用默认搜索引擎搜索（可配置 Google/Bing/百度/自定义 URL 模板）。
- 输入时**实时过滤**：跨整棵根目录子树匹配书签，即时显示结果，点击直达。

### 5.4 导航状态记忆

- 记录 `{ currentFolderId, selectedTabId }`（含义见 §4.0：`currentFolderId` = 当前文件夹 F / 面包屑末端，`selectedTabId` = 「主页」或 F 的某个直接子文件夹），存 `chrome.storage.local`（跨浏览器重启保留，不入 sync）。
- 打开新标签页时校验 `currentFolderId` 与 `selectedTabId` 是否仍存在；失效则优雅回退到根目录（或 F 的主页）。
- 设置开关：「恢复上次位置 / 总是回到首页」，默认**恢复上次位置**。

---

## 6. 缩略图（网页截图）

### 6.1 抓取方式

`chrome.tabs.captureVisibleTab` 只能抓**当前可见的活动标签页**，据此设计更新机制：

- **自动更新（被动，主力）**：Service Worker 监听标签页加载完成，当用户真正打开某书签 URL 时抓一张，按 URL 存 IndexedDB（带时间戳）。用**新鲜度阈值**限流。
- **手动更新（主动）**：
  - 单个刷新：磁贴右键「刷新缩略图」→ 后台在新标签页打开该 URL、加载完成后抓图、自动关闭。
  - 「把当前页存为此书签缩略图」：用户停在某页时一键指定（零打扰）。
  - 批量刷新：可选，逐个打开→抓→关；二次确认，默认只刷新「缺图或过期」。

### 6.2 策略配置

自动更新时机：`每次访问 / 仅当超过 N 天 / 从不`（默认「仅当超过 7 天」，N 可配置）。

### 6.3 回退链

截图样式 → 无截图/过期时回退到**主题色** → 再回退到 **favicon** → 最后回退到**首字母色块**。永不空白。

---

## 7. 权限与 Manifest

### 7.1 MV3 权限

- `bookmarks` — 读写书签（必需）。
- `storage` — 设置与状态（必需）。
- `chrome_url_overrides.newtab` — 接管新标签页（必需）。
- `tabs` + `host_permissions: <all_urls>` — 用于 `captureVisibleTab`。**敏感权限**，不默认索取。

### 7.2 截图权限按需动态申请

- 默认仅申请 `bookmarks` + `storage`，favicon / 主题色样式零敏感权限。
- 当用户首次启用「网页截图」样式或触发手动抓取时，用 `chrome.permissions.request` **动态申请** `tabs` + host 权限。
- 权限被拒 → 提示并自动切回非截图样式，不阻塞主流程。

---

## 8. 项目结构

```text
real-speed-dial/
├─ manifest.config.ts        # @crxjs manifest 定义
├─ vite.config.ts
├─ package.json
├─ tsconfig.json
├─ src/
│  ├─ newtab/                # 新标签页 React 应用
│  │  ├─ index.html / main.tsx / App.tsx
│  │  ├─ components/         # TabBar, Grid, Tile, FolderTile, Breadcrumb, SearchBar, ContextMenu, EditDialog, EmptyState
│  │  └─ hooks/              # useBookmarkTree, useNavState, useSettings, useThumbnail
│  ├─ options/               # 设置页 React 应用
│  ├─ background/            # service worker：截图抓取与限流
│  ├─ lib/                   # 纯逻辑（无 React，可单测）
│  │  ├─ bookmarks.ts        # 书签读写封装 + 事件订阅
│  │  ├─ mapping.ts          # 书签树 → FolderView（核心纯函数）
│  │  ├─ thumbnails.ts       # IndexedDB 缩略图存取
│  │  ├─ settings.ts         # storage.sync 封装
│  │  └─ navState.ts         # storage.local 导航状态
│  └─ types.ts
└─ tests/                    # 单元测试（Vitest）
```

### 8.1 模块边界

- `lib/mapping.ts`：纯函数，核心逻辑，独立单测。
- React 组件：只负责渲染与交互。
- Chrome API：收敛在 `lib/*` 封装内，便于 mock 测试。

---

## 9. 错误处理与边界情况

- 未选根目录 → 新标签页显示引导页 +「打开设置」按钮。
- 根目录被删除/失效 → 提示重选，不白屏。
- 空文件夹 → 友好空态 + 新增按钮。
- favicon 加载失败 → 回退首字母色块。
- 截图不存在/过期 → 按 §6.3 回退链处理，永不空白。
- 截图权限被拒 → 提示并切回非截图样式。
- 书签量很大 → 首版常规渲染；虚拟化留作增强。
- 别处改动书签 → 事件监听实时同步。

**错误处理原则**：Chrome API 调用统一在 `lib/*` try/catch，失败返回明确结果而非抛裸异常到 UI；UI 层可感知失败给 toast，后台静默失败记录后跳过。

---

## 10. 测试策略

- **单元测试（Vitest）**：重点覆盖 `lib/mapping.ts`（主页 Tab 隐藏规则、Tab 栏隐藏规则、递归层级、排序），以及 `settings/navState/thumbnails` 存取逻辑。Chrome API 用 mock。
- **组件测试（React Testing Library）**：TabBar 切换、文件夹磁贴递归进入、面包屑返回、搜索过滤、右键菜单编辑流程。
- **手动验证**：加载 unpacked 扩展在真实 Chrome 验证权限申请、截图抓取、书签写回、状态记忆。
- 遵循 TDD：核心纯逻辑（mapping）先写测试再实现。

---

## 11. 待实现里程碑（概览，详细计划见 implementation plan）

1. 项目脚手架（Vite + React + TS + @crxjs + MV3 manifest），能加载 unpacked。
2. `lib/bookmarks.ts` + `lib/mapping.ts` + 单测（核心映射逻辑）。
3. 新标签页只读渲染：Tab 栏 + 磁贴网格 + 递归进入 + 面包屑 + 后退键。
4. 设置页：根目录选择 + 基础外观设置。
5. 编辑能力：新增/重命名/删除/拖拽排序/移动 + 事件回流。
6. 导航状态记忆。
7. 磁贴样式（favicon → 主题色）+ 回退链。
8. 搜索框（搜索引擎 + 实时过滤）。
9. 截图缩略图 + 按需权限 + 抓取/更新机制。
10. 外观增强：自定义背景、列数/磁贴大小、深浅主题。
```
