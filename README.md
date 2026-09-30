# 摄影师作品集 Showcase — 任务包

这是一个用于评测 SOTA coding agent 的高难度、长程 Web Dev 基准任务。被测 agent 需要**从一个几乎空白的 React+TS+Vite 脚手架开始**，结合真实内容数据、视觉参考图，以及一份包含多条耦合约束的自然语言需求文档，**从 0 构建**一个摄影师作品集网站。

> 本任务包**不是**"在已有代码里找 bug 修"的范式：`starter/` 里没有预先写好的路由、页面或组件，也没有任何埋点提示。7 条耦合约束（见 `task.md`）需要 agent 自己设计数据流、状态管理和组件结构去实现。这样做的原因：局部埋点的判别力有限（agent 只要定位到那一小块代码就能修完），从 0 构建才能真正考察 agent 在长程任务中规划架构、处理耦合约束、并做浏览器实测验证的能力。评分仍然是纯行为式的（见 `rubric.json`），不依赖代码结构，因此这次范式调整不需要改动 `rubric.json`/`metadata.json`/`target_states.md`。

## 技术栈

- React + TypeScript + Vite
- 客户端路由，5 个页面 + 1 个全局共享组件（Lightbox 灯箱）——路由方案由 agent 自行选择并安装（`starter/` 中未预装 `react-router-dom`）
- 无后端 —— 所有内容均为静态/本地数据（`mock-data/`），联系表单提交仅为前端模拟

## 目录结构

```
webdev-task-photographer-portfolio/
├── task.md                 # agent 任务提示词
├── metadata.json            # 任务分级 / 埋点清单（仅 annotator）
├── README.md                 # 本文档
├── starter/                    # agent 起始脚手架；提交包中已替换为 agent 最终产出
│   ├── index.html
│   ├── package.json / package-lock.json
│   ├── tsconfig.json / vite.config.ts
│   ├── src/
│   │   ├── main.tsx
│   │   ├── photos.json
│   │   ├── styles.css
│   │   └── vite-env.d.ts
│   ├── public/
│   │   ├── fonts/*.woff2
│   │   └── photos/<category>/*.jpg
│   ├── e2e-verify.mjs        # agent 自带的浏览器验证脚本
│   └── annotator-verify.mjs   # annotator 补充验证脚本
├── assets/                    # 视觉参考图 + 本地字体（仅参考，非业务数据）
│   ├── reference_home_desktop.png
│   ├── reference_work_desktop.png
│   ├── reference_series_desktop.png
│   ├── reference_lightbox_desktop.png
│   ├── reference_about_desktop.png
│   ├── reference_work_mobile.png
│   ├── FONTS.md / README.md
│   └── fonts/*.woff2
├── mock-data/                  # 真实内容数据，agent 不得修改
│   ├── photos.json
│   └── photos/<category>/*.jpg
├── tests/                     # rubric.json 对应的自动化检测套件（仅 annotator）
│   ├── playwright.config.ts
│   ├── helpers/
│   ├── e2e/*.spec.ts
│   └── README.md
├── rubric.json                # 可机器判定的评分规则（仅 annotator）
├── target_states.md            # 验收状态 A-F 详细操作序列（仅 annotator）
├── sota-run.md                 # SOTA 跑测执行轨迹记录（产出物）
└── screenshots/                 # 按 target_states.md 截取的验收状态截图（产出物）
    └── sota_state_*.png
```

> **说明**：上面这份树对应最终交付/上传的提交包结构。在本地任务作者工作区里，`starter/`（空脚手架）与 `sota-submission/`（跑测后拉回的 agent 产出）、`reference-solution/`（内部答案 key）是三个独立目录；打包提交时，`sota-submission/` 的内容会原样放入 `starter/`，`reference-solution/` 与其它仅供本地自查的文件（`PROMPT.md`、`annotator-verify-results.json` 等）不包含在提交包内。

## ⚠️ 文件可见性：交给 SOTA agent 之前必须过滤

