# 区域截图缩略图设计

- 日期：2026-07-15
- 状态：已与用户确认，待评审
- 范围：为磁贴缩略图新增「区域截图」能力——在网页上右键框选一块区域作为缩略图焦点。核心是把缩略图从「一张整页截图」升级为「整页截图 + 归一化焦点区域」，并让所有截图入口共用该焦点区域。不改动书签数据模型与导航模型。

## 背景

当前缩略图只用 `chrome.tabs.captureVisibleTab` 截「当前可见页」，整张图以 `object-fit: cover` 塞进磁贴。磁贴较小，整页缩放后主体（logo、标题、核心内容）看不清。

现有三个截图入口（均为整页）：

1. **加载自动抓取**：`chrome.tabs.onUpdated`/`onActivated` 命中书签 URL 且策略允许时抓取。
2. **网页 Chrome 右键菜单** `save-current-page-thumbnail`「将当前页面设为缩略图」。
3. **磁贴右键菜单「刷新缩略图」**：发 `capture-url`，后台新开该 URL 标签、加载完成后整页截图、关闭标签。

用户希望：在网页上右键框选一块区域，让磁贴突出显示这块主体，从而更清晰。

## 目标

1. 网页右键新增独立菜单项「截取区域设为缩略图」，在**真实页面上**框选一块区域。
2. 选框支持**拖角、拖边调整尺寸**与**整体移动**，并有显式确认/取消。
3. 缩略图记录用户框选的**归一化焦点区域**；磁贴显示时以该区域为焦点，且在列数变化（磁贴比例变化）时仍尽量完整展示焦点主体。
4. 统一所有入口：整页截图 = 焦点区域为全图；手动刷新 / 过期更新 / 自动抓取时**沿用该 URL 已存的焦点区域**。
5. 完全向后兼容：旧缩略图无焦点区域时按全图处理，行为不变。

## 非目标（范围边界）

- 不做需要滚动拼接的「整页长图」：`captureVisibleTab` 只能截当前可见视口，焦点区域相对可见视口归一化。
- 不改「全局 `tileStyle` 决定是否显示截图」这一现有机制——区域图同样只在 `screenshot` 样式下显示。
- 磁贴右键不新增交互式框选（框选需真实页面，只在网页右键入口提供）。
- 不引入新的第三方依赖、不引入后端。

## 关键取舍

### 取舍 1｜权限模型：新增静态 `scripting`，复用 `activeTab`

- 网页右键菜单点击是**用户手势**，会为当前标签临时授予 `activeTab`：既允许 `scripting.executeScript` 注入遮罩，也允许 `captureVisibleTab` 截当前标签。
- 因此区域截图全程**无需 `<all_urls>` 授权弹窗**；只需在 `manifest` 静态 `permissions` 增加 `scripting`（安装时授予、不弹窗）。
- 现有「整页菜单 / 自动抓取 / 磁贴刷新」仍走原有可选权限 `tabs` + `<all_urls>` 路径，保持不变。

### 取舍 2｜时序：先截图，后框选

- 点击菜单后**先** `captureVisibleTab`（此刻画面干净、无遮罩）得到整页图，**再**注入遮罩让用户在真实页面上框选，**遮罩期间锁定页面滚动**。
- 好处：截图里绝不混入遮罩；框选期间禁止滚动，保证框选坐标与已截图严格对齐。
- 注入失败的页面（`chrome://`、Chrome 应用商店、部分强 CSP 站点）：截图作废、不落库、给出一次告警日志，不影响其它功能。

---

## 1. 数据模型（`src/types.ts`）

```ts
// 归一化焦点区域：均为 0~1，相对「当前可见页」截图
export interface NormalizedRegion {
  x: number; // 左上角 x
  y: number; // 左上角 y
  w: number; // 宽
  h: number; // 高
}

export interface ThumbnailRecord {
  url: string;
  dataUrl: string;            // 始终是「当前可见页」整页截图
  capturedAt: number;
  region?: NormalizedRegion;  // 缺省 = 全图 {x:0,y:0,w:1,h:1}（旧数据 / 整页截图）
}
```

- `PendingThumbnailCapture`（`src/lib/thumbnails.ts`）同步新增可选 `region`，使「截图页不是精确书签」时经 `ThumbnailPicker` 选书签的路径也能携带焦点区域。
- IndexedDB schema 不变（`region` 只是记录里的可选字段，无需版本升级）。

## 2. 交互流程

### 2.1 网页右键「截取区域设为缩略图」

新增菜单项 `capture-region-thumbnail`（文案 i18n key `context.captureRegion`，与现有 `save-current-page-thumbnail` 并列，二者共存）。点击后：

