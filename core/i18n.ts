/** Product copy only. Never translate evidence, user input, or generated claims. */
export type Locale = "en" | "zh-CN";
export const LANGUAGE_KEY = "incident-weave-language-v1";
export function resolveLocale(
  search = "",
  saved?: string | null,
  languages: readonly string[] = [],
): Locale {
  const explicit = new URLSearchParams(search).get("lang");
  for (const value of [explicit, saved, ...languages]) {
    if (value === "zh" || value?.toLowerCase().startsWith("zh-"))
      return "zh-CN";
    if (value === "en" || value?.toLowerCase().startsWith("en-")) return "en";
  }
  return "en";
}

export const zh: Record<string, string> = {
  "Runs on your device": "在你的设备上运行",
  Source: "开源代码",
  "LOCAL INTELLIGENCE. TRACEABLE ANSWERS.": "本地分析，证据可追溯。",
  "Something broke.": "出了故障？",
  "Follow the evidence.": "让证据指引排查。",
  "Turn scattered logs into a clear investigation. Connect the signals, inspect every citation, and decide what to check next.":
    "从零散日志梳理故障线索，查看每条引用的原文，明确下一步该查什么。",
  "No evidence uploads": "证据无需上传",
  "No API bill": "没有 API 费用",
  "Traceable citations": "引用可追溯",
  "Runtime logs": "运行日志",
  "Tool traces": "工具调用记录",
  Runbook: "操作手册",
  "One evidence trail.": "串起完整证据。",
  "YOUR EVIDENCE. YOUR DEVICE.": "你的证据，在你的设备上处理。",
  "The incident workbench": "故障排查工作台",
  "Free & open source": "免费开源",
  "TRY A SYNTHETIC CASE": "试用合成案例",
  "Your own evidence": "使用自己的证据",
  "Analysis runs here. Logs never go to our server. Local AI downloads model files only when you ask.":
    "分析在本机进行，日志不会上传到我们的服务器。只有你主动启用本地 AI 时才会下载模型。",
  "Run fixture evaluation": "运行案例评估",
  "SAVED ON THIS DEVICE": "本机保存的报告",
  "Clear saved reports": "清除已保存报告",
  "Clear reports saved on this device?": "清除这台设备保存的报告？",
  "Your current investigation and exported files stay available. The saved history will be removed from this browser.":
    "当前排查结果和已导出的文件仍然可用。此操作会删除当前浏览器保存的历史报告。",
  "Keep reports": "保留报告",
  "Clear history": "清除历史",
  "Evidence bundle": "证据材料",
  "Import files": "导入文件",
  "Import local evidence files": "导入本地证据文件",
  "What are you investigating?": "你想排查什么问题？",
  lines: "行",
  "Evidence analysis · deterministic, no LLM":
    "证据分析 · 确定性规则，无需大模型",
  "Keep redacted reports on this device (up to 5)":
    "在本机保存脱敏报告（最多 5 份）",
  "Dismiss message": "关闭提示",
  "Investigation report": "排查报告",
  "EVIDENCE BEFORE EXPLANATIONS": "先看证据，再作解释",
  "observations. A clearer next step.": "项观察，帮助明确下一步。",
  "evidence lines ·": "行证据 ·",
  "retrieved ·": "行检索结果 ·",
  "redactions ·": "处脱敏 ·",
  Observations: "观察结果",
  "Local AI": "本地 AI",
  "Run trace": "分析过程",
  "Rule-based signals from your logs. They establish observations, not a confirmed root cause.":
    "这些结果来自日志规则匹配，只建立已观察到的现象，尚不能确认根因。",
  "Source-linked": "已关联原文",
  "NEXT CHECK": "下一步检查",
  "A second pair of eyes.": "多一个分析视角。",
  "On your own device.": "依然在本机运行。",
  "An optional small language model can propose hypotheses using the retrieved evidence. No API key, account, or per-request fee.":
    "可选的小语言模型会根据检索证据提出排查假设。无需 API 密钥、账户或按次付费。",
  "Each quote is checked against its source. A matching quote does not prove the hypothesis is correct.":
    "每条引文都会与来源核对。引用匹配不代表假设正确。",
  "Run AI on this device": "在本机运行 AI",
  "Downloads an open model from Hugging Face and its runtime files. Your evidence is processed locally and is not sent to a model API.":
    "将从 Hugging Face 下载开放模型及所需运行文件。证据在本机处理，不会发送到模型 API。",
  "Model:": "模型：",
  "Qwen2.5 0.5B Instruct, 4-bit.": "Qwen2.5 0.5B Instruct，4 位量化。",
  "Requirements:": "运行要求：",
  "WebGPU and roughly 1.1 GB of available GPU memory. The initial model download is several hundred MB and may take a few minutes.":
    "需要 WebGPU 和约 1.1 GB 可用显存。首次下载模型需要数百 MB 流量，可能耗时数分钟。",
  "Limits:": "能力边界：",
  "Small models can miss causes or produce incorrect hypotheses. Treat suggestions as leads for investigation.":
    "小模型可能遗漏原因或提出错误假设，请把建议作为进一步排查的线索。",
  "Download & run locally": "下载并在本机运行",
  "Cancel local AI": "取消本地 AI",
  "seconds including initialization": "秒（含初始化）",
  "No hypothesis passed citation validation. The observations above remain available.":
    "没有假设通过引用校验，上方观察结果仍然可用。",
  "Unconfirmed hypothesis": "未确认的假设",
  "Actual stages of this run. Timings are measured locally; no simulated progress or model calls.":
    "展示本次实际执行的分析阶段。耗时在本机测量，没有模拟进度或模型调用。",
  "Input limits: 256 KB · 2,500 lines · 12 sources. SHA-256 fingerprints the redacted evidence and question, not the identity of its author.":
    "输入上限：256 KB · 2,500 行 · 12 个来源。SHA-256 标识脱敏后的证据和问题，不能验证作者身份。",
  "evidence limitations": "项证据局限",
  "Inspect the source": "查看原始证据",
  "Exact redacted input. A citation match verifies this text exists; it does not verify the statement is true.":
    "这里保留脱敏后的原文。引用匹配只证明文本存在，不能证明其中的陈述属实。",
  "RETRIEVED EVIDENCE": "检索到的证据",
  "No query matches. Add more relevant evidence.":
    "没有匹配查询的证据，请补充相关材料。",
  "A useful answer starts with a trace.": "有效排查，从一条记录开始。",
  "Choose a case or import your own evidence, then start an investigation.":
    "选择一个案例或导入自己的证据，然后开始排查。",
  "Built for the moment after “it failed.”": "从“出错了”走向可验证的排查。",
  "Interview guide": "面试讲解",
  "How it works": "实现原理",
  "MIT · No keys · No subscription": "MIT 开源 · 无需密钥 · 无需订阅",
  Close: "关闭",
  "Inspect evidence {id}": "查看证据 {id}",
  "Edit {name}": "编辑 {name}",
  "Paste the relevant runbook or operational notes…":
    "粘贴相关操作手册或运维说明……",
  "Paste timestamped logs, JSONL traces, or a failure transcript…":
    "粘贴带时间戳的日志、JSONL 追踪或故障记录……",
  "Reference material · not runtime evidence": "参考资料 · 不作为实际运行证据",
  "Runtime evidence · treated as untrusted data": "运行证据 · 按不可信输入处理",
  "Analyzing…": "分析中……",
  Investigate: "开始排查",
  "Run local AI again": "再次运行本地 AI",
  "Enable local AI": "启用本地 AI",
  "The retry storm": "重试风暴",
  "A support agent hits a rate limit.": "客服 Agent 遇到请求限流。",
  "The missing answer": "缺失的答案",
  "The search tool succeeds with no context.":
    "搜索工具返回成功，却没有上下文。",
  "The task that stayed": "没有停下的任务",
  "The user cancels. The worker carries on.": "用户取消后，后台任务仍在运行。",
  "What failed, and what evidence should I check next?":
    "发生了什么故障？下一步应该检查哪些证据？",
  "An investigation is already running. Cancel it first.":
    "已有排查任务正在运行，请先取消。",
  "An investigation is already running.": "已有排查任务正在运行。",
  "Investigation superseded.": "该次排查已被新的操作替代。",
  "Analysis completed. Browser storage is unavailable or full; export the report to keep it.":
    "分析已完成，但浏览器存储不可用或已满。请导出报告保存。",
  "Analysis failed.": "分析失败。",
  "Import up to 12 text files, 256 KB total.":
    "最多导入 12 个文本文件，总大小不超过 256 KB。",
  "Supported files: .log, .txt, .md, .json, .jsonl, .csv.":
    "支持的文件格式：.log、.txt、.md、.json、.jsonl、.csv。",
  "Could not read files.": "无法读取文件。",
  "This browser has no WebGPU. Evidence analysis and exports still work. Try a recent desktop browser with WebGPU enabled.":
    "当前浏览器不支持 WebGPU。证据分析和导出仍可使用；本地 AI 需要启用 WebGPU 的新版桌面浏览器。",
  "Starting the local model worker…": "正在启动本地模型任务……",
  "Local AI could not run.": "本地 AI 运行失败。",
  "Running the built-in fixture evaluation…": "正在运行内置案例评估……",
  "{passed}/{total} fixture checks passed · {ms} ms. This tests deterministic diagnostics and citation rejection, not model reasoning quality.":
    "案例检查通过 {passed}/{total} 项 · {ms} 毫秒。此评估验证确定性诊断和引用拒绝机制，不衡量模型推理质量。",
  "Evaluation failed. See the test suite in the source repository.":
    "评估失败，请查看源码仓库中的测试。",
  "Browser storage could not be cleared.": "无法清除浏览器存储。",
  "Model ready. Generating hypotheses on your device…":
    "模型已就绪，正在本机生成假设……",
  "Loading the model on this device…": "正在本机加载模型……",
  "Runtime details": "运行详情（原文）",
  "Generated hypotheses keep their original language. Run local AI again to request the current language.":
    "已生成的假设保留原语言。再次运行本地 AI 可请求使用当前语言生成。",
  "Local AI exceeded its 10-minute download and generation budget. Evidence analysis is preserved.":
    "本地 AI 下载和生成超过 10 分钟预算，证据分析结果已保留。",
  "The local model worker failed. Check WebGPU support and available memory.":
    "本地模型任务失败，请检查 WebGPU 支持和可用显存。",
  "The local model returned invalid JSON. No unverified hypotheses were added.":
    "本地模型返回了无效 JSON，没有添加未经验证的假设。",
  "Local AI cancelled; your evidence report is unchanged.":
    "本地 AI 已取消，证据报告保持不变。",
  "Local inference failed.": "本地推理失败。",
  "Provide 1–{count} sources.": "请提供 1–{count} 个证据来源。",
  "Question must contain 1–{count} characters.":
    "问题长度须为 1–{count} 个字符。",
  "Each source needs a short name and text.": "每个来源都需要简短名称和文本。",
  "Evidence exceeds the 256 KB limit. Narrow the incident window.":
    "证据超过 256 KB 上限，请缩小故障时间范围。",
  "Evidence exceeds 2,500 lines. Narrow the incident window.":
    "证据超过 2,500 行上限，请缩小故障时间范围。",
  "Source names must be unique within an evidence bundle.":
    "同一批证据中的来源名称不能重复。",
  "Source kind must be log or runbook.":
    "来源类型必须为 log（日志）或 runbook（手册）。",
  "Line {line} in {name} exceeds 2,000 characters.":
    "{name} 的第 {line} 行超过 2,000 个字符。",
  "Instruction-like evidence quarantined: {source}. Detection is best effort.":
    "已隔离疑似指令式证据：{source}。此检测无法保证识别全部风险。",
  "Add at least one non-empty evidence line.": "请至少添加一行非空证据。",
  "{count} possible credentials or email addresses redacted. Review before exporting; detection is not exhaustive.":
    "已脱敏 {count} 处疑似凭证或邮箱。检测并不完备，导出前请自行核查。",
  "The provider returned a rate limit": "服务提供方返回了限流响应",
  "The logs contain rate-limit responses. This is an observed symptom, not proof of the reason for the limit.":
    "日志出现限流响应。这是已经观察到的现象，尚不能证明触发限流的原因。",
  "Compare Retry-After, concurrency, and account quota at the same timestamp.":
    "核对同一时刻的 Retry-After、并发量和账户配额。",
  "Retries were scheduled without a delay": "重试没有设置等待间隔",
  "At least one retry explicitly records a zero delay. Check whether it belongs to the rate-limited request before inferring a retry storm.":
    "至少一条重试记录明确显示等待时间为零。判断是否存在重试风暴前，先确认它是否属于被限流的请求。",
  "Match request or trace IDs, then verify bounded exponential backoff and Retry-After handling.":
    "匹配请求或 trace 编号，再检查有界指数退避以及 Retry-After 的处理。",
  "Connection capacity was exhausted": "连接容量出现耗尽迹象",
  "A connection-pool limit or exhaustion message is present. A leak, burst, and slow dependency are still competing explanations.":
    "日志中出现连接池上限或耗尽信息。连接泄漏、流量突增和依赖变慢仍是需要区分的可能原因。",
  "Compare active, idle and waiting connections; check release paths on cancellation.":
    "比较活动、空闲和等待连接数量，检查取消时的连接释放路径。",
  "A deadline or timeout was recorded": "记录到了超时或截止时间超限",
  "The request exceeded a waiting limit. These lines alone do not establish whether its background work stopped.":
    "请求超过了等待上限，仅凭这些记录无法判断后台工作是否停止。",
  "Find terminal events for the same trace after the timeout, and distinguish waiter cancellation from task ownership.":
    "查找同一 trace 在超时后的终止事件，并区分等待者取消与底层任务所有权。",
  "Cancellation was requested or observed": "记录到了取消请求或取消事件",
  "Cancellation appears in the trace. Verify actual completion separately; a cancellation request is not a completed cleanup.":
    "追踪记录中出现取消信息。需要单独确认实际结束状态；请求取消不代表清理已经完成。",
  "Correlate each cancellation with worker/task termination and connection release for the same run.":
    "将每次取消与同一运行的任务终止和连接释放记录对应起来。",
  "The same trace stayed active after cancellation":
    "同一 trace 在取消后仍有活动",
  "A later task/worker heartbeat shares trace {id} and the same source. This establishes continued activity, not whether every resource leaked.":
    "同一来源中出现了更晚的任务心跳，trace 为 {id}。这能证明活动仍在继续，不能据此断定所有资源都发生泄漏。",
  "Check who owns the task, whether cancellation is propagated, and whether cleanup is awaited before the request returns.":
    "检查任务归属、取消是否传递，以及请求返回前是否等待清理完成。",
  "The retrieval step returned no usable context": "检索步骤没有返回可用上下文",
  "The trace explicitly reports an empty retrieval/context field. An answer generated afterward may lack supporting evidence.":
    "追踪记录明确显示检索结果或上下文字段为空，之后生成的回答可能缺少证据支持。",
  "Inspect the query, tenant filter, index version and document ingestion before changing the prompt.":
    "修改提示词前，先检查查询、租户过滤、索引版本和文档入库情况。",
  "A structured output failed validation": "结构化输出未通过校验",
  "A parsing or schema-validation error is recorded. The raw output and expected schema are needed to identify the incompatible field.":
    "记录到了解析或结构校验错误。需要原始输出和预期结构才能定位不兼容字段。",
  "Compare the response with the schema and finish reason; check for truncation before adding retries.":
    "对照响应、预期结构和结束原因；增加重试前先排查输出截断。",
  "An upstream dependency failed": "上游依赖出现故障",
  "The trace contains a server or connection failure. Local logs cannot establish the dependency's root cause.":
    "追踪记录包含服务端或连接错误，本地日志无法单独确认依赖故障的根因。",
  "Correlate dependency health and request IDs; inspect retry limits and the caller's remaining deadline.":
    "关联依赖健康状态和请求编号，检查重试上限与调用方剩余时间预算。",
  "No supported failure pattern was established": "未匹配到受支持的故障模式",
  "The available records do not match a supported diagnostic rule. Additional evidence is needed; this is not a clean health verdict.":
    "现有记录没有匹配到已支持的诊断规则，需要补充证据；这不代表系统健康。",
  "Add the failure window, a request ID and the relevant runbook. Review the evidence manually.":
    "补充故障时间范围、请求编号和相关操作手册，并人工检查证据。",
  "Model response has no hypotheses array.": "模型响应缺少 hypotheses 数组。",
  "Model exceeded the four-hypothesis limit.": "模型输出超过了四条假设的上限。",
  "Malformed hypothesis.": "假设格式不正确。",
  "Hypothesis is missing bounded text or citations.":
    "假设缺少符合长度限制的文本或引用。",
  "Rejected “{title}”: unknown evidence, altered quote, or quarantined content.":
    "已拒绝“{title}”：存在未知证据、被改写的引用或已隔离内容。",
  ingest: "导入",
  redact: "脱敏",
  retrieve: "检索",
  analyze: "分析",
  verify: "校验",
  "Validate bounded input and assign stable line citations.":
    "校验输入上限并分配稳定的行引用编号。",
  "{count} candidate secrets or emails redacted.":
    "已脱敏 {count} 处疑似密钥或邮箱。",
  "{count} lines selected by BM25 with source diversity; no embeddings used.":
    "BM25 检索选出 {count} 行并兼顾来源多样性，未使用向量嵌入。",
  "{count} rule-based observations. Root causes remain hypotheses.":
    "得到 {count} 项规则观察结果，根因仍待验证。",
  "No lexical query matches. No evidence will be invented to fill the retrieval result.":
    "没有词法匹配结果，系统不会编造证据来填充检索结果。",
  "Observations point to exact redacted source lines. Semantic causality is not verified.":
    "观察结果关联脱敏后的精确原文行，尚未验证语义因果关系。",
  "{count} observations from {lines} evidence lines. Verify the proposed checks before assigning a root cause.":
    "从 {lines} 行证据中得到 {count} 项观察结果，请完成建议的检查后再判断根因。",
  "Incident Weave — investigation report": "Incident Weave — 故障排查报告",
  Generated: "生成时间",
  "Evidence SHA-256": "证据 SHA-256",
  Question: "排查问题",
  "This is an investigation aid. Observations are rule-based; AI hypotheses are unconfirmed. Citation checks establish source/quote identity, not causality.":
    "本报告用于辅助排查。观察结果来自规则，AI 假设未经确认。引用校验验证来源与文本是否匹配，不能证明因果关系。",
  "Next check": "下一步检查",
  "Local AI hypotheses (not confirmed)": "本地 AI 假设（未确认）",
  Model: "模型",
  Validation: "校验",
  "Limits and warnings": "局限与提示",
};

// Only application-owned templates are matched; captured values stay verbatim.
const templates = Object.entries(zh)
  .filter(([key]) => /\{\w+\}/.test(key))
  .map(([key, value]) => {
    const names: string[] = [];
    const escaped = key
      .split(/(\{\w+\})/)
      .map((part) => {
        if (/^\{\w+\}$/.test(part)) {
          names.push(part.slice(1, -1));
          return "([\\s\\S]*?)";
        }
        return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      })
      .join("");
    return { regex: new RegExp(`^${escaped}$`), names, value };
  });
export function translate(
  locale: Locale,
  text: string,
  values: Record<string, string | number> = {},
): string {
  let copy = locale === "zh-CN" ? (zh[text] ?? text) : text;
  let variables = values;
  if (locale === "zh-CN" && !(text in zh)) {
    for (const template of templates) {
      const match = template.regex.exec(text);
      if (match) {
        copy = template.value;
        variables = Object.fromEntries(
          template.names.map((name, i) => [name, match[i + 1]]),
        );
        break;
      }
    }
  }
  return copy.replace(/\{(\w+)\}/g, (original, key) =>
    String(variables[key] ?? original),
  );
}
