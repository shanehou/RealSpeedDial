# Real Speed Dial

一个真正类似 Vivaldi Speed Dial 的 Chrome 浏览器插件（Manifest V3）：接管新标签页，把你选定的某个**书签目录**平铺呈现；子目录以顶部 **Tab** 呈现，更深层级采用「递归替换」进入。书签是唯一事实来源——所有编辑都直接写回 Chrome 书签并实时同步。

![icon](public/icons/icon128.png)

## 功能

- **书签驱动的 Speed Dial**：设置里选一个根目录，其直接书签平铺在「主页」Tab，子目录各成一个 Tab。
- **递归替换导航**：点文件夹磁贴整屏进入该文件夹；面包屑与浏览器**后退键**可逐层返回。
- **完整编辑**：新增 / 重命名 / 删除 / 拖拽排序 / 拖入文件夹，全部写回 Chrome 书签。
- **可配置磁贴样式**：`favicon 图标` / `主题色背景` / `网页截图`，带优雅回退（截图→主题色→favicon→首字母）。
- **网页截图**：访问页面时后台按策略自动抓取（限流），或右键磁贴手动刷新；权限按需申请。
- **搜索框**：实时过滤全部书签，或回车用搜索引擎搜索。
- **外观**：深色 / 浅色 / 跟随系统主题、纯色或壁纸背景、列数可调。
- **状态记忆**：记住上次所在层级与 Tab，下次打开自动恢复（失效目录优雅回退）。

## 开发

```bash
npm install        # 安装依赖
npm run dev        # 开发（@crxjs 提供 HMR，加载 dev 产物目录）
npm test           # 运行单元测试（Vitest）
npm run build      # 类型检查 + 打包到 dist/
```

## 本地体验（加载未打包扩展）

1. `npm run build`
2. Chrome 打开 `chrome://extensions`，开启右上角「开发者模式」
3. 点「加载已解压的扩展程序」，选择项目里的 `dist/` 目录
4. 新建标签页 → 首次会提示「选择目录」，打开扩展「选项」页选一个书签目录作为根目录

## 打包上架

```bash
npm run build
cd dist && zip -r ../real-speed-dial.zip . && cd ..
```

在 [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole) 上传 `real-speed-dial.zip`，填写商店信息与权限用途说明后提交审核。每次更新在 `manifest.config.ts` 递增 `version`。

## 权限说明

| 权限 | 用途 | 时机 |
|---|---|---|
| `bookmarks` | 读写书签（核心） | 安装时 |
| `storage` | 保存设置与导航状态 | 安装时 |
| `favicon` | 显示网站图标 | 安装时 |
| `tabs` + `<all_urls>` | 网页截图缩略图（`captureVisibleTab`） | **运行时按需申请**（仅当启用「网页截图」样式或手动刷新时） |

截图相关权限为**可选权限**，默认不索取；不使用截图样式则完全无需授予。

## 架构

- `src/lib/*`：纯逻辑与 Chrome API 封装（`mapping` 视图投影、`bookmarks`、`settings`、`navState`、`thumbnails`、`favicon`、`search`、`reorder`、`capturePolicy`、`permissions`、`theme`），均有单元测试。
- `src/newtab/*`：新标签页 React 应用（hooks + 组件）。
- `src/options/*`：设置页 React 应用。
- `src/background/service-worker.ts`：后台截图抓取与限流。

技术栈：React + TypeScript + Vite + `@crxjs/vite-plugin`，Vitest + Testing Library 测试。

## 已知限制

- `captureVisibleTab` 只能抓「当前可见的活动标签页」，故截图在你**访问过**对应站点后才会出现（与 Vivaldi 一致）。
- 未同时具备 `tabs`/host 权限时，`favicon` 权限会在安装时触发一次权限提示。

## 设计与实现文档

- 设计规格：`docs/superpowers/specs/2026-07-09-real-speed-dial-design.md`
- 实现计划：`docs/superpowers/plans/2026-07-09-real-speed-dial.md`
