# 验收状态（Target States）

这些是 `rubric.json` 中引用的验收状态。每个状态都必须能通过正常的用户交互到达（不允许走特殊调试路由），并在 SOTA 跑测评审时截图保存到 `screenshots/` 下（`sota_state_a.png`、`sota_state_b.png`……与下方各状态的 ID 对应）。

## 状态 A —— 首页，冷启动加载

- 路由：`/`
- 到达方式：冷启动加载 `/`。
- 必须可见：摄影师简介/Hero 文案，暗色主题（背景接近 `#0a0a0a`，暖白色正文文字，金色分隔线点缀），以及三个系列（凝视 / 无人之境 / 高原牧歌）的精选预览入口。
- 对照材料：`assets/reference_home_desktop.png`。

## 状态 B —— /work，筛选后的网格

- 路由：`/work`
- 到达方式：加载 `/work`，点击「牧野 / Pastoral」筛选控件。
- 必须可见：网格只展示 4 张牧野照片（`pastoral-01..04`），筛选控件显示「牧野」为选中态，且不出现任何肖像/风光分类的照片。
- 对照材料：`assets/reference_work_desktop.png`（仅对照布局/结构——参考图展示的是未筛选状态下的内容，筛选行为本身不由视觉参考图驱动）。

## 状态 C —— 灯箱，限定范围导航的中间步骤

- 路由：`/work`，且灯箱（Lightbox）处于打开状态
- 到达方式：在状态 B 的基础上（牧野筛选已激活），点击第 2 张牧野照片打开灯箱，然后点击一次「下一张」。
- 必须可见：灯箱此时展示的是 `pastoral-03`，并显示等效于「3 / 4」的位置指示（而不是「x / 14」）；此后再连续点击两次「下一张」，必须循环回到 `pastoral-02`，且整个过程中不能出现任何肖像或风光分类的照片。
- 对照材料：`assets/reference_lightbox_desktop.png`（用于对照灯箱外框/控件的样式）。
- 该状态直接对应 rubric 判定项 `lightbox-scoped-navigation`——单张截图不足以作为证据，评分方核对的是*点击序列*本身以及每一步对应的照片 id（详见 `rubric.json`）。

## 状态 D —— 系列详情页

- 路由：`/work/highland-pastoral`
- 到达方式：从首页点击进入「高原牧歌」系列预览（或直接导航到该路由）。
- 必须可见：叙事式长图文排版，图文块交替出现；`mock-data/photos.json` 中 `highland-pastoral` 系列的 `summary` 字段以斜体 Playfair Display 引言样式呈现；4 张牧野照片按 `order` 字段顺序全部出现，且各自使用真实说明文字。
- 对照材料：`assets/reference_series_desktop.png`。

## 状态 E —— /work，移动端视口

- 路由：`/work`
- 到达方式：将视口设为移动端宽度（例如 390×844），加载 `/work`。
- 必须可见：网格切换为单列布局（而不是多列瀑布流的等比缩小版）；若在该视口下打开灯箱，说明文字面板应固定在屏幕底部，而不是侧边浮层。
- 对照材料：`assets/reference_work_mobile.png`。

## 状态 F —— 联系表单，校验与成功态

- 路由：`/contact`
- 到达方式：（F1）所有字段留空直接点击提交；（F2）所有字段填入合法内容后提交。
- 必须可见：
  - F1：无效/为空的必填字段旁出现行内错误提示，提交按钮被禁用或提交被阻止。
  - F2：出现明确区分于原始表单的成功态（确认提示或等效反馈），替换或清晰覆盖在原表单之上——不能是无任何变化的静默无响应。
- 该页面表单状态没有可对照的视觉参考图；评分依赖 `playwright_assertion`，而不是 `screenshot_review`。

## SOTA 跑测的截图要求

- 状态 A、B、D、E 各截取一张静态截图（`sota_state_a.png`、`sota_state_b.png`、`sota_state_d.png`、`sota_state_e.png`）。
- 状态 C 需要截取两张（`sota_state_c1.png`：点击「下一张」之前；`sota_state_c2.png`：点击之后），并在 `sota-run.md` 中附一段简短说明，记录实际执行的点击序列以及每一步观察到的照片 id。
- 状态 F 需要截取 `sota_state_f1.png`（校验错误态）与 `sota_state_f2.png`（成功态）。
- 如果任何一个状态完全无法到达，必须在 `sota-run.md` 中明确记录，而不能默默省略——缺失的截图会被视为判定项失败，而不是「不适用」。
