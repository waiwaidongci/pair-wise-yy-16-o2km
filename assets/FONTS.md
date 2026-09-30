# 字体规范

字体已**本地化托管**，不依赖 Google Fonts CDN，确保项目在无网络环境下也能正常显示字体（这是本任务的强制要求之一，agent 不得改回外链引入）。

- 标题字体：`Playfair Display`（衬线，字重 600，用于姓名/页面标题/系列标题）
- 正文字体：`Inter`（无衬线，可变字体，覆盖 400/500/600 字重，用于正文、导航、表单、说明文字）
- 引用/强调文本：`Playfair Display Italic`（字重 400，用于系列详情页的 pull-quote）

## 字体文件

位于 `assets/fonts/`，来源为 Google Fonts 官方 CDN（`fonts.gstatic.com`），OFL 开源许可，已下载为静态文件，构建时需拷贝到 `starter/public/fonts/`（或等价的静态资源目录）一并打包：

| 文件 | font-family | style | weight |
|---|---|---|---|
| `inter-400-600.woff2` | Inter | normal | 400 / 500 / 600（可变字体单文件覆盖三档字重） |
| `playfair-display-600.woff2` | Playfair Display | normal | 600 |
| `playfair-display-italic-400.woff2` | Playfair Display | italic | 400 |

## 引入方式（本地 @font-face）

```css
@font-face {
  font-family: "Inter";
  font-style: normal;
  font-weight: 400 600;
  font-display: swap;
  src: url("/fonts/inter-400-600.woff2") format("woff2");
}

@font-face {
  font-family: "Playfair Display";
  font-style: normal;
  font-weight: 600;
  font-display: swap;
  src: url("/fonts/playfair-display-600.woff2") format("woff2");
}

@font-face {
  font-family: "Playfair Display";
  font-style: italic;
  font-weight: 400;
  font-display: swap;
  src: url("/fonts/playfair-display-italic-400.woff2") format("woff2");
}
```

Fallback 字体栈：
```css
--font-heading: "Playfair Display", Georgia, serif;
--font-body: "Inter", -apple-system, sans-serif;
```

**注意**：`Inter` 只覆盖了 latin 字符集（不含中文/西里尔/希腊等扩展子集），因为本项目页面文案为英文。若后续内容改为中文，需要额外补充中文字体文件。