1. `captureVisibleTab({ format:'jpeg', quality:70 })` → 整页 `dataUrl`（复用现有 `captureQueue` 限频）。
2. `scripting.executeScript` 注入选区遮罩（见 §2.2），等待用户框选，返回归一化 `region` 或 `null`（取消）。
3. `null` → 结束，不落库。
4. 有 `region`：
   - 当前页 URL 精确匹配书签 → 写入所有匹配 URL：`{ dataUrl, capturedAt, region }`。
   - 不匹配 → `putPendingCapture(id, { sourceUrl, dataUrl, capturedAt, region })` → 打开 `ThumbnailPicker` 弹窗选书签；`ThumbnailPicker` 落库时带上 `region`。
5. 广播 `thumbnail-updated`。

### 2.2 选区遮罩（注入到真实页面）

注入函数在页面隔离世界创建全屏 `position:fixed` 高 `z-index` 遮罩，返回 `Promise<NormalizedRegion | null>`（`executeScript` 等待其 resolve）。行为：

- **首次拖拽**：在遮罩空白处按下并拖动画出初始选框。
- **可编辑状态**：选框出现后不再「松手即完成」，而是进入可调整态：
  - **8 个手柄**（4 角 `nw/ne/sw/se` + 4 边 `n/s/e/w`）可拖动改尺寸；
  - 选框**内部按下拖动**整体移动；
  - 调整时始终钳制在视口内。
- **观感**：选框外整体压暗（`rgba(0,0,0,.45)` 之类），选框内透亮，边框 + 8 手柄可见；标准截图工具体验。
- **确认/取消**：`Enter` 或遮罩上「确认」按钮完成；`Esc` 或「取消」按钮取消；选框过小（如短边 < 8px）视为取消，防误触。
- **锁定滚动**：遮罩存在期间阻止页面滚动（`wheel`/`touchmove`/键盘滚动 `preventDefault`），保证坐标与已截图对齐。
- **归一化**：以 `window.innerWidth/innerHeight` 归一化，`clamp` 到 `[0,1]`，返回 `{x,y,w,h}`。
- 遮罩样式内联，避免依赖注入 CSS 文件；退出时彻底移除 DOM 与事件监听。

## 3. 显示算法（`Tile` 端，焦点完整可见）

磁贴依据「焦点区域完整可见 + 外围补充填满 + 区域居中 + 不变形」显示。抽为纯函数便于单测：

```ts
// src/lib/thumbFocus.ts（新增）
export function computeFocusBackground(
  region: NormalizedRegion,   // 相对图片归一化
  imageAspect: number,        // 图片自然宽高比 IW/IH
  containerAspect: number,    // 磁贴宽高比 CW/CH
): { backgroundSize: string; backgroundPositionX: string; backgroundPositionY: string };
```

**推导**（记图片自然比 `Ai`、磁贴比 `Ac`；焦点区域像素比 `Ar = (w/h)*Ai`）：

1. 求「视窗」V（相对图片归一化，包含整个 region、像素比 = `Ac`、尽量贴合、以 region 中心为心）：
   - 若 `Ar >= Ac`（区域比磁贴更宽）→ 以宽为准纵向扩展：`Vw = w`，`Vh = w*Ai/Ac`。
   - 否则 → 以高为准横向扩展：`Vh = h`，`Vw = h*Ac/Ai`。
   - 视窗中心对齐 region 中心，`clamp` 平移使 `V ⊆ [0,1]²`，记其左上角为 `Vx, Vy`。若 `Vw>1` 或 `Vh>1`（无法在图内容纳该比例视窗）→ 走下述 cover 兜底。
2. 映射为 CSS（`background`，等比不变形、随容器尺寸自适应）：
   - `background-size: ${100/Vw}% auto`
   - `background-position-x: ${Vw < 1 ? Vx/(1-Vw)*100 : 0}%`
   - `background-position-y: ${Vh < 1 ? Vy/(1-Vh)*100 : 0}%`

   因构造时保证 `V` 像素比 = `Ac`，`background-size` 只设宽百分比、高 `auto` 即可让 V 精确填满磁贴且不变形。

**全图与越界回退**（关键，避免留白/回归）：

- **`region` 覆盖全图**（`w>=1 && h>=1`，含旧数据无 `region`）→ 直接 `background-size: cover` + `background-position: center`，与现有整页 `cover` 行为完全一致（填满、不留白）。注意：全图不能套用「焦点完整可见」，否则会退化成 contain（留白）——这是回归，必须走 cover。
- **子区域正常情形**（`V ⊆ [0,1]²`）→ `background-size` 放大到 `>100%`，把框选主体放大填满磁贴。这正是「小区域看得清」的关键：区域越小，放大倍数越高。
- **子区域越界兜底**：`region` 贴近整图边缘且与磁贴比例悬殊，导致理想 `V` 无法在不越界下同时「含 region + 比例=Ac」→ 回退 `background-size: cover` + `background-position` 定位到 region 中心（保证填满，可能裁掉 region 极少边缘）。为罕见情形。

