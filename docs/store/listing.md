# Chrome Web Store 商品详情文案

## 简短说明（132 字符以内）

**English**

A Vivaldi-style Speed Dial new tab powered by your Chrome bookmarks. Tabs, search, screenshots, and daily wallpapers.

**中文**

类 Vivaldi 的书签 Speed Dial 新标签页：Tab 导航、分组搜索、网页截图与每日壁纸。

---

## 详细说明

### English

**Real Speed Dial — your bookmarks, beautifully tiled**

Turn a new tab into a fast, visual launchpad built entirely from your Chrome bookmarks. Pick a default folder in Settings; its links tile on the Home tab, and each subfolder becomes its own tab. Every edit writes back to Chrome bookmarks and syncs live — bookmarks stay the single source of truth.

**Navigate the whole tree**
- Clickable breadcrumb from the browser bookmarks root to the current folder
- Enter any subfolder tab with one click; browser Back steps out level by level
- Grouped search across the entire tree — Current folder vs Other folders — with full path on every result

**Tiles that behave like real links**
- Hover shows the target URL in the status bar
- Middle-click or Cmd-click opens a new tab
- Right-click for an in-app menu
- Icon + title with a stable URL gradient, or a live webpage screenshot with readable text

**Screenshots on your terms**
- Thumbnails refresh when you visit a bookmarked page
- Capture the exact on-screen state from the browser page context menu
- If the current URL is not bookmarked, pick a target from a searchable bookmark picker

**Make it yours**
- Dark, light, or system theme; solid color or auto-updating daily wallpaper (Bing, Lorem Picsum, or Unsplash with your own key)
- Adjustable column count and last-position memory
- English and 中文 UI — follows your browser language by default

**Privacy-first permissions**
- Core features need bookmarks, storage, favicon, and context menu access only
- Tab capture and wallpaper hosts are requested on demand when you enable those features
- No backend, no account — settings and Unsplash keys stay on your device

---

### 中文

**Real Speed Dial — 把书签变成漂亮的 Speed Dial**

新建标签页即进入由 Chrome 书签驱动的可视化启动台。在设置中选定一个默认落地目录：其直接书签平铺在「主页」Tab，每个子目录各成一个 Tab。所有编辑都直接写回 Chrome 书签并实时同步——书签始终是唯一事实来源。

**整棵书签树，轻松导航**
- 从浏览器书签根到当前目录的可点击面包屑
- 在子目录 Tab 上点「⤵ 进入」即可深入；浏览器后退键逐层返回
- 跨整树分组搜索——「当前目录 / 其他目录」——每条结果都带完整路径

**像真链接一样工作的磁贴**
- 悬停时浏览器左下角显示目标网址
- 中键或 Cmd 点击在新标签打开
- 右键为应用内菜单
- 「图标 + 标题」稳定 URL 渐变背景，或带可读文字层的网页截图

**截图，由你掌控**
- 访问已收藏页面时自动更新缩略图
- 也可通过浏览器页面右键菜单截取当前可见状态
- 当前 URL 未收藏时，可用支持标题与 URL 模糊搜索的书签选择器指定目标

**按你的方式定制**
- 深色 / 浅色 / 跟随系统；纯色或每日自动更新壁纸（Bing、Lorem Picsum，或自备 Key 的 Unsplash）
- 列数可调，记住上次位置
- 中英双语界面，默认跟随浏览器语言

**隐私优先的权限设计**
- 核心功能仅需书签、存储、favicon 与右键菜单权限
- 网页截图与壁纸相关主机权限在启用对应功能时按需申请
- 无后台、无账号——设置与 Unsplash Key 仅存于本机

---

## 商店素材文件

| 文件 | 尺寸 | 格式 | 用途 |
|---|---|---|---|
| `icon128.png` | 128×128 | PNG（含透明） | 扩展程序图标（ZIP 内 + 商店） |
| `promo-small.png` | 440×280 | 24 位 PNG | 小型宣传图块（必需） |
| `promo-marquee.png` | 1400×560 | 24 位 PNG | 顶部滚动宣传图（可选，提升曝光） |

