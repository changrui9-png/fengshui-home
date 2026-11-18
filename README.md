# 家宅笔记 fengshui-home

根据业主的连续叙述、草图、照片或旁白，整理一张可以修改的二维住宅示意图，核对房间朝向，并把传统风水的文化解读和采光、通风、动线、噪声、隐私分开写。

这是第一版。它不预测健康或财富，不打运气分数，也不在证据不够时编造房间、尺寸和家具。

## 没有密钥时已经能用

不配置任何模型密钥时，下面这些功能都可以用：

- 载入标明为虚构的示例，或从空白平面开始
- 手绘、移动、缩放和旋转房间与家具，添加或删除门、窗、床、沙发、书桌、餐桌、灶、水槽、镜子、马桶
- 把户型照片当作本机底图。照片不会被识别，也不会上传
- 按句式摘录旁白文字。这一步会标明「不是视觉模型」
- 在浏览器里从视频抽出关键帧。帧只留在本机
- 导入本项目的 JSON，或导入 [video-to-3d](https://github.com/Srijjit-V/video-to-3d) 的 `scene.json`
- 电梯追问、规则评估、SVG / PNG / JSON 导出，以及用浏览器打印成 PDF

界面会写明：**自动视频解读尚未配置，当前没有分析视频。** 程序不会把未发送的画面说成已经分析。

## 真正的视频解读需要什么

在运行本仓库服务器的机器上设置环境变量，不要把密钥写进前端或提交到 Git：

```bash
cp .env.example .env
```

| 变量 | 作用 |
| --- | --- |
| `AI_PROVIDER` | `openai`、`gemini` 或 `openai-compatible` |
| `AI_API_KEY` | 只放在服务器上 |
| `AI_MODEL` | 例如 `gpt-4o-mini` 或 `gemini-2.0-flash` |
| `AI_BASE_URL` | 仅兼容接口需要，必须是 https，且路径以 `/chat/completions` 结尾 |
| `AI_ALLOWED_HOSTS` | 允许的主机名。请求不跟随重定向 |
| `AI_MAX_REQUESTS_PER_HOUR` | 每小时次数上限，默认 6 |

配置好之后，业主要先勾选同意，服务器才把最多 4 张关键帧和文字发到名单里的主机。返回值只当作待确认假设：没有原文或「画面」依据的房间会被丢掉，尺寸一律不采用。

本仓库没有、也不能使用某位用户在 Cursor 里的订阅去调用这些接口。密钥要由运行服务器的人自己提供。

## 本地运行

需要 Node.js 22。

```bash
npm ci
npm test
npm run typecheck
npm run dev
```

开发时打开 <http://127.0.0.1:5173> 。接口在 8787，由 Vite 代理。

```bash
npm run build
npm start
```

生产模式在 `PORT`（默认 8787）同时提供页面和 `/api/health`、`/api/analyze`。

## 文档

- [使用](docs/使用.md)
- [架构](docs/架构.md)
- [隐私与安全](docs/隐私与安全.md)
- [局限](docs/局限.md)
- [许可与来源](docs/许可与来源.md)
- [部署](docs/部署.md)

## 界面

示例数据的桌面与手机截图在 [docs/screenshots](docs/screenshots)。本地服务运行后，可用 `node scripts/screenshot.mjs` 重拍（需要本机 Chrome）。

## 许可

应用代码为 [MIT](LICENSE)。第三方和文献见 [NOTICE.md](NOTICE.md) 与 [许可与来源](docs/许可与来源.md)。
