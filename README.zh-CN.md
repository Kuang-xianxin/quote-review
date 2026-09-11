# 报价核验 · Quote Review

[English](README.md) · [在线工作台](https://quote-review.loyal-lamb-5637.chatgpt.site/?lang=zh-CN) · [架构](docs/ARCHITECTURE.zh-CN.md) · [验证记录](docs/VALIDATION.zh-CN.md)

把供应商的 PDF、表格、邮件报价放在一起，核对原文与模型提取字段，修正错误后再比价。重点处理一个常见问题：**整箱报价和单件报价不能直接比较**。

这是人工核对工具。模型可能出错；系统不把未知币种、规格等价关系、运费、税费或汇率自动补成“最便宜供应商”。

## 体验完整流程

1. 新建比价组，上传脱敏报价，或点击“载入中英文样例”。
2. 后台实际调用本地模型；样例供应商为虚构数据，没有预置提取答案。
3. 对照原文逐项检查包装、币种、起订量及其单位。可以修正字段、补录遗漏商品；相同商品使用相同比价组。
4. 勾选已核对的商品，填写说明并保存，再比较每件价格、导出 CSV。

公开网页和数据库托管在云端；模型在运营者的电脑上运行。电脑离线时，页面和已保存结果仍可访问，新提取任务会排队等待。当前是容量有限的公开演示，不承诺全天候推理。请使用样例或脱敏文件。[资料说明](SECURITY.zh-CN.md)。

## 已实现的工程流程

- 中英文界面；读取文字 PDF、XLSX、CSV、TXT、纯文本 EML；真实本地 GGUF 模型推理。
- 云端 Worker API、D1 数据库和 R2 文件存储；本地使用同一 API 配合 SQLite、文件目录。
- 私有匿名会话、文件哈希去重、容量限制、持久任务队列。
- 带有效期的任务租约、取消、过期恢复、旧结果拒绝；文件解析使用独立进程。
- 原文引用、字段检查、人工修正、遗漏商品补录；版本冲突检测与修改记录。
- 相同比价组和币种内用十进制计算每件价格；导出时防止表格公式执行。

## 本地运行（已验证 Windows）

需要 Node 22.13+、Python 3.13。首次模型下载约 **2.50 GB**，另需依赖和运行时空间。实测电脑为 i5-12400、约 25 GB 内存，模型使用 4 个 CPU 线程。无需显卡、商业模型账号或付费 API Key；硬件、电力、存储和托管配额仍然有实际成本。

```powershell
npm ci
py -3.13 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r worker/requirements.txt
.\.venv\Scripts\python.exe worker/bootstrap.py
npm run build
npm start
```

另开终端，进入同一项目目录：

```powershell
.\.venv\Scripts\python.exe worker/run.py
```

打开 **http://127.0.0.1:8765**。服务端自动创建 `.data/worker-token`，计算节点读取它完成认证。开发前端时另运行 `npm run dev`。数据库、上传文件和认证令牌都在未纳入 Git 的 `.data` 中。

Linux/macOS 可使用同样的 Python 依赖和模型，安装适配平台的 `llama-server` 后通过 `--llama` 指定路径；这些平台的原生模型推理尚未实测。自动化 CI 验证不依赖模型的 API 和解析器路径。

## 验证与面试

```powershell
npm test
npm run typecheck
npm run lint
.\.venv\Scripts\python.exe -m unittest discover -s worker -p test_parse.py
.\.venv\Scripts\python.exe worker/benchmark.py
npm run build
```

模型回归脚本会实际加载权重，保存预期字段、实际输出、错误和耗时。少量合成样例不能代表真实采购准确率；失败基线也保存在 [验证数据](docs/validation/) 中。[中文面试讲解](docs/INTERVIEW.zh-CN.md)。

## 当前边界

仅支持文字 PDF（最多 10 页）；暂不支持扫描 OCR、图片、XLS、公式单元格、复杂 PDF 表格版式还原、团队账号、自动规格匹配、汇率换算、运费分摊和下单。每份文件最多 500 KB，解析文本也有限额，复杂文件可能被拒绝。私有结果通过当前浏览器 Cookie 访问，7 天后会话失效；计算节点下一次取任务时清理过期资料。可以主动删除整个比价组。

欢迎提交**脱敏后仍能复现错误的报价样例**，标明原文位置和正确字段。不要在公开 issue 上传真实供应商或客户资料。[贡献指南](CONTRIBUTING.zh-CN.md)。

应用代码使用 MIT 许可；模型和运行时分别遵循其原有许可，见 [第三方说明](THIRD_PARTY_NOTICES.md)。仓库最初是静态故障排查原型，旧版本保留在 Git 历史中；当前版本已改为采购报价核验。
