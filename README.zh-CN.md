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

```bash
npm install
npm run dev
npm test
npm run build
```

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
