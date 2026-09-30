# tests/ — 标准化验收测试套件

这套 Playwright 测试是 `rubric.json` 里 `requires_browser_verification: true`、且
`grader_spec.type` 为 `playwright_assertion` / `unit_test` 的判定项的**可重复运行实现**。
它独立于被测 agent 自己编写的验证脚本（如 `sota-submission/e2e-verify.mjs`），也独立于
一次性编写的 `sota-submission/annotator-verify.mjs`，目的是把这次人工复核用到的验证逻辑
固化成任务包自带的标准检测脚本，供以后每一批新的提交复用，而不用每次现场手写。

## 用法

```bash
cd tests
npm install
npx playwright install chromium   # 首次运行需要
npm test                          # 无头运行全部用例
npm run test:headed               # 有头模式，便于调试
npm run report                    # 查看上一次运行的 HTML 报告
```

`playwright.config.ts` 里配置了 `webServer`：会自动 `cd ../sota-submission && npm run dev`
拉起被测提交的开发服务器（若已有服务器在 5173 端口运行则直接复用），测试结束后自动关闭。
因此运行前**不需要**手动 `npm run dev`，但需要先在 `sota-submission/` 下执行过一次
`npm install`。

## 目录结构

```
tests/
├── playwright.config.ts      # baseURL、自动拉起 dev server、viewport 等全局配置
├── helpers/
│   ├── photoData.ts          # 读取 mock-data/photos.json，派生按分类/系列筛选的期望结果
│   └── lightbox.ts           # 灯箱组件的选择器与交互封装（打开/关闭/上一张/下一张/读计数器）
└── e2e/
    ├── structural-baseline.spec.ts   # routes-render / lightbox-shared-component / filter-ui-exists
    ├── content-integrity.spec.ts     # photo-data-fidelity / no-cross-contamination
    └── coupled-constraints.spec.ts   # task.md 约束 #1-7（含 4 个陷阱约束）
```

`visual_fidelity`（截图人工比对）、`overall_impression`（整体印象）两个 rubric 分区的判定
类型是 `screenshot_review` / `llm_judge` / `manual_review`，不适合自动化，本套件不覆盖，
仍需 annotator 对照 `assets/reference_*.png` 人工完成。

## 关于 `lightbox-shared-component` 用例

`structural-baseline.spec.ts` 中该用例会依次从 `/work` 网格、系列详情页、首页精选预览图
三个入口打开灯箱。**对照本次已拉回的 `sota-submission/` 运行，第三步（首页入口）会失败**——
这不是测试写错，而是如实复现了 `sota-run.md` §4.1 记录的真实缺陷：首页精选卡片用
`<Link>` 直接跳转到系列详情页，没有接入共享的 `openLightbox()`。保留这个失败用例，
而不是弱化断言去让它"变绿"，正是这套标准化测试套件存在的意义——遇到不同批次的提交时，
它应该如实反映每一份提交自己的真实完成度，而不是抄agent自己验证脚本的覆盖盲区。
