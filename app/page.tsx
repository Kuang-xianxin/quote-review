"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpRight,
  Check,
  ChevronRight,
  Cpu,
  FileText,
  FlaskConical,
  LockKeyhole,
  Play,
  Plus,
  Square,
  Upload,
  Workflow,
  X,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { CASES, caseBundle } from "@/core/fixtures";
import {
  investigate,
  LIMITS,
  toMarkdown,
  type Bundle,
  type Citation,
  type Report,
} from "@/core/engine";
import {
  LANGUAGE_KEY,
  resolveLocale,
  translate,
  type Locale,
} from "@/core/i18n";
import { localizeReport } from "@/core/presentation";
import type { RunAI } from "@/core/local-ai";
import { registerInvestigationTools } from "@/core/webmcp";

const REPO = "https://github.com/Kuang-xianxin/incident-weave";

function download(contents: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function Home({
  initialLocale,
}: { initialLocale?: Locale } = {}) {
  const [locale, setLocale] = useState<Locale>(() => {
    if (initialLocale) return initialLocale;
    if (typeof window === "undefined") return "en";
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(LANGUAGE_KEY);
    } catch {
      /* Optional preference. */
    }
    return resolveLocale(window.location.search, saved, navigator.languages);
  });
  const t = (text: string, values?: Record<string, string | number>) =>
    translate(locale, text, values);
  const initial = caseBundle(CASES[0], locale);
  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = `Incident Weave — ${translate(locale, "Follow the evidence.")}`;
    const description = translate(
      locale,
      "Turn scattered logs into a clear investigation. Connect the signals, inspect every citation, and decide what to check next.",
    );
    for (const selector of [
      'meta[name="description"]',
      'meta[property="og:description"]',
    ])
      document.querySelector(selector)?.setAttribute("content", description);
    document
      .querySelector('meta[property="og:title"]')
      ?.setAttribute("content", document.title);
  }, [locale]);
  function changeLanguage(next: Locale) {
    setLocale(next);
    try {
      localStorage.setItem(LANGUAGE_KEY, next);
    } catch {
      /* Optional preference. */
    }
    const url = new URL(window.location.href);
    url.searchParams.set("lang", next);
    window.history.replaceState(null, "", url);
  }
  const [sources, setSources] = useState<Bundle["sources"]>(initial.sources);
  const [question, setQuestion] = useState(initial.question);
  const [caseId, setCaseId] = useState(CASES[0].id);
  const [sourceTab, setSourceTab] = useState("0");
  const [report, setReport] = useState<Report | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiProgress, setAiProgress] = useState({ progress: 0, text: "" });
  const [aiDialog, setAiDialog] = useState(false);
  const [checks, setChecks] = useState<string | null>(null);
  const [remember, setRemember] = useState(false);
  const [history, setHistory] = useState<Report[]>([]);
  const [resultTab, setResultTab] = useState("observations");
  const fileInput = useRef<HTMLInputElement>(null);
  const aiRun = useRef<RunAI | null>(null);
  const generation = useRef(0);
  const reportRef = useRef(report);
  reportRef.current = report;
  const busyRef = useRef(false);
  const disabled = busy || aiBusy;

  useEffect(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem("incident-weave-history-v1") ?? "[]",
      );
      if (Array.isArray(saved))
        setHistory(
          saved
            .filter(
              (r) =>
                r?.version === 1 &&
                Array.isArray(r.evidence) &&
                typeof r.digest === "string",
            )
            .slice(0, 5),
        );
    } catch {
      /* Corrupt/local-disabled storage does not block an investigation. */
    }
    const runGeneration = generation;
    return () => {
      runGeneration.current++;
      aiRun.current?.cancel();
    };
  }, []);

  function invalidate() {
    generation.current++;
    setReport(null);
    setSelected(null);
    setError("");
    setChecks(null);
  }
  function chooseCase(id: string) {
    if (busyRef.current) return;
    invalidate();
    setCaseId(id);
    setSourceTab("0");
    const c = CASES.find((c) => c.id === id);
    const bundle = c
      ? caseBundle(c, locale)
      : {
          question: t("What failed, and what evidence should I check next?"),
          sources: [
            { name: "runtime.log", text: "", kind: "log" as const },
            { name: "runbook.md", text: "", kind: "runbook" as const },
          ],
        };
    setSources(bundle.sources);
    setQuestion(bundle.question);
  }
  async function run(bundle: Bundle = { sources, question }) {
    if (busyRef.current)
      throw new Error("An investigation is already running. Cancel it first.");
    busyRef.current = true;
    setBusy(true);
    setError("");
    const token = ++generation.current;
    try {
      const next = await investigate(bundle);
      if (token !== generation.current)
        throw new Error("Investigation superseded.");
      setReport(next);
      reportRef.current = next;
      setSelected(next.retrieved[0]?.id ?? next.evidence[0]?.id);
      setResultTab("observations");
      if (remember) {
        const updated = [
          next,
          ...history.filter((r) => r.digest !== next.digest),
        ].slice(0, 5);
        try {
          localStorage.setItem(
            "incident-weave-history-v1",
            JSON.stringify(updated),
          );
          setHistory(updated);
        } catch {
          setError(
            "Analysis completed. Browser storage is unavailable or full; export the report to keep it.",
          );
        }
      }
      return next;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed.");
      throw e;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  // The same bounded engine and state transition back both the UI and agent tools.
  const runRef = useRef(run);
  runRef.current = run;
  useEffect(
    () =>
      registerInvestigationTools({
        read: () => reportRef.current,
        investigate: async (bundle) => {
          if (busyRef.current)
            throw new Error("An investigation is already running.");
          const next = await runRef.current(bundle);
          setSources(bundle.sources);
          setQuestion(bundle.question);
          setCaseId("custom");
          setSourceTab("0");
          return next;
        },
      }),
    [],
  );

  async function importFiles(files: FileList | null) {
    if (!files?.length) return;
    setError("");
    try {
      const picked = Array.from(files);
      if (
        picked.length > LIMITS.sources ||
        picked.reduce((n, f) => n + f.size, 0) > LIMITS.bytes
      )
        throw new Error("Import up to 12 text files, 256 KB total.");
      if (picked.some((f) => !/\.(txt|log|md|json|jsonl|csv)$/i.test(f.name)))
        throw new Error(
          "Supported files: .log, .txt, .md, .json, .jsonl, .csv.",
        );
      const imported = await Promise.all(
        picked.map(async (f) => ({
          name: f.name,
          text: await f.text(),
          kind: /\.md$/i.test(f.name) ? ("runbook" as const) : ("log" as const),
        })),
      );
      invalidate();
      setSources(imported);
      setCaseId("custom");
      setSourceTab("0");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read files.");
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function startAI() {
    if (!report || busyRef.current) return;
    if (!("gpu" in navigator)) {
      setError(
        "This browser has no WebGPU. Evidence analysis and exports still work. Try a recent desktop browser with WebGPU enabled.",
      );
      setAiDialog(false);
      return;
    }
    const current = report,
      token = generation.current;
    setAiDialog(false);
    setAiBusy(true);
    busyRef.current = true;
    setError("");
    setAiProgress({ progress: 0, text: "Starting the local model worker…" });
    try {
      const { runLocalAI } = await import("@/core/local-ai");
      aiRun.current = runLocalAI(current, setAiProgress, locale);
      const ai = await aiRun.current.result;
      if (generation.current === token) {
        const updated = { ...current, ai };
        setReport(updated);
        reportRef.current = updated;
        setResultTab("hypotheses");
      }
    } catch (e) {
      if (generation.current === token)
        setError(e instanceof Error ? e.message : "Local AI could not run.");
    } finally {
      aiRun.current = null;
      busyRef.current = false;
      setAiBusy(false);
    }
  }
  async function runChecks() {
    setChecks("Running the built-in fixture evaluation…");
    try {
      const { evaluate } = await import("@/core/evaluation");
      const result = await evaluate();
      setChecks(
        `${result.passed}/${result.total} fixture checks passed · ${result.durationMs} ms. This tests deterministic diagnostics and citation rejection, not model reasoning quality.`,
      );
    } catch {
      setChecks(
        "Evaluation failed. See the test suite in the source repository.",
      );
    }
  }
  const evidence = report?.evidence.find((e) => e.id === selected);
  const citationButtons = (citations: Citation[]) => (
    <div className="citation-buttons">
      {citations.map((c, i) => (
        <button
          key={`${c.evidenceId}-${i}`}
          className={
            selected === c.evidenceId ? "citation selected" : "citation"
          }
          onClick={() => setSelected(c.evidenceId)}
          aria-label={t("Inspect evidence {id}", { id: c.evidenceId })}
        >
          <FileText size={11} />
          {c.evidenceId}
        </button>
      ))}
    </div>
  );

  return (
    <main className="workspace">
      <header className="topbar">
        <a className="brand" href="/">
          <span className="brand-icon">
            <Workflow size={22} />
          </span>
          incident<span>weave</span>
          <b>LAB</b>
        </a>
        <nav>
          <div
            className="language-switch"
            role="group"
            aria-label="Language / 语言"
          >
            <button
              type="button"
              lang="zh-CN"
              aria-pressed={locale === "zh-CN"}
              onClick={() => changeLanguage("zh-CN")}
            >
              中文
            </button>
            <button
              type="button"
              lang="en"
              aria-pressed={locale === "en"}
              onClick={() => changeLanguage("en")}
            >
              English
            </button>
          </div>
          <span className="privacy">
            <i /> {t("Runs on your device")}{" "}
          </span>
          <a href={REPO} target="_blank" rel="noreferrer">
            {" "}
            {t("Source")} <ArrowUpRight size={13} />
          </a>
        </nav>
      </header>
      <section className="hero">
        <div>
          <p className="eyebrow">
            {t("LOCAL INTELLIGENCE. TRACEABLE ANSWERS.")}
          </p>
          <h1>
            {" "}
            {t("Something broke.")} <br />
            <em>{t("Follow the evidence.")}</em>
          </h1>
          <p className="intro">
            {" "}
            {t(
              "Turn scattered logs into a clear investigation. Connect the signals, inspect every citation, and decide what to check next.",
            )}{" "}
          </p>
          <div className="hero-facts">
            <span>
              <LockKeyhole size={15} /> {t("No evidence uploads")}{" "}
            </span>
            <span>
              <Cpu size={15} /> {t("No API bill")}{" "}
            </span>
            <span>
              <FileText size={15} /> {t("Traceable citations")}{" "}
            </span>
          </div>
        </div>
        <div className="signal-art" aria-hidden="true">
          <div className="signal-node n1">
            {" "}
            {t("Runtime logs")} <b>→</b>
          </div>
          <div className="signal-node n2">
            {" "}
            {t("Tool traces")} <b>→</b>
          </div>
          <div className="signal-node n3">
            {" "}
            {t("Runbook")} <b>→</b>
          </div>
          <svg viewBox="0 0 440 230">
            <path d="M155 44 C250 44 190 115 295 115 M155 115H295 M155 186C250 186 190 115 295 115" />
            <circle cx="296" cy="115" r="47" />
            <circle className="signal-core" cx="296" cy="115" r="31" />
          </svg>
          <span className="signal-label">{t("One evidence trail.")}</span>
        </div>
      </section>
      <section className="bench" id="workbench">
        <div className="bench-header">
          <div>
            <span className="eyebrow">{t("YOUR EVIDENCE. YOUR DEVICE.")}</span>
            <h2>{t("The incident workbench")}</h2>
          </div>
          <span className="badge">{t("Free & open source")}</span>
        </div>
        <div className="bench-grid">
          <aside className="case-panel">
            <span className="eyebrow">{t("TRY A SYNTHETIC CASE")}</span>
            {CASES.map((c, i) => (
              <button
                key={c.id}
                disabled={disabled}
                className={`case ${caseId === c.id ? "active" : ""}`}
                onClick={() => chooseCase(c.id)}
              >
                <span className="case-number">0{i + 1}</span>
                <div>
                  <strong>{t(c.title)}</strong>
                  <p>{t(c.subtitle)}</p>
                </div>
                {caseId === c.id && <ChevronRight size={16} />}
              </button>
            ))}
            <button
              className={`case custom ${caseId === "custom" ? "active" : ""}`}
              disabled={disabled}
              onClick={() => chooseCase("custom")}
            >
              <Plus size={16} />
              <strong>{t("Your own evidence")}</strong>
            </button>
            <div className="local-note">
              <LockKeyhole size={18} />
              <p>
                {" "}
                {t(
                  "Analysis runs here. Logs never go to our server. Local AI downloads model files only when you ask.",
                )}{" "}
              </p>
              <button
                className="text-button"
                onClick={runChecks}
                disabled={disabled}
              >
                <FlaskConical size={13} /> {t("Run fixture evaluation")}{" "}
              </button>
              {checks && <p role="status">{t(checks)}</p>}
            </div>
            {history.length > 0 && (
              <div className="local-history">
                <span className="eyebrow">{t("SAVED ON THIS DEVICE")}</span>
                {history.map((h) => (
                  <button
                    key={h.id}
                    disabled={disabled}
                    onClick={() => {
                      setReport(h);
                      reportRef.current = h;
                      setSelected(h.evidence[0]?.id);
                      setResultTab("observations");
                      setError("");
                    }}
                  >
                    <FileText size={12} />
                    <span>{h.question.slice(0, 44)}</span>
                  </button>
                ))}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button className="text-button" disabled={disabled}>
                      {" "}
                      {t("Clear saved reports")}{" "}
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        {" "}
                        {t("Clear reports saved on this device?")}{" "}
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        {" "}
                        {t(
                          "Your current investigation and exported files stay available. The saved history will be removed from this browser.",
                        )}{" "}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t("Keep reports")}</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => {
                          try {
                            localStorage.removeItem(
                              "incident-weave-history-v1",
                            );
                            setHistory([]);
                          } catch {
                            setError("Browser storage could not be cleared.");
                          }
                        }}
                      >
                        {" "}
                        {t("Clear history")}{" "}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </aside>
          <div className="editor-panel">
            <div className="editor-label">
              <strong>{t("Evidence bundle")}</strong>
              <button
                className="secondary small"
                onClick={() => fileInput.current?.click()}
                disabled={disabled}
              >
                <Upload size={13} /> {t("Import files")}{" "}
              </button>
              <input
                className="sr-only"
                type="file"
                multiple
                accept=".log,.txt,.md,.json,.jsonl,.csv"
                ref={fileInput}
                onChange={(e) => void importFiles(e.target.files)}
                aria-label={t("Import local evidence files")}
              />
            </div>
            <label className="question-label" htmlFor="question">
              {" "}
              {t("What are you investigating?")}{" "}
            </label>
            <input
              id="question"
              className="question-input"
              value={question}
              maxLength={LIMITS.question}
              disabled={disabled}
              onChange={(e) => {
                invalidate();
                setQuestion(e.target.value);
              }}
            />
            <Tabs value={sourceTab} onValueChange={setSourceTab}>
              <TabsList className="source-tabs" variant="line">
                {sources.map((s, i) => (
                  <TabsTrigger value={String(i)} key={i}>
                    <FileText size={12} />
                    {s.name}
                  </TabsTrigger>
                ))}
              </TabsList>
              {sources.map((s, i) => (
                <TabsContent key={i} value={String(i)}>
                  <textarea
                    className="log-preview evidence-input"
                    aria-label={t("Edit {name}", { name: s.name })}
                    spellCheck={false}
                    value={s.text}
                    maxLength={LIMITS.bytes}
                    disabled={disabled}
                    placeholder={t(
                      s.kind === "runbook"
                        ? "Paste the relevant runbook or operational notes…"
                        : "Paste timestamped logs, JSONL traces, or a failure transcript…",
                    )}
                    onChange={(e) => {
                      invalidate();
                      setCaseId("custom");
                      setSources(
                        sources.map((v, j) =>
                          j === i ? { ...v, text: e.target.value } : v,
                        ),
                      );
                    }}
                  />
                  <div className="source-footnote">
                    <span>
                      {t(
                        s.kind === "runbook"
                          ? "Reference material · not runtime evidence"
                          : "Runtime evidence · treated as untrusted data",
                      )}
                    </span>
                    <span>
                      {s.text.split(/\r?\n/).length} {t("lines")}
                    </span>
                  </div>
                </TabsContent>
              ))}
            </Tabs>
            <div className="editor-bottom">
              <span>
                <i className="status-dot" />{" "}
                {t("Evidence analysis · deterministic, no LLM")}{" "}
              </span>
              <button
                className="primary"
                disabled={
                  disabled ||
                  !sources.some((s) => s.text.trim()) ||
                  !question.trim()
                }
                onClick={() => void run().catch(() => {})}
              >
                <Play size={15} />
                {t(busy ? "Analyzing…" : "Investigate")}
              </button>
            </div>
            <label className="remember">
              <Checkbox
                checked={remember}
                disabled={disabled}
                onCheckedChange={(value) => setRemember(value === true)}
              />{" "}
              {t("Keep redacted reports on this device (up to 5)")}{" "}
            </label>
          </div>
        </div>
      </section>
      {error && (
        <div className="notice" role="alert">
          <span>{t(error)}</span>
          <button
            aria-label={t("Dismiss message")}
            onClick={() => setError("")}
          >
            <X size={15} />
          </button>
        </div>
      )}
      {report ? (
        <section className="results" aria-label={t("Investigation report")}>
          <div className="result-heading">
            <div>
              <p className="eyebrow">{t("EVIDENCE BEFORE EXPLANATIONS")}</p>
              <h2>
                {report.findings.length}{" "}
                {t("observations. A clearer next step.")}{" "}
              </h2>
              <p className="report-question">{report.question}</p>
              <p>
                {report.evidence.length} {t("evidence lines ·")}{" "}
                {report.retrieved.length} {t("retrieved ·")} {report.redactions}{" "}
                {t("redactions ·")}{" "}
                <span title={report.digest}>
                  SHA-256 {report.digest.slice(0, 10)}
                </span>
              </p>
            </div>
            <div className="export-actions">
              <button
                className="secondary"
                onClick={() =>
                  download(
                    toMarkdown(report, locale),
                    "incident-weave-report.md",
                    "text/markdown;charset=utf-8",
                  )
                }
              >
                <ArrowDownToLine size={14} /> Markdown
              </button>
              <button
                className="secondary"
                onClick={() =>
                  download(
                    JSON.stringify(
                      { ...localizeReport(report, locale), language: locale },
                      null,
                      2,
                    ),
                    "incident-weave-report.json",
                    "application/json",
                  )
                }
              >
                <ArrowDownToLine size={14} /> JSON
              </button>
            </div>
          </div>
          <div className="result-grid">
            <div className="findings">
              <Tabs value={resultTab} onValueChange={setResultTab}>
                <TabsList variant="line" className="result-tabs">
                  <TabsTrigger value="observations">
                    {" "}
                    {t("Observations")} <span>{report.findings.length}</span>
                  </TabsTrigger>
                  <TabsTrigger value="hypotheses">
                    {" "}
                    {t("Local AI")}{" "}
                    {report.ai && <span>{report.ai.hypotheses.length}</span>}
                  </TabsTrigger>
                  <TabsTrigger value="trace">{t("Run trace")}</TabsTrigger>
                </TabsList>
                <TabsContent value="observations">
                  <p className="mode-caption">
                    {" "}
                    {t(
                      "Rule-based signals from your logs. They establish observations, not a confirmed root cause.",
                    )}{" "}
                  </p>
                  {report.findings.map((f, i) => (
                    <article className="finding" key={f.id}>
                      <div className="finding-title">
                        <span className="finding-index">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <h3>{t(f.title)}</h3>
                        <span className="source-linked">
                          <Check size={11} /> {t("Source-linked")}{" "}
                        </span>
                      </div>
                      <p>{t(f.detail)}</p>
                      {citationButtons(f.citations)}
                      <div className="next-check">
                        <span>{t("NEXT CHECK")}</span>
                        <p>{t(f.nextCheck)}</p>
                      </div>
                    </article>
                  ))}
                </TabsContent>
                <TabsContent value="hypotheses">
                  <div className="ai-intro">
                    <Cpu size={25} />
                    <h3>
                      {" "}
                      {t("A second pair of eyes.")} <br />{" "}
                      {t("On your own device.")}{" "}
                    </h3>
                    <p>
                      {" "}
                      {t(
                        "An optional small language model can propose hypotheses using the retrieved evidence. No API key, account, or per-request fee.",
                      )}{" "}
                    </p>
                    <p className="mode-caption">
                      {" "}
                      {t(
                        "Each quote is checked against its source. A matching quote does not prove the hypothesis is correct.",
                      )}{" "}
                    </p>
                    <Dialog open={aiDialog} onOpenChange={setAiDialog}>
                      <DialogTrigger asChild>
                        <button className="primary" disabled={disabled}>
                          <Cpu size={15} />
                          {t(
                            report.ai
                              ? "Run local AI again"
                              : "Enable local AI",
                          )}
                        </button>
                      </DialogTrigger>
                      <DialogContent closeLabel={t("Close")}>
                        <DialogHeader>
                          <DialogTitle>
                            {t("Run AI on this device")}
                          </DialogTitle>
                          <DialogDescription>
                            {" "}
                            {t(
                              "Downloads an open model from Hugging Face and its runtime files. Your evidence is processed locally and is not sent to a model API.",
                            )}{" "}
                          </DialogDescription>
                        </DialogHeader>
                        <div className="model-info">
                          <p>
                            <strong>{t("Model:")}</strong>{" "}
                            {t("Qwen2.5 0.5B Instruct, 4-bit.")}{" "}
                          </p>
                          <p>
                            <strong>{t("Requirements:")}</strong>{" "}
                            {t(
                              "WebGPU and roughly 1.1 GB of available GPU memory. The initial model download is several hundred MB and may take a few minutes.",
                            )}{" "}
                          </p>
                          <p>
                            <strong>{t("Limits:")}</strong>{" "}
                            {t(
                              "Small models can miss causes or produce incorrect hypotheses. Treat suggestions as leads for investigation.",
                            )}{" "}
                          </p>
                        </div>
                        <button
                          className="primary"
                          onClick={() => void startAI()}
                        >
                          <ArrowDownToLine size={15} />{" "}
                          {t("Download & run locally")}{" "}
                        </button>
                      </DialogContent>
                    </Dialog>
                  </div>
                  {aiBusy && (
                    <div className="ai-progress" role="status">
                      <Progress value={aiProgress.progress * 100} />
                      <p>
                        {t(
                          aiProgress.progress >= 1
                            ? "Model ready. Generating hypotheses on your device…"
                            : "Loading the model on this device…",
                        )}
                      </p>
                      <details>
                        <summary>{t("Runtime details")}</summary>
                        <p>{aiProgress.text}</p>
                      </details>
                      <button
                        className="secondary"
                        onClick={() => aiRun.current?.cancel()}
                      >
                        <Square size={12} /> {t("Cancel local AI")}{" "}
                      </button>
                    </div>
                  )}
                  {report.ai && (
                    <>
                      <p className="mode-caption">
                        {report.ai.model} ·{" "}
                        {(report.ai.durationMs / 1000).toFixed(1)}{" "}
                        {t("seconds including initialization")}{" "}
                      </p>
                      {report.ai.hypotheses.length === 0 && (
                        <div className="notice">
                          {" "}
                          {t(
                            "No hypothesis passed citation validation. The observations above remain available.",
                          )}{" "}
                        </div>
                      )}
                      {report.ai.hypotheses.map((h, i) => (
                        <article className="finding hypothesis" key={i}>
                          <span className="badge">
                            {t("Unconfirmed hypothesis")}
                          </span>
                          <p className="mode-caption">
                            {t(
                              "Generated hypotheses keep their original language. Run local AI again to request the current language.",
                            )}
                          </p>
                          <h3>{h.title}</h3>
                          <p>{h.explanation}</p>
                          {citationButtons(h.citations)}
                          <div className="next-check">
                            <span>{t("NEXT CHECK")}</span>
                            <p>{h.nextCheck}</p>
                          </div>
                        </article>
                      ))}
                      {report.ai.rejected.map((r, i) => (
                        <p className="validation-note" key={i}>
                          {t(r)}
                        </p>
                      ))}
                    </>
                  )}
                </TabsContent>
                <TabsContent value="trace">
                  <p className="mode-caption">
                    {" "}
                    {t(
                      "Actual stages of this run. Timings are measured locally; no simulated progress or model calls.",
                    )}{" "}
                  </p>
                  <ol className="trace-list">
                    {report.trace.map((event, i) => (
                      <li key={i}>
                        <span className="trace-dot" />
                        <div>
                          <strong>{t(event.stage)}</strong>
                          <p>{t(event.detail)}</p>
                        </div>
                        <code>{event.elapsedMs} ms</code>
                      </li>
                    ))}
                  </ol>
                  <p className="mode-caption">
                    {" "}
                    {t(
                      "Input limits: 256 KB · 2,500 lines · 12 sources. SHA-256 fingerprints the redacted evidence and question, not the identity of its author.",
                    )}{" "}
                  </p>
                </TabsContent>
              </Tabs>
              {report.warnings.length > 0 && (
                <details className="warnings">
                  <summary>
                    {report.warnings.length} {t("evidence limitations")}{" "}
                  </summary>
                  {report.warnings.map((w, i) => (
                    <p key={i}>{t(w)}</p>
                  ))}
                </details>
              )}
            </div>
            <aside className="evidence-view">
              <div className="evidence-view-header">
                <FileText size={15} />
                <strong>{t("Inspect the source")}</strong>
              </div>
              {evidence && (
                <>
                  <div className="evidence-meta">
                    <span>{evidence.id}</span>
                    <span>
                      {evidence.source}:{evidence.line}
                    </span>
                  </div>
                  <pre className="source-quote">{evidence.text}</pre>
                  <p className="mode-caption">
                    {" "}
                    {t(
                      "Exact redacted input. A citation match verifies this text exists; it does not verify the statement is true.",
                    )}{" "}
                  </p>
                </>
              )}
              <span className="eyebrow">{t("RETRIEVED EVIDENCE")}</span>
              <div className="retrieved-list">
                {report.retrieved.map((e) => (
                  <button
                    key={e.id}
                    className={selected === e.id ? "active" : ""}
                    onClick={() => setSelected(e.id)}
                  >
                    <span>
                      {e.id} · {e.source}:{e.line}
                    </span>
                    <p>{e.text}</p>
                  </button>
                ))}
                {!report.retrieved.length && (
                  <p className="mode-caption">
                    {" "}
                    {t("No query matches. Add more relevant evidence.")}{" "}
                  </p>
                )}
              </div>
            </aside>
          </div>
        </section>
      ) : (
        <section className="empty-report">
          <Workflow size={22} />
          <div>
            <strong>{t("A useful answer starts with a trace.")}</strong>
            <p>
              {" "}
              {t(
                "Choose a case or import your own evidence, then start an investigation.",
              )}{" "}
            </p>
          </div>
          <ArrowUpRight size={18} />
        </section>
      )}
      <footer>
        <span>{t("Built for the moment after “it failed.”")}</span>
        <div>
          <a
            href={`${REPO}/blob/main/docs/INTERVIEW.${locale === "zh-CN" ? "zh-CN" : "en"}.md`}
            target="_blank"
            rel="noreferrer"
          >
            {" "}
            {t("Interview guide")} <ArrowUpRight size={11} />
          </a>
          <a
            href={`${REPO}/blob/main/docs/ARCHITECTURE${locale === "zh-CN" ? ".zh-CN" : ""}.md`}
            target="_blank"
            rel="noreferrer"
          >
            {" "}
            {t("How it works")} <ArrowUpRight size={11} />
          </a>
          <span>{t("MIT · No keys · No subscription")}</span>
        </div>
      </footer>
    </main>
  );
}
