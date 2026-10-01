# Lin Ye Studio — 离线巡展作品站

一个从空工作区搭建的**纯静态、可完全离线运行**的摄影作品站。摄影师把巡展底稿带到断网场地选片、排序；
回到站点后，断网改动按**照片基线（three-way merge）**与对端目录合并，双方都改过同一张照片时
保留双方候选由人选；合并失败回退到底稿重试；确认合并后系列封面、灯箱顺序和筛选结果集一起重算。

## 运行

```bash
npm run build          # 扫描 public/ 生成 sw.js 预缓存清单（仓库内已生成一次）
npm start              # http://127.0.0.1:8901 （等价于 python3 -m http.server）
```

> 必须通过 HTTP 打开（ESM / Service Worker 需要），不要用 `file://`。

## 页面（共用同一份照片数据）

| 页面 | 说明 |
|---|---|
| `index.html` | 首页：统计、各系列当前选中作品与封面（封面即派生数据） |
| `works.html` | 作品：分类/系列/仅选中筛选，**筛选范围持久化**，离开再返回保留；灯箱只走当前结果集 |
| `series.html` | 系列：封面按"系列顺序中第一张选中照片"派生，可离线调整系列顺序；**同步面板**也在此页 |
| `about.html` | 工作流说明 |
| `contact.html` | 联系：内联校验反馈；断网时消息入队，恢复在线自动发出 |

五页都从 `store.js` 持有的同一个 catalog 读取。

## 数据与合并模型

```
public/data/baseline.json       巡展底稿（base，"原底稿"）
public/data/remote.json         回站后拉到的对端目录（含双方分歧）
public/data/remote-broken.json  结构损坏的对端目录（演示合并失败 → 回退 → 重试）
```

合并引擎 `public/js/app/merge.js` 是纯函数，可直接被 Node 单测引用：

- **每张照片按字段独立三方合并**（selected / title / caption / altText）
  - 仅一方改动 → 自动快进（不会再覆盖同一张照片的另一份改动）
  - 双方改成相同值 → 自动采用
  - 双方改成不同值 → 生成**候选**（local / remote 两个卡片），逐字段（或整条序列）由人选择
- **顺序也是三方合并**：系列内照片序列、顶层系列序列都按"每个元素的前驱 id"比较；
  一方移动自动采用，双方移动到不同位置 → 整条序列作为候选二选一
- **结构性校验**：缺照片、照片指向不同文件、跨系列移动、系列成员不一致 → 抛 `MergeError`，
  store 丢弃全部中间结果，把工作副本恢复成原底稿，等待从该基线重试
- **确认提交后**：base 与工作副本同时前进为合并结果；`normalizeOrders` 连续重排；
  封面、灯箱顺序、结果集都从同一目录由 `selectors.js` 重新派生

### 同步面板操作路径（series.html）

1. 勾选 *Simulate disconnected venue* → 所有对端拉取失败（也可点 "Retry while network down"）
2. 在 Works / Series 做离线选片、调顺序（改动写入 localStorage，不依赖网络）
3. 回到在线 → **Fetch station catalog → Merge on photo baseline**
4. 有候选时逐张选择；未选全时 Confirm 禁用
5. **Confirm merge & recompute** → 封面 / 灯箱顺序 / 结果集一次重算
6. "Fetch corrupted catalog" 后合并 → 看到回退提示，再正常拉取即可从底稿重试
7. *Restore original draft* 清空全部本地状态，回到最初底稿

## 离线保障

- `sw.js`（由 `scripts/gen-sw.mjs` 生成）预缓存全部页面、脚本、3 个本地字体、14 张 JPEG 与 baseline；
  cache-first + 后台更新；`data/remote*` **不缓存**，保证"同步必须等网络"语义真实
- 字体全部本地托管（`public/fonts/`，Playfair Display + Inter，遵循 `assets/FONTS.md`，
  无任何 Google Fonts 外链）；中文照片元数据走系统 CJK 回退
- 图片用真实 `width/height` 生成 aspect-ratio 占位盒，解码前不跳动
- 手机宽度（≤600px）照片/系列网格降为单列，灯箱按钮与表单同步适配

## 测试

```bash
npm test                 # Node 三方合并单测（快进/双方同改/同值/结构失败/候选确认重算）
npm run test:e2e         # Playwright 端到端 34 项（需先 npm start）
```

E2E 覆盖：跨页保留筛选范围、灯箱不越出结果集、离线编辑、完整候选→确认→派生重算、
拉取失败与结构失败回退到底稿后可重试、表单校验与离线队列、手机单列、全站零控制台错误、
断网后 SW 仍能打开全部页面而 remote 数据被真实阻断。

## 目录

```
public/
  css/styles.css
  data/                baseline / remote / remote-broken
  fonts/               本地 woff2
  photos/              14 张作品 JPEG
  js/app/              merge.js（纯合并） selectors.js（派生） store.js（状态/持久化/同步）
  js/ui/               chrome / filterbar / photo-grid / lightbox / sync-panel
  js/pages/            五个页面对应入口
  icons/ manifest.webmanifest sw.js
scripts/gen-sw.mjs
test/                  merge.test.mjs（单测） e2e.mjs（端到端）
```