图标按 [Chrome 应用商店图标规范](https://developer.chrome.com/docs/webstore/images?hl=zh-cn#icons) 制作：图形主体约 96×96，四周留 16px 透明内边距，在浅色与深色背景下均可辨识。

---

## 建议一并上传

- **屏幕截图**：至少 1 张，推荐 1280×800（全出血、无圆角）。展示新标签页磁贴网格、Tab 导航或搜索界面即可。
- **分类**：Productivity（生产力）
- **语言**：分别创建 English 与 中文（简体）商品详情，粘贴对应说明文字。

---

## Privacy 审核字段（开发者控制台 → Privacy）

以下文案可直接粘贴。商店审核以英文为主；中文仅作对照。

### 单一用途说明（Single purpose）

**English**

This extension replaces the new tab page with a Speed Dial grid driven by the user’s Chrome bookmarks. Its only purpose is bookmark-based visual navigation on the new tab: folder tabs, search within the bookmark tree, optional webpage thumbnails for tiles, and optional daily wallpaper backgrounds. It does not change search settings, inject ads, or provide unrelated browser features.

**中文**

本扩展仅将新标签页替换为基于 Chrome 书签的 Speed Dial 磁贴网格。唯一用途是在新标签页上提供书签可视化导航：目录 Tab、书签树搜索、可选的网页截图缩略图，以及可选的每日壁纸背景。不修改默认搜索、不注入广告、不提供无关浏览器功能。

### 远程代码（Remote code）

控制台请选择：**No, I am not using remote code.**

本扩展不执行任何远程托管的 JavaScript/WASM。所有逻辑均打包在扩展包内。可选壁纸功能仅按需拉取图片或 JSON 元数据（Bing / Lorem Picsum / Unsplash），不下载或执行远程代码。

若表单仍要求填写理由，可粘贴：

**English**

This extension does not use remote code. All executable logic is bundled in the extension package. Optional wallpaper features only fetch image or JSON data from Bing, Lorem Picsum, or Unsplash; no remotely hosted scripts are downloaded or executed.

**中文**

本扩展不使用远程代码。全部可执行逻辑均打包在扩展内。可选壁纸功能仅从 Bing、Lorem Picsum 或 Unsplash 拉取图片或 JSON 数据，不下载或执行远程脚本。

### 权限理由（Permission justifications）

#### activeTab

**English**

Used when the user chooses the page context-menu item to capture the current visible page as a Speed Dial thumbnail. The menu click is a user gesture; activeTab grants temporary access to capture that tab without permanently requesting broad host access for this manual flow.

**中文**

用户通过页面右键菜单「截取当前页为缩略图」时使用。该点击属于用户手势；activeTab 仅临时授权截取当前标签页，无需为此手动流程永久申请宽泛主机权限。

#### bookmarks

**English**

Core data source for the Speed Dial. The extension reads the bookmark tree to render tiles and folder tabs, and writes back create/update/move/delete operations so Chrome bookmarks remain the single source of truth and stay in sync across devices.

**中文**

Speed Dial 的核心数据来源。读取书签树以渲染磁贴与目录 Tab，并将创建/更新/移动/删除写回 Chrome 书签，使书签保持唯一事实来源并跨设备同步。

#### contextMenus

**English**

Adds a browser context-menu command on http(s) pages so the user can capture the current visible page as a thumbnail for a matching bookmark (or pick a bookmark if the URL is not bookmarked yet).

**中文**

在 http(s) 页面上添加浏览器右键菜单项，供用户将当前可见页面截取为对应书签的缩略图；若当前 URL 尚未收藏，则打开书签选择器指定目标。

#### favicon

**English**

Displays each bookmark’s site favicon on Speed Dial tiles and in search results via Chrome’s favicon service (`chrome://favicon` / `_favicon`), so tiles show recognizable site icons without fetching icons from arbitrary origins.

**中文**

通过 Chrome 的 favicon 服务在 Speed Dial 磁贴与搜索结果中显示各书签网站图标，无需向任意源请求图标。

#### storage

**English**

Stores user settings (landing folder, theme, tile style, wallpaper preference, language, etc.) in `chrome.storage.sync`, and device-local state (last navigation position, Unsplash key, wallpaper metadata) in `chrome.storage.local`. No account or remote backend is used.

**中文**

用 `chrome.storage.sync` 保存用户设置（落地目录、主题、磁贴样式、壁纸偏好、语言等），用 `chrome.storage.local` 保存本机状态（上次导航位置、Unsplash Key、壁纸元数据）。无账号、无远程后端。

#### tabs

**English**

Optional permission, requested only when the user enables screenshot tile style or manual thumbnail capture. Used with `chrome.tabs.captureVisibleTab` / tab query/create/remove to refresh bookmark thumbnails when visiting bookmarked pages or capturing on demand. Not required for the basic favicon/theme-color Speed Dial.

**中文**

可选权限，仅在用户开启截图磁贴样式或手动刷新缩略图时申请。配合 `chrome.tabs.captureVisibleTab` 及标签页查询/创建/关闭，在访问已收藏页面或按需截取时更新缩略图。基础的图标/主题色 Speed Dial 不需要此权限。
