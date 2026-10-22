# DSH MD 阅读

在 DeepSeek Harness Desktop 中增加「MD 阅读」页面：左侧阅读 Markdown，右侧复用 DSH 原生聊天与输入区，每篇文档关联独立会话。

## 使用

在左侧导航点击「MD 阅读」，选择或拖入 `.md` / `.markdown` 文件。在正文中选中文字，点击浮动「提问」按钮，将原文引用放入右侧输入框，再填写问题并发送。也可直接询问全文。

全文由插件通过 DSH 必需的 user-role runtime context 接入，保留字面内容，不进行变量插值、摘要或截断。导入及阅读不调用模型。模型、推理、流式回答、停止、工具和权限使用 DSH 原有能力。文档和阅读位置保存在 DSH home 下的 `dsh-md-reader/documents/`，会话历史使用 DSH 原有存储。

第一版支持 UTF-8、单文件最多 2 MiB。全文按照 UTF-8 字节数加 32768 token 对话预留作保守窗口检查；超过当前模型窗口时拒绝模型请求，提示选择更大窗口或拆分文档。适配器没有窗口元数据时沿用 DSH 的原生限制。不会把局部内容标为全文。

## 安装

使用 DSH Desktop 管理的 CLI：

```powershell
& "$env:LOCALAPPDATA\Programs\DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd" plugin --profile desktop add "D:\Foreign_WorkBuddy\What_he_did\SmallTool\dsh-md-reader\dsh-md-reader-0.1.6.tgz"
```

安装后退出托盘中的 DSH 并重新启动。卸载使用 `plugin --profile desktop remove dsh-md-reader`；保留文档库和原生会话历史。

## 开发

```powershell
npm run build
npm test
npm pack
```

无需下载前端依赖，React 和 Markdown 渲染器使用 DSH 运行时。适配目标为本机 DSH 0.2.1-rc.2 / claude-style 0.16.2。插件只在阅读页内调整 Claude 的模型按钮和窄栏输入区，保留当前文档会话的真实模型及原生菜单。

## 验证

2026-10-22 在安装后的真实桌面端验证：16 项单元测试、8 组集成检查、原生控件边界检查通过。覆盖拖放/导入、目录、搜索、代码/公式/表格、相对图片、引用、独立草稿与历史、刷新恢复、亮暗主题及窄窗布局。

使用现有 DSH 模型 `deepseek-v4.1-flash-1017` 实际发送选区问题，最终回答正确引用正文后部的 `7.3 Gbit/s` 与末尾 `ORCHID-7319-K8M`，而选区本身不包含这些值；第二篇独立文档回答 `2.6 Gbit/s` 与 `CEDAR-2600-T9P`，未混入第一篇信息。已验证生成中停止、停止后继续发送。模型调用采用现有账号计费，仅使用合成测试文档。

详细契约和验证方法见 [docs/contracts.md](docs/contracts.md)。`test/installed-smoke.mjs` 与 `test/browser.mjs` 连接 `DSH_CDP`（默认本机 9237）；依赖旁边已有工程的 Playwright，仅为本机测试辅助，不随插件发布。`scripts/restart-test-desktop.ps1` 只管理指定隔离测试实例，不终止原来的 DSH。
