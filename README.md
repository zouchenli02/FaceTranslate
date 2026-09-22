# 同声 · FaceTranslate

手机优先的面对面中英翻译原型。零 npm 依赖，Node.js 22+。

## 启动

在项目目录执行：

```powershell
node --env-file-if-exists=.env server.mjs
```

本机打开 http://localhost:3100 。未配置密钥时为**有限示例演示模式**，不会对任意内容生成模拟译文。

## 接入真实翻译

进入有道智云控制台，创建 API 类型应用并绑定文本翻译服务，将应用 ID 和应用密钥分别填到下面配置。无需 Azure 账号。语音识别和播报仍使用浏览器能力，本次切换的是文本翻译环节。

复制 `.env.example` 为 `.env`，设置 有道的 `YOUDAO_APP_KEY`（应用 ID）和 `YOUDAO_APP_SECRET`（应用密钥），然后重启。密钥仅在服务端读取，不要提交 `.env`。

手机调试运行期间，填写好 `.env` 后执行 `./activate-translator.ps1`：先通过两句中英测试验证真实服务，再重启手机后端并验证 live 模式，保留原 HTTPS 地址和口令。测试会向你的有道服务发送这两句测试文字并计入服务用量。只测试不重启可运行 `node --env-file-if-exists=.env check-translator.mjs`。

官方接口文档：https://ai.youdao.com/DOCSIRMA/html/trans/api/wbfy/index.html

## 手机试用

### iPhone HTTPS 调试

在项目目录运行 `./start-mobile.ps1`。脚本启动仅监听本机 3101 的口令保护服务和 Cloudflare 临时 HTTPS 连接，不改变原来的 3100 端口。用 Safari 打开 `.debug/tunnel-error.log` 中的 `https://…trycloudflare.com` 地址，用户名为 `debug`，密码在 `.debug/password.txt`。允许麦克风后，展开页面底部“手机调试 · 环境与事件”查看环境和识别错误。

电脑和两个调试进程必须保持运行。执行 `./stop-mobile.ps1` 关闭连接。重启后 HTTPS 地址可能变化。口令只保存本机，不提交 Git；`.debug/` 和 `.tools/` 已忽略。HTTPS 请求通过 Cloudflare 转发。演示模式仍只翻译示例句，真实翻译需另配 `.env`。

首次配置需要从官方地址下载 cloudflared 到 `.tools/cloudflared.exe`：https://developers.cloudflare.com/tunnel/downloads/ 。这是临时调试入口，不是生产部署。若手机网络无法访问 trycloudflare.com，需要换可访问的网络或改用有域名的 HTTPS 托管。

默认只监听本机。可信局域网可设置 `HOST=0.0.0.0`，通过电脑 IP 和 3100 端口试用文字翻译。手机麦克风需要可信 HTTPS；普通局域网 HTTP 不能作为语音验收环境。部署前添加 HTTPS、用户鉴权、配额与限流，当前服务不可直接作为公共收费服务。

浏览器需支持 SpeechRecognition 或 webkitSpeechRecognition。语音服务可用性取决于浏览器、系统和网络；不支持时使用文字输入。语音识别可能将音频发送到浏览器厂商服务。播放由浏览器 speechSynthesis 提供，音色取决于设备。

## 已实现

- 中英双向、双方轮流发言，实时识别字幕，结束后整句翻译。
- 播报和重播、对面旋转阅读、原文纠错、文字输入。
- 请求失败保留文字，清空时取消请求并屏蔽迟到响应。
- 有道 v3 签名翻译适配器、12 秒服务超时、输入校验和错误脱敏。
- 会话仅在内存，服务端不写入音频或对话记录。

## 验证

```powershell
node --test
```

自动测试覆盖双向示例、输入验证、跨来源拒绝、密钥不泄漏、上游调用与异常。真实翻译需要有效密钥；真实麦克风、扬声器、权限拒绝和十轮面对面对话需在目标手机验收。

## 后续里程碑

1. 在 Android Chrome 和 iOS Safari 真机测试录音、播放、权限及 HTTPS，记录端到端延迟。
2. 用真实密钥跑固定中英样本，统计数字、人名、遗漏、增译和费用。
3. 接入独立流式语音服务，提供翻译草稿与稳定分句播报，替代浏览器识别依赖。
4. 增加服务鉴权、配额、监控和部署配置。
5. 根据真机结果决定采用原生或 Flutter 客户端；当前交付不含 APK/IPA、离线翻译或同时说话分离。
# FaceTranslate