本目录混合了两类文件：**agent 可见**（构成任务本身）和**仅供 annotator/评审使用**（构成答案与评分标准，绝不能让被测 agent 看到，否则等于泄题）。实际跑 Codex CLI 时，工作目录里只应包含"agent 可见"这一部分。

| 文件/目录 | 可见性 | 说明 |
|---|---|---|
| `task.md` | **agent 可见** | 交给 agent 的任务提示词（中文） |
| `starter/` | **agent 可见** | 起始脚手架，见下方说明 |
| `mock-data/` | **agent 可见** | 真实内容数据（照片、`photos.json`） |
| `assets/` | **agent 可见** | 视觉参考图、字体文件、`FONTS.md` |
| `metadata.json` | 仅 annotator | 难度分级、准入标准自查、埋点清单 |
| `rubric.json` | 仅 annotator | 机器可判定的评分规则 |
| `target_states.md` | 仅 annotator | 验收状态 A-F 的详细操作序列 |
| `reference-solution/` | 仅 annotator | 内部答案key，见下方说明 |
| `tests/` | 仅 annotator | 对应 `rubric.json` 的自动化检测脚本 |
| `sota-run.md` | 仅 annotator（产出物） | SOTA 跑完后记录执行轨迹 |
| `screenshots/` | 仅 annotator（产出物） | SOTA 跑完后按 `target_states.md` 截图 |
| `sota-submission/` | 仅 annotator（产出物） | 从跑 Codex CLI 的远程/隔离环境拉回本地的 agent 产出代码（即远程 `starter/` 的最终状态），用于本地复核、复测 `e2e-verify.mjs` 与截图取证 |

**打包给 Codex CLI 时的建议做法**：复制一份仅含 `task.md` / `starter/` / `mock-data/` / `assets/` 的目录（或用 `.gitignore`/传输白名单排除其余文件），再让 agent 在那份拷贝里工作，避免其读到答案或评分细节。

## 目录说明

- **`task.md`**：任务提示词。描述背景、5 个页面结构、全局 Lightbox 组件，以及 7 条彼此耦合的约束（筛选状态保持、灯箱导航范围限定、图片 CLS 防抖动、系列页复用数据模型、移动端响应式切换、离线字体、联系表单校验与反馈）。
- **`starter/`**：agent 的起点。一个可以直接 `npm install && npm run dev` 跑起来的最小 Vite+React+TS 项目——只有一个占位 `App.tsx`（`<h1>Photographer's Portfolio</h1>`）和基础 CSS reset，**没有**路由、没有页面、没有组件，也没有预置 `react-router-dom`。所有页面、组件、路由方案、状态管理都需要 agent 自己从 0 搭建。
- **`mock-data/`**：agent 必须原样渲染的真实内容数据：14 张真实照片，按分类存放于 `photos/<category>/`，以及结构化元数据 `photos.json`（分类、系列、每张照片的 id/标题/说明/尺寸）。
- **`assets/`**：仅为设计参考材料：6 张 AI 生成的参考图（`reference_*.png`）、字体规范（`FONTS.md`）、本地字体文件（`fonts/*.woff2`）。不是业务/内容数据。
- **`metadata.json`**：任务分类、难度分级、准入标准自查表，以及刻意埋点清单（`deliberate_traps`，对应架构设计中容易被忽略的 4 个陷阱）和对应的失效模式说明。
- **`rubric.json`**：可机器判定的评分规则（满分100，及格线80）。每条叶子节点对应一个 `grader_spec`（`playwright_assertion`/`dom_assertion`/`unit_test`/`screenshot_review`/`llm_judge`/`manual_review`），并通过 `constraint_ref` 关联回 `task.md` 中的具体约束。
- **`target_states.md`**：详细定义 rubric 中引用的 6 个验收状态（A-F），包含到达每个状态所需的具体操作序列。
- **`reference-solution/`**：内部正确实现（答案key），**不交给被测 agent**。是一个独立可运行的 Vite+React+TS 项目（自带 `package.json`/`react-router-dom`/`public/` 资源拷贝），完整实现了 `task.md` 的 7 条约束，用于验证 `rubric.json` 里的判定项是否真的可被一个正确实现满足。用法：`cd reference-solution && npm install && npm run build`（已验证可以干净构建通过）。
- **`tests/`**：与 `rubric.json` 中 `playwright_assertion`/`unit_test` 条目对应的自动化检测脚本，用于在 agent 完成后跑一遍验证。
- **`sota-run.md`**：用 SOTA coding agent（Codex CLI）跑完本任务包后产出：执行轨迹记录、哪些约束满足了、哪里失败了。
- **`screenshots/`**：SOTA 验证跑完后产出：按 `target_states.md` 每个验收状态截一张图（`sota_state_a.png` … `sota_state_f2.png`）。
- **`sota-submission/`**：从远程跑 Codex CLI 的机器上拉回本地的 agent 最终产出（对应远程 `starter/` 目录跑完后的状态，已排除 `node_modules/`/`dist/`/`tsconfig.tsbuildinfo`）。annotator 在本地对这份拷贝执行 `npm install && npm run build`、复跑 agent 自带的 `e2e-verify.mjs`，并额外编写 `annotator-verify.mjs` 覆盖 `rubric.json` 中 agent 自测脚本未覆盖的判定项。