即：`computeFocusBackground` 的 `backgroundSize` 取值为 `cover`（全图/越界兜底）或 `${100/Vw}% auto`（子区域放大）。

**Tile 接线**：

- `Tile` 统一用 `background-image` 承载截图（替换现 `<img class="tile__screenshot">` 的 `object-fit:cover`），**只保留这一条渲染路径**，不分叉。图片自然比例经 `Image().decode()` 或 `naturalWidth/Height` 获取，容器比例用 `ResizeObserver` 或读取 `clientWidth/Height`（列数变化会触发重算）。
- 无 `region`（旧数据）按全图处理，走上面「全图 cover」分支，视觉与现状一致。

## 4. 更新逻辑的统一

`region` 是「焦点意图」的唯一载体，被所有入口复用：

| 入口 | 焦点区域来源 |
|---|---|
| 网页右键「截取区域」 | 交互框选，写入新 `region` |
| 网页右键「整页设为缩略图」（保留） | `region = 全图 {0,0,1,1}` |
| 加载自动抓取 / 过期自动更新 | 重新截可见页，**沿用该 URL 已存 `region`**（`getThumbnail(url)?.region`，无则全图） |
| 磁贴右键「刷新缩略图」（`capture-url`） | 后台开页整页截图，**沿用已存 `region`**（无则全图） |

- 落库前统一从旧记录读取 `region` 并携带，实现「一次框选、后续更新长期保持焦点」。
- 页面内容随时间变化时，归一化区域按相对位置复用（布局通常稳定，属可接受近似）。

## 5. 权限（`manifest.config.ts`）

- `permissions` 增加 `scripting`（静态、安装时授予、不弹窗）。
- `activeTab` 已存在，右键菜单点击触发用户手势即为当前标签授权，满足注入 + 截图。
- 不改动现有 `optional_permissions`（`tabs`）与 `optional_host_permissions`。

## 6. 向后兼容

- 旧 `ThumbnailRecord` 无 `region` → 全部按全图渲染，与当前效果一致。
- 现有整页菜单 `save-current-page-thumbnail`、自动抓取、磁贴刷新的既有行为不变，仅在落库时附带（沿用或全图）`region`。

---

## 数据模型变更汇总

- `src/types.ts`：新增 `NormalizedRegion`；`ThumbnailRecord` 增可选 `region`。
- `src/lib/thumbnails.ts`：`PendingThumbnailCapture` 增可选 `region`。

## 权限变更汇总

- `manifest.config.ts`：`permissions` 增 `scripting`。其余权限不变。

## 测试策略（Vitest）

- **焦点算法** `computeFocusBackground`：
  - region = 全图（含无 `region`）→ `background-size: cover`、position center（填满、不留白、不回归）。
  - 子区域「比磁贴更宽 / 更高」两分支的 `Vw/Vh` 与放大倍数正确。
  - 中心对齐与 `clamp`；region 贴边、与磁贴比例悬殊时回退 cover。
  - 不同 `containerAspect`（模拟列数变化）下焦点主体始终完整落在视窗内。
- **归一化** overlay 坐标：给定视口尺寸与拖拽像素矩形 → 正确归一化并 `clamp`（可将坐标换算抽成纯函数单测；DOM 事件部分可选轻量测试）。
- **更新沿用 region**：`storeCapture`/自动更新路径在已存 `region` 时保留、无 `region` 时为全图；整页菜单写入全图。
- **数据流**：`ThumbnailPicker` 落库带 `region`；`thumbnail-updated` 广播后 `useThumbnails` 重读。
- **向后兼容**：无 `region` 记录的渲染路径不回归。

## 已知限制

- 焦点区域相对「当前可见视口」，无法框选需滚动才可见的内容。
- 自动/后台更新沿用归一化区域，页面重排后焦点可能轻微偏移（相对位置近似）。
- 注入受页面限制：`chrome://`、Chrome 应用商店、强 CSP 页面可能无法框选，此时该入口不可用（其它入口不受影响）。
- 区域图仍受全局 `tileStyle` 约束，仅在 `screenshot` 样式下显示。

## 涉及文件（预估）

- **新增**：`src/lib/thumbFocus.ts`（焦点算法）、`src/lib/thumbFocus.test.ts`；overlay 注入脚本（`src/background/` 下新增，如 `regionOverlay.ts`）及其纯逻辑测试。
- **修改**：`src/types.ts`、`src/lib/thumbnails.ts`、`src/background/service-worker.ts`（新菜单项 + 区域截图流程 + 更新沿用 region）、`src/options/ThumbnailPicker.tsx`（落库带 region）、`src/newtab/components/Tile.tsx`（改 background 焦点显示）、`src/newtab/styles.css`（`.tile__screenshot` 显示方式）、`src/lib/i18n.ts`（`context.captureRegion` 中英文案）、`manifest.config.ts`（`scripting` 权限）。
