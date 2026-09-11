<p align="center"><img src="public/favicon.svg" width="58" alt="Incident Weave" /></p>
<h1 align="center">Incident Weave</h1>
<p align="center"><strong>出了故障？让证据指引排查。</strong><br/>在本机运行的 AI 应用故障排查工作台。无需 API 密钥，无需订阅。</p>

**简体中文** · [English](README.md)

[中文在线体验](https://incident-weave.loyal-lamb-5637.chatgpt.site/?lang=zh-CN) · [English demo](https://incident-weave.loyal-lamb-5637.chatgpt.site/?lang=en) · [面试讲解](docs/INTERVIEW.zh-CN.md) · [架构说明](docs/ARCHITECTURE.zh-CN.md) · [验证与局限](docs/VALIDATION.zh-CN.md)

Agent 已超时，后台任务却仍在运行；搜索工具返回成功，实际没有上下文；重试循环忽略 `Retry-After`。排查这些问题需要能追溯到原始日志的证据。

本项目把日志和操作手册整理为**有来源的观察结果、可检查的原文引用和具体的下一步检查**。用户还可以主动下载开放小模型，在专用浏览器 Worker 中生成未确认的假设。每条模型引用都会与它实际收到的证据核对。

## 一分钟体验

1. 打开中文工作台。右上角可随时切换 **中文 / English**。
2. 选择 **重试风暴**、**缺失的答案**或**没有停下的任务**。
3. 点击 **开始排查**，点击 `E0001` 等引用查看原文和行号。
4. 导出当前语言的 Markdown 报告或 JSON 数据。
5. 可选：打开 **本地 AI**，主动下载模型并运行。基础分析不需要模型。

案例明确标注为合成数据。可以导入自己的 `.log`、`.txt`、`.md`、`.json`、`.jsonl` 或 `.csv` 文件；JSON/CSV 在当前版本按逐行文本处理，没有完整遥测结构解析。Markdown 文件被视为参考资料，不会作为已发生的运行事件。

语言优先级为链接中的 `?lang=zh-CN` / `?lang=en`、本机语言偏好、浏览器语言，最后默认英文。切换语言会保留正在编辑的问题、证据和已有报告；重新选择案例可加载对应语言的问题和手册，示例运行日志始终保留原文。模型按运行时选择的语言生成；已有输出不自动翻译，小模型也不保证始终遵循语言要求。

## 已实现能力

| 能力           | 实际行为                                                         |
| -------------- | ---------------------------------------------------------------- |
| 证据导入       | 最多 12 个文件、256 KB、2,500 行；稳定的来源与物理行号           |
| 本地脱敏       | 检索、推理和导出前，尽力识别凭证与邮箱并遮盖                     |
| 检索           | BM25、英文词项和中文二元词组、来源多样性，无外部索引             |
| 诊断规则       | 限流、零等待重试、连接池耗尽、超时、取消、空检索、解析和上游错误 |
| 事件关联       | 仅在来源一致、trace 编号相同、ISO 时间更晚时报告取消后仍有活动   |
| 可选本地 AI    | 专用 Web Worker 中通过 WebGPU 运行开放的 0.5B 模型               |
| 引用校验       | 拒绝未知编号、改写引文、格式错误和检测到的指令式证据             |
| 任务取消       | 终止本次运行拥有的 Worker，保留已完成的证据报告                  |
| 共用分析核心   | 网页、CLI、案例评估和可选 WebMCP 工具使用同一实现                |
| 双语报告与历史 | 中英文 Markdown/JSON；可选在本机保存最多五份脱敏报告             |

**引用校验只证明来源和引文匹配，不证明结论真实或因果成立。** 模型建议始终是未确认假设。工具不会自动修复、宣称已确认根因或认证服务健康。

## 本地运行

需要 Node.js 22.13+ 和 npm。

```sh
git clone https://github.com/Kuang-xianxin/incident-weave.git
cd incident-weave
npm ci
npm run dev
```

打开终端显示的本地网址。无需数据库、账户、API 密钥或环境密钥。

```sh
npm test
npm run typecheck
npm run eval
npm run build
npm run start
```

构建生成静态目录 `dist/`，使用 HTTPS 或 localhost 提供访问即可。静态托管支持构建时设置路径前缀 `VITE_BASE_PATH=/incident-weave/`。`.openai/hosting.json` 标识本项目的在线演示；注册自己的 Sites 项目时需要替换其中的 `project_id`。普通静态托管无需该文件。

### 命令行排查

```sh
npm run investigate -- samples/retry-storm.log samples/retry-storm.md --lang zh-CN
npm run investigate -- samples/cancel-leak.log --question "取消后发生了什么？" --lang zh-CN --json
npm run investigate -- samples/retry-storm.log --lang en
```

CLI 默认英文，只读取显式指定的文件，不发送网络请求。报告叙述可选择语言，JSON 的字段名、证据、编号和引文保持原样。错误堆栈或第三方运行诊断可能保留英文。当前版本的本地模型推理是浏览器功能。

## 本地 AI 的资源要求

可选模型为 `Qwen2.5-0.5B-Instruct-q4f32_1-MLC`，通过 WebLLM 加载。按运行时模型目录，它需要 WebGPU、约 1.1 GB 可用显存，首次下载数百 MB 模型文件。运行文件和模型来自其公开托管方；证据不会提交给它们。浏览器可缓存文件，但缓存行为由浏览器管理。

没有按次 API 费用，推理仍会使用访问者的硬件、电力、带宽和存储。不支持 WebGPU 的设备仍可使用确定性分析和导出。小模型仅用于提出假设，不应视为专业事故调查员。参见[运行时文档](https://webllm.mlc.ai/docs/user/basic_usage.html)和[模型目录](https://github.com/mlc-ai/web-llm/blob/main/src/config.ts)。

## 工程边界

- 没有付费 API、证据上传接口、遥测 SDK 或托管模型服务。应用和模型文件下载仍会访问托管方，托管方可能保留普通访问日志。
- 脱敏和指令式内容隔离依赖有限规则，无法保证识别全部风险。
- 没有语义蕴含判别器；模型可能引用真实文本却得出错误结论。
- 没有后端持久化任务、任意命令执行、自动修复或实时观测平台接入。
- 内置评估验证确定性行为和引用校验，**不代表模型准确率**。
- 真实 WebGPU 推理、跨浏览器 GPU 行为和模型中英文生成质量尚未完成验证。

## 参与贡献

欢迎提供“当前规则产生误导结果或遗漏有用线索”的最小合成案例。请阅读[贡献指南](CONTRIBUTING.zh-CN.md)和[隐私与安全边界](SECURITY.zh-CN.md)，不要在公开 issue 中上传私人日志或密钥。

项目原创代码采用 MIT 许可，第三方 UI、构建代码、模型和运行时分别保留其许可，详见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