## 数据来源说明

- 真实照片素材最初设想覆盖人像/风景/街拍三类，但实际素材池中没有任何街拍内容。分类已修正为**肖像 / 风光 / 牧野**以匹配真实内容——详见 `metadata.json` 中的 `annotator_notes.photo_category_note`。`task.md` 和 `rubric.json` 均已使用修正后的分类。
- `assets/` 与 `mock-data/` 按约定严格分离：`assets/` 只是视觉/设计参考，`mock-data/` 才是真实运行时内容。agent 不得混用二者（例如不能把 `reference_*.png` 当内容照片渲染，也不能把真实照片放进 `assets/`）。`task.md` 中已明确告知 agent 这两个目录在项目根部、与 `starter/` 同级，agent 需要自己决定如何在 `starter/` 项目里消费这些位于项目外部的数据（例如拷贝进 `public/`、配置 Vite 的 `server.fs.allow`，或使用别名引用）——这是一个合理的、任务相关的工程决策点，不是无关的干扰项。

## 启动方式

### starter（提交包中即最终实现）

```bash
cd starter
npm install
npm run dev      # 默认 http://localhost:5173
npm run build    # 生产构建验证
```

### reference-solution（仅 annotator 自查用，不在提交包内）

```bash
cd reference-solution
npm install
npm run dev    # 或 npm run build 做构建验证
```

## 测试方式

### 自动化评分套件（`tests/`，仅 annotator）

```bash
cd tests
npm install
npx playwright install chromium   # 首次运行需要
npm test                # 无头运行全部用例
npm run test:headed     # 有头模式，便于调试
npm run report          # 查看上一次运行的 HTML 报告
```

`playwright.config.ts` 已配置 `webServer`，会自动进入 `../starter`（或 `../sota-submission`，视目录布局而定）执行 `npm run dev` 拉起被测应用，测试结束后自动关闭；因此运行前不需要手动起服务，但需要先在被测应用目录下执行过一次 `npm install`。

### agent 自带验证脚本（`starter/e2e-verify.mjs`）

```bash
cd starter
node e2e-verify.mjs
```

这是 agent 在完成开发后自己编写并跑通的浏览器验证脚本，覆盖 `task.md` 「验证要求」一节列出的交互式约束；`starter/annotator-verify.mjs` 是 annotator 额外补充、覆盖 agent 自测脚本未覆盖判定项的验证脚本。

### 人工复核

`rubric.json` 中 `visual_fidelity`、`overall_impression` 两个分区的判定类型是 `screenshot_review`/`llm_judge`/`manual_review`，不在上述两类自动化脚本的覆盖范围内，需要人工或 LLM 评审对照 `target_states.md` 与 `screenshots/` 完成。

## 已知限制

**无后端**：联系表单的提交、发送中、成功态均为前端本地模拟（如 `setTimeout` 延时），不会真实发送邮件或持久化数据；`rubric.json` 的 `contact-form-states` 只判定前端交互状态。

