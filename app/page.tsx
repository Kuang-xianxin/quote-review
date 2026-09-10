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
import type { RunAI } from "@/core/local-ai";
import { registerInvestigationTools } from "@/core/webmcp";

const REPO = "https://github.com/Kuang-xianxin/incident-weave";
const initial = caseBundle(CASES[0]);
function download(contents: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function Home() {
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
      ? caseBundle(c)
      : {
          question: "What failed, and what evidence should I check next?",
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
      aiRun.current = runLocalAI(current, setAiProgress);
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
          aria-label={`Inspect evidence ${c.evidenceId}`}
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
          <span className="privacy">
            <i /> Runs on your device
          </span>
          <a href={REPO} target="_blank" rel="noreferrer">
            Source <ArrowUpRight size={13} />
          </a>
        </nav>
      </header>
      <section className="hero">
        <div>
          <p className="eyebrow">LOCAL INTELLIGENCE. TRACEABLE ANSWERS.</p>
          <h1>
            Something broke.
            <br />
            <em>Follow the evidence.</em>
          </h1>
          <p className="intro">
            Turn scattered logs into a clear investigation. Connect the signals,
            inspect every citation, and decide what to check next.
          </p>
          <div className="hero-facts">
            <span>
              <LockKeyhole size={15} /> No evidence uploads
            </span>
            <span>
              <Cpu size={15} /> No API bill
            </span>
            <span>
              <FileText size={15} /> Traceable citations
            </span>
          </div>
        </div>
        <div className="signal-art" aria-hidden="true">
          <div className="signal-node n1">
            Runtime logs <b>→</b>
          </div>
          <div className="signal-node n2">
            Tool traces <b>→</b>
          </div>
          <div className="signal-node n3">
            Runbook <b>→</b>
          </div>
          <svg viewBox="0 0 440 230">
            <path d="M155 44 C250 44 190 115 295 115 M155 115H295 M155 186C250 186 190 115 295 115" />
            <circle cx="296" cy="115" r="47" />
            <circle className="signal-core" cx="296" cy="115" r="31" />
          </svg>
          <span className="signal-label">One evidence trail.</span>
        </div>
      </section>
      <section className="bench" id="workbench">
        <div className="bench-header">
          <div>
            <span className="eyebrow">YOUR EVIDENCE. YOUR DEVICE.</span>
            <h2>The incident workbench</h2>
          </div>
          <span className="badge">Free & open source</span>
        </div>
        <div className="bench-grid">
          <aside className="case-panel">
            <span className="eyebrow">TRY A SYNTHETIC CASE</span>
            {CASES.map((c, i) => (
              <button
                key={c.id}
                disabled={disabled}
                className={`case ${caseId === c.id ? "active" : ""}`}
                onClick={() => chooseCase(c.id)}
              >
                <span className="case-number">0{i + 1}</span>
                <div>
                  <strong>{c.title}</strong>
                  <p>{c.subtitle}</p>
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
              <strong>Your own evidence</strong>
            </button>
            <div className="local-note">
              <LockKeyhole size={18} />
              <p>
                Analysis runs here. Logs never go to our server. Local AI
                downloads model files only when you ask.
              </p>
              <button
                className="text-button"
                onClick={runChecks}
                disabled={disabled}
              >
                <FlaskConical size={13} /> Run fixture evaluation
              </button>
              {checks && <p role="status">{checks}</p>}
            </div>
            {history.length > 0 && (
              <div className="local-history">
                <span className="eyebrow">SAVED ON THIS DEVICE</span>
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
                      Clear saved reports
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        Clear reports saved on this device?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        Your current investigation and exported files stay
                        available. The saved history will be removed from this
                        browser.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Keep reports</AlertDialogCancel>
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
                        Clear history
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </aside>
          <div className="editor-panel">
            <div className="editor-label">
              <strong>Evidence bundle</strong>
              <button
                className="secondary small"
                onClick={() => fileInput.current?.click()}
                disabled={disabled}
              >
                <Upload size={13} /> Import files
              </button>
              <input
                className="sr-only"
                type="file"
                multiple
                accept=".log,.txt,.md,.json,.jsonl,.csv"
                ref={fileInput}
                onChange={(e) => void importFiles(e.target.files)}
                aria-label="Import local evidence files"
              />
            </div>
            <label className="question-label" htmlFor="question">
              What are you investigating?
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
                    aria-label={`Edit ${s.name}`}
                    spellCheck={false}
                    value={s.text}
                    maxLength={LIMITS.bytes}
                    disabled={disabled}
                    placeholder={
                      s.kind === "runbook"
                        ? "Paste the relevant runbook or operational notes…"
                        : "Paste timestamped logs, JSONL traces, or a failure transcript…"
                    }
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
                      {s.kind === "runbook"
                        ? "Reference material · not runtime evidence"
                        : "Runtime evidence · treated as untrusted data"}
                    </span>
                    <span>{s.text.split(/\r?\n/).length} lines</span>
                  </div>
                </TabsContent>
              ))}
            </Tabs>
            <div className="editor-bottom">
              <span>
                <i className="status-dot" /> Evidence analysis · deterministic,
                no LLM
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
                {busy ? "Analyzing…" : "Investigate"}
              </button>
            </div>
            <label className="remember">
              <Checkbox
                checked={remember}
                disabled={disabled}
                onCheckedChange={(value) => setRemember(value === true)}
              />{" "}
              Keep redacted reports on this device (up to 5)
            </label>
          </div>
        </div>
      </section>
      {error && (
        <div className="notice" role="alert">
          <span>{error}</span>
          <button aria-label="Dismiss message" onClick={() => setError("")}>
            <X size={15} />
          </button>
        </div>
      )}
      {report ? (
        <section className="results" aria-label="Investigation report">
          <div className="result-heading">
            <div>
              <p className="eyebrow">EVIDENCE BEFORE EXPLANATIONS</p>
              <h2>
                {report.findings.length} observations. A clearer next step.
              </h2>
              <p className="report-question">{report.question}</p>
              <p>
                {report.evidence.length} evidence lines ·{" "}
                {report.retrieved.length} retrieved · {report.redactions}{" "}
                redactions ·{" "}
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
                    toMarkdown(report),
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
                    JSON.stringify(report, null, 2),
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
                    Observations <span>{report.findings.length}</span>
                  </TabsTrigger>
                  <TabsTrigger value="hypotheses">
                    Local AI{" "}
                    {report.ai && <span>{report.ai.hypotheses.length}</span>}
                  </TabsTrigger>
                  <TabsTrigger value="trace">Run trace</TabsTrigger>
                </TabsList>
                <TabsContent value="observations">
                  <p className="mode-caption">
                    Rule-based signals from your logs. They establish
                    observations, not a confirmed root cause.
                  </p>
                  {report.findings.map((f, i) => (
                    <article className="finding" key={f.id}>
                      <div className="finding-title">
                        <span className="finding-index">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <h3>{f.title}</h3>
                        <span className="source-linked">
                          <Check size={11} /> Source-linked
                        </span>
                      </div>
                      <p>{f.detail}</p>
                      {citationButtons(f.citations)}
                      <div className="next-check">
                        <span>NEXT CHECK</span>
                        <p>{f.nextCheck}</p>
                      </div>
                    </article>
                  ))}
                </TabsContent>
                <TabsContent value="hypotheses">
                  <div className="ai-intro">
                    <Cpu size={25} />
                    <h3>
                      A second pair of eyes.
                      <br />
                      On your own device.
                    </h3>
                    <p>
                      An optional small language model can propose hypotheses
                      using the retrieved evidence. No API key, account, or
                      per-request fee.
                    </p>
                    <p className="mode-caption">
                      Each quote is checked against its source. A matching quote
                      does not prove the hypothesis is correct.
                    </p>
                    <Dialog open={aiDialog} onOpenChange={setAiDialog}>
                      <DialogTrigger asChild>
                        <button className="primary" disabled={disabled}>
                          <Cpu size={15} />
                          {report.ai ? "Run local AI again" : "Enable local AI"}
                        </button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Run AI on this device</DialogTitle>
                          <DialogDescription>
                            Downloads an open model from Hugging Face and its
                            runtime files. Your evidence is processed locally
                            and is not sent to a model API.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="model-info">
                          <p>
                            <strong>Model:</strong> Qwen2.5 0.5B Instruct,
                            4-bit.
                          </p>
                          <p>
                            <strong>Requirements:</strong> WebGPU and roughly
                            1.1 GB of available GPU memory. The initial model
                            download is several hundred MB and may take a few
                            minutes.
                          </p>
                          <p>
                            <strong>Limits:</strong> Small models can miss
                            causes or produce incorrect hypotheses. Treat
                            suggestions as leads for investigation.
                          </p>
                        </div>
                        <button
                          className="primary"
                          onClick={() => void startAI()}
                        >
                          <ArrowDownToLine size={15} /> Download & run locally
                        </button>
                      </DialogContent>
                    </Dialog>
                  </div>
                  {aiBusy && (
                    <div className="ai-progress" role="status">
                      <Progress value={aiProgress.progress * 100} />
                      <p>{aiProgress.text}</p>
                      <button
                        className="secondary"
                        onClick={() => aiRun.current?.cancel()}
                      >
                        <Square size={12} /> Cancel local AI
                      </button>
                    </div>
                  )}
                  {report.ai && (
                    <>
                      <p className="mode-caption">
                        {report.ai.model} ·{" "}
                        {(report.ai.durationMs / 1000).toFixed(1)} seconds
                        including initialization
                      </p>
                      {report.ai.hypotheses.length === 0 && (
                        <div className="notice">
                          No hypothesis passed citation validation. The
                          observations above remain available.
                        </div>
                      )}
                      {report.ai.hypotheses.map((h, i) => (
                        <article className="finding hypothesis" key={i}>
                          <span className="badge">Unconfirmed hypothesis</span>
                          <h3>{h.title}</h3>
                          <p>{h.explanation}</p>
                          {citationButtons(h.citations)}
                          <div className="next-check">
                            <span>NEXT CHECK</span>
                            <p>{h.nextCheck}</p>
                          </div>
                        </article>
                      ))}
                      {report.ai.rejected.map((r, i) => (
                        <p className="validation-note" key={i}>
                          {r}
                        </p>
                      ))}
                    </>
                  )}
                </TabsContent>
                <TabsContent value="trace">
                  <p className="mode-caption">
                    Actual stages of this run. Timings are measured locally; no
                    simulated progress or model calls.
                  </p>
                  <ol className="trace-list">
                    {report.trace.map((t, i) => (
                      <li key={i}>
                        <span className="trace-dot" />
                        <div>
                          <strong>{t.stage}</strong>
                          <p>{t.detail}</p>
                        </div>
                        <code>{t.elapsedMs} ms</code>
                      </li>
                    ))}
                  </ol>
                  <p className="mode-caption">
                    Input limits: 256 KB · 2,500 lines · 12 sources. SHA-256
                    fingerprints the redacted evidence and question, not the
                    identity of its author.
                  </p>
                </TabsContent>
              </Tabs>
              {report.warnings.length > 0 && (
                <details className="warnings">
                  <summary>
                    {report.warnings.length} evidence limitations
                  </summary>
                  {report.warnings.map((w, i) => (
                    <p key={i}>{w}</p>
                  ))}
                </details>
              )}
            </div>
            <aside className="evidence-view">
              <div className="evidence-view-header">
                <FileText size={15} />
                <strong>Inspect the source</strong>
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
                    Exact redacted input. A citation match verifies this text
                    exists; it does not verify the statement is true.
                  </p>
                </>
              )}
              <span className="eyebrow">RETRIEVED EVIDENCE</span>
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
                    No query matches. Add more relevant evidence.
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
            <strong>A useful answer starts with a trace.</strong>
            <p>
              Choose a case or import your own evidence, then start an
              investigation.
            </p>
          </div>
          <ArrowUpRight size={18} />
        </section>
      )}
      <footer>
        <span>Built for the moment after “it failed.”</span>
        <div>
          <a
            href={`${REPO}/blob/main/docs/INTERVIEW.zh-CN.md`}
            target="_blank"
            rel="noreferrer"
          >
            中文项目讲解 <ArrowUpRight size={11} />
          </a>
          <a
            href={`${REPO}/blob/main/docs/ARCHITECTURE.md`}
            target="_blank"
            rel="noreferrer"
          >
            How it works <ArrowUpRight size={11} />
          </a>
          <span>MIT · No keys · No subscription</span>
        </div>
      </footer>
    </main>
  );
}
