import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  FileText,
  Upload,
  Plus,
  ArrowDownToLine,
  Trash2,
  Check,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import {
  reviewSchema,
  type ExtractionResult,
  type ReviewItem,
  type Offer,
} from "@/core/quotes";

type Translate = (zh: string, en: string) => string;
type Project = { id: string; name: string; created: number };
type Document = {
  id: string;
  filename: string;
  state: string;
  stage: string | null;
  error: string | null;
  result: ExtractionResult | null;
  review: ReviewItem[] | null;
  revision: number;
  supplier: string | null;
  shipping_note: string | null;
};
type Comparison = {
  groups: { key: string; currency: string; offers: Offer[] }[];
  pending: number;
};
type Health = {
  ok: boolean;
  worker_online: boolean;
  model: string | null;
  demo: boolean;
};
type Audit = {
  id: string;
  created: number;
  document: string;
  note: string;
  before_value: string;
  after_value: string;
};
const examples = [
  {
    name: "Harbor-Supply.txt",
    text: "Supplier: Harbor Supply\nCurrency: USD\nSKU: CUP-12\nProduct: Ceramic mug 350ml\nUnit price: USD 2.40 per piece\nMinimum order: 120 pieces\nLead time: 14 days\nShipping: quoted separately\n",
  },
  {
    name: "青禾工贸.txt",
    text: "供应商：青禾工贸\n币种：USD\n商品编号：CUP-12\n产品：350ml陶瓷杯\n报价：每箱48.00美元\n包装：每箱24件\n起订量：5箱\n交期：21天\n运费另计\n",
  },
];
const labels: Record<string, [string, string]> = {
  moq_unit_conflict: [
    "起订量单位与引用原文可能冲突",
    "MOQ unit may conflict with the source",
  ],
  currency_not_in_source: [
    "币种未匹配到明确原文，不要根据 $ 猜测",
    "No explicit currency evidence; do not infer it from $",
  ],
  document_instruction_text: [
    "文件中有指令性文字，请重点核对提取结果",
    "Instruction-like text found in the document; check extraction carefully",
  ],
  pack_basis_conflict: [
    "引用中有整箱或整包信息，请检查报价单位",
    "Pack wording in the source: check the price basis",
  ],
  moq_omitted: [
    "原文提到起订量，但模型未提取",
    "Minimum-order wording found, but the model omitted MOQ",
  ],
  moq_unit_unknown: ["起订量的单位未说明", "MOQ unit missing"],
  queued: ["排队中", "Queued"],
  processing: ["处理中", "Processing"],
  parsing: ["读取文件", "Reading file"],
  extracting: ["模型提取中", "Extracting"],
  validating: ["校验中", "Validating"],
  ready: ["待核对", "Needs review"],
  reviewed: ["已保存核对", "Review saved"],
  failed: ["处理失败", "Failed"],
  cancelled: ["已取消", "Cancelled"],
  file_too_large: [
    "文件不能为空，且须小于 500 KB。",
    "Choose a non-empty file under 500 KB.",
  ],
  unsupported_file: [
    "支持 PDF、XLSX、CSV、TXT 和 EML。",
    "Use PDF, XLSX, CSV, TXT or EML.",
  ],
  document_limit: ["每组最多 6 份文件。", "Maximum 6 files per comparison."],
  project_limit: [
    "最多保留 5 组，请先删除不用的组。",
    "Keep up to 5 comparisons. Delete an unused one first.",
  ],
  queue_full: [
    "当前任务较多，请稍后再试。",
    "The queue is full. Try again shortly.",
  ],
  demo_capacity: [
    "今日演示容量已满。",
    "Today's demo capacity has been reached.",
  ],
  revision_conflict: [
    "另一页面已保存了新版本。你的编辑仍在当前页面，请刷新核对后重新填写。",
    "Another tab saved a newer revision. Your edits remain here; reload and reconcile them before saving.",
  ],
  network_error: [
    "暂时无法连接服务，输入内容已保留。",
    "Cannot reach the server. Your input is preserved.",
  ],
  service_unavailable: [
    "服务暂时不可用，请重试。",
    "The service is temporarily unavailable. Please retry.",
  ],
  session_expired: [
    "会话已过期，请重新打开页面。",
    "Your session expired. Reload the page.",
  ],
  session_required: [
    "请刷新页面建立会话。",
    "Reload to establish your session.",
  ],
  scanned_pdf_needs_ocr: [
    "未读到文字。扫描件暂不支持，请使用文字 PDF 或表格。",
    "No text found. Scanned PDFs are not supported; use a text PDF or spreadsheet.",
  ],
  spreadsheet_formula_requires_values: [
    "表格含公式，请另存为纯数值后上传。",
    "The spreadsheet contains formulas. Export values before uploading.",
  ],
  model_or_worker_failed: [
    "模型提取未完成，可重试或换成较短的文件。",
    "Extraction did not finish. Retry or use a shorter document.",
  ],
  lease_exhausted: [
    "计算节点多次中断，请等待节点恢复后重试。",
    "The compute worker disconnected repeatedly. Retry when it is online.",
  ],
  currency_unknown: ["币种不明确", "Currency missing"],
  price_unit_unknown: ["报价单位不明确", "Price unit missing"],
  pack_size_unknown: ["包装件数不明确", "Pack size missing"],
  price_unknown: ["价格未确认", "Price missing"],
  unit_price_not_in_source: [
    "价格未匹配到引用原文",
    "Price not found in cited lines",
  ],
  pack_size_not_in_source: [
    "包装件数未匹配到引用原文",
    "Pack size not found in cited lines",
  ],
  moq_not_in_source: ["起订量未匹配到引用原文", "MOQ not found in cited lines"],
  lead_days_not_in_source: [
    "交期未匹配到引用原文",
    "Lead time not found in cited lines",
  ],
};
function label(code: string, t: Translate) {
  return labels[code]
    ? t(...labels[code])
    : t("处理受限", "Processing limit") + ` (${code})`;
}
async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      ...init,
      headers: {
        "x-requested-with": "quote-review",
        ...(typeof init.body === "string"
          ? { "content-type": "application/json" }
          : {}),
        ...init.headers,
      },
    });
  } catch {
    throw new Error("network_error");
  }
  const data = await response
    .json()
    .catch(() => ({ error: "service_unavailable" }));
  if (!response.ok) throw new Error(data.error || "service_unavailable");
  return data;
}
let sessionReady: Promise<unknown> | null = null;
function connect() {
  return (sessionReady ??= api("/session", { method: "POST" }).catch(
    (error) => {
      sessionReady = null;
      throw error;
    },
  ));
}
function money(value: string | null) {
  return value === null ? "—" : value.replace(/(\.\d*?[1-9])0+$|\.0+$/, "$1");
}

function ReviewEditor({
  doc,
  t,
  onSaved,
}: {
  doc: Document;
  t: Translate;
  onSaved: () => Promise<void>;
}) {
  const [items, setItems] = useState<ReviewItem[]>(doc.review ?? []);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [activeRow, setActiveRow] = useState(0);
  const [supplier, setSupplier] = useState(doc.supplier ?? "");
  const [shipping, setShipping] = useState(doc.shipping_note ?? "");
  const result = doc.result!;
  const change = (index: number, field: keyof ReviewItem, value: unknown) =>
    setItems((old) =>
      old.map((item, i) =>
        i === index
          ? {
              ...item,
              [field]: value,
              reviewed: field === "reviewed" ? Boolean(value) : false,
            }
          : item,
      ),
    );
  const save = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    const parsed = reviewSchema.safeParse({
      revision: doc.revision,
      note,
      items,
      supplier: supplier || null,
      shipping_note: shipping || null,
    });
    if (!parsed.success) {
      setError(
        t(
          "请填写核对说明，并检查商品名称、比价组、三位币种、价格和整数数量。",
          "Add a review note and check descriptions, groups, 3-letter currencies, prices and whole-number quantities.",
        ),
      );
      return;
    }
    setSaving(true);
    try {
      await api(`/documents/${doc.id}/review`, {
        method: "POST",
        body: JSON.stringify(parsed.data),
      });
      await onSaved();
    } catch (e) {
      setError(label((e as Error).message, t));
    } finally {
      setSaving(false);
    }
  };
  const field = (
    item: ReviewItem,
    index: number,
    key: keyof ReviewItem,
    zh: string,
    en: string,
    numeric = false,
  ) => (
    <label>
      {t(zh, en)}
      <input
        value={item[key] == null ? "" : String(item[key])}
        maxLength={key === "description" ? 200 : 100}
        inputMode={numeric ? "decimal" : "text"}
        onChange={(e) =>
          change(
            index,
            key,
            e.target.value === ""
              ? key === "description" || key === "group_key"
                ? ""
                : null
              : ["pack_size", "moq", "lead_days"].includes(key)
                ? Number(e.target.value)
                : key === "currency"
                  ? e.target.value.toUpperCase()
                  : e.target.value,
          )
        }
      />
    </label>
  );
  return (
    <form onSubmit={save} className="review-layout">
      <div className="review-fields">
        <div className="section-line">
          <h2>{t("核对提取结果", "Review extraction")}</h2>
          <span className="muted">
            {t("版本", "Revision")} {doc.revision}
          </span>
        </div>
        <p className="muted">
          {t(
            "逐项核对原文；修改任何字段后，需要重新勾选确认。相同商品请填写相同比价组。",
            "Check each row against the source. Editing a field clears its confirmation. Use the same group for equivalent products.",
          )}
        </p>
        <div className="fields">
          <label>
            {t("供应商", "Supplier")}
            <input
              maxLength={160}
              value={supplier}
              onChange={(e) => {
                setSupplier(e.target.value);
                setItems((old) =>
                  old.map((item) => ({ ...item, reviewed: false })),
                );
              }}
            />
          </label>
          <label>
            {t("运费 / 税费原文说明", "Shipping / tax terms")}
            <input
              maxLength={600}
              value={shipping}
              onChange={(e) => {
                setShipping(e.target.value);
                setItems((old) =>
                  old.map((item) => ({ ...item, reviewed: false })),
                );
              }}
            />
          </label>
        </div>
        {items.map((item, index) => (
          <section
            className={`review-item ${activeRow === index ? "active" : ""}`}
            key={index}
            onFocus={() => setActiveRow(index)}
          >
            <div className="section-line">
              <button
                type="button"
                className="text-button"
                onClick={() => setActiveRow(index)}
              >
                {t("商品", "Item")} {index + 1} ·{" "}
                {t("查看引用", "View sources")}
              </button>
              <label className="check-label">
                <Checkbox
                  checked={item.reviewed}
                  onCheckedChange={(checked) =>
                    change(index, "reviewed", checked === true)
                  }
                />
                {t("已逐项核对", "Checked against source")}
              </label>
            </div>
            {result.checks.filter((check) => check.item === index).length >
              0 && (
              <ul className="checks">
                {result.checks
                  .filter((check) => check.item === index)
                  .map((check) => (
                    <li key={check.code}>{label(check.code, t)}</li>
                  ))}
              </ul>
            )}
            <div className="fields">
              <div className="span-two">
                {field(
                  item,
                  index,
                  "description",
                  "商品名称 / 规格",
                  "Product / specification",
                )}
              </div>
              {field(item, index, "sku", "商品编号", "SKU")}
              {field(item, index, "group_key", "比价组", "Comparison group")}
              {field(
                item,
                index,
                "currency",
                "币种（如 USD）",
                "Currency (e.g. USD)",
              )}
              {field(
                item,
                index,
                "unit_price",
                "原始报价",
                "Quoted price",
                true,
              )}
              <label>
                {t("报价单位", "Price unit")}
                <select
                  className="unit-select"
                  value={item.price_unit ?? "unknown"}
                  onChange={(e) =>
                    change(
                      index,
                      "price_unit",
                      e.target.value === "unknown" ? null : e.target.value,
                    )
                  }
                >
                  <option value="unknown">
                    {t("未说明", "Not specified")}
                  </option>
                  <option value="each">{t("每件", "Per each")}</option>
                  <option value="pack">
                    {t("每包装 / 箱", "Per pack / carton")}
                  </option>
                </select>
              </label>
              {field(
                item,
                index,
                "pack_size",
                "每包装件数",
                "Units per pack",
                true,
              )}
              {field(item, index, "moq", "起订量", "Minimum order", true)}
              <label>
                {t("起订量单位", "MOQ unit")}
                <select
                  className="unit-select"
                  value={item.moq_unit ?? "unknown"}
                  onChange={(e) =>
                    change(
                      index,
                      "moq_unit",
                      e.target.value === "unknown" ? null : e.target.value,
                    )
                  }
                >
                  <option value="unknown">
                    {t("未说明", "Not specified")}
                  </option>
                  <option value="each">{t("件", "Each")}</option>
                  <option value="pack">
                    {t("包装 / 箱", "Pack / carton")}
                  </option>
                </select>
              </label>
              {field(
                item,
                index,
                "lead_days",
                "交期（天）",
                "Lead time (days)",
                true,
              )}
            </div>
            <p className="small muted">
              {t(
                "空白表示原文未明确说明，不应按 0 处理。",
                "Blank means unspecified, not zero.",
              )}
            </p>
          </section>
        ))}
        <button
          type="button"
          disabled={items.length >= 40}
          onClick={() =>
            setItems((old) => [
              ...old,
              {
                description: "",
                sku: null,
                currency: null,
                unit_price: null,
                price_unit: null,
                pack_size: null,
                moq: null,
                moq_unit: null,
                lead_days: null,
                group_key: "",
                reviewed: false,
              },
            ])
          }
        >
          <Plus size={16} />
          {t("补录遗漏商品", "Add a missed item")}
        </button>
        <label>
          {t("核对说明", "Review note")}
          <textarea
            required
            maxLength={500}
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t(
              "例如：已核对原文，确认每箱 24 件；币种为 USD。",
              "e.g. Checked the source: 24 pieces per carton, currency USD.",
            )}
          />
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="primary" disabled={saving}>
          <Check size={17} />
          {saving ? t("保存中…", "Saving…") : t("保存核对", "Save review")}
        </button>
      </div>
      <aside className="source-panel">
        <div className="section-line">
          <h2>{t("引用原文", "Source text")}</h2>
          <a
            href={`/api/documents/${doc.id}/source`}
            className="icon-link"
            aria-label={t("下载原文件", "Download original")}
          >
            <ArrowDownToLine size={18} />
          </a>
        </div>
        <p className="muted">{doc.filename}</p>
        <div className="source-lines">
          {result.lines.map((line) => (
            <div
              key={line.id}
              className={
                result.extraction.items[activeRow]?.source_ids.includes(line.id)
                  ? "cited"
                  : ""
              }
            >
              <span>
                {line.id} · {line.locator}
              </span>
              <p>{line.text}</p>
            </div>
          ))}
        </div>
        <details>
          <summary>{t("提取记录", "Extraction record")}</summary>
          <p>
            {result.model} · {(result.duration_ms / 1000).toFixed(1)} s
          </p>
          <p>
            {t(
              "高亮是模型给出的引用范围，不能单独证明内容正确。",
              "Highlighting shows the model's citations; it does not prove correctness.",
            )}
          </p>
        </details>
      </aside>
    </form>
  );
}

export default function QuoteApp() {
  const [locale, setLocale] = useState(() =>
    new URLSearchParams(location.search).get("lang") === "zh-CN"
      ? "zh-CN"
      : new URLSearchParams(location.search).get("lang") === "en"
        ? "en"
        : localStorage.getItem("quote-language") ||
          (navigator.language.startsWith("zh") ? "zh-CN" : "en"),
  );
  const t: Translate = (zh, en) => (locale === "zh-CN" ? zh : en);
  const [health, setHealth] = useState<Health | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [comparison, setComparison] = useState<Comparison>({
    groups: [],
    pending: 0,
  });
  const [events, setEvents] = useState<Audit[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [booting, setBooting] = useState(true);
  const [tab, setTab] = useState("review");
  const fileInput = useRef<HTMLInputElement>(null);
  const activeProject = useRef(projectId);
  activeProject.current = projectId;
  const selected =
    documents.find((doc) => doc.id === selectedId) ?? documents[0];
  const project = projects.find((p) => p.id === projectId);
  useEffect(() => {
    document.documentElement.lang = locale;
    document.title =
      locale === "zh-CN" ? "报价核验 · Quote Review" : "Quote Review";
    localStorage.setItem("quote-language", locale);
    const url = new URL(location.href);
    url.searchParams.set("lang", locale);
    history.replaceState(null, "", url);
  }, [locale]);
  const refresh = useCallback(async () => {
    if (!projectId) return;
    const [detail, compare, audit] = await Promise.all([
      api<{ documents: Document[] }>(`/projects/${projectId}`),
      api<Comparison>(`/projects/${projectId}/compare`),
      api<{ events: Audit[] }>(`/projects/${projectId}/audit`),
    ]);
    if (activeProject.current !== projectId) return;
    setDocuments(detail.documents);
    setComparison(compare);
    setEvents(audit.events);
  }, [projectId]);
  const start = useCallback(async () => {
    setBooting(true);
    setError("");
    try {
      await connect();
      const [h, ps] = await Promise.all([
        api<Health>("/health"),
        api<{ projects: Project[] }>("/projects"),
      ]);
      setHealth(h);
      setProjects(ps.projects);
      setProjectId((old) => old || ps.projects[0]?.id || "");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBooting(false);
    }
  }, []);
  useEffect(() => {
    void start();
  }, [start]);
  useEffect(() => {
    void refresh().catch((e) => setError(e.message));
  }, [refresh]);
  useEffect(() => {
    const timer = setInterval(() => {
      void api<Health>("/health")
        .then(setHealth)
        .catch(() => setHealth(null));
      if (documents.some((doc) => ["queued", "processing"].includes(doc.state)))
        void refresh().catch((e) => setError(e.message));
    }, 5000);
    return () => clearInterval(timer);
  }, [refresh, documents]);
  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await work();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const create = async (event: FormEvent) => {
    event.preventDefault();
    await run(async () => {
      const created = await api<Project>("/projects", {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      setProjects((old) => [created, ...old]);
      setDocuments([]);
      setSelectedId("");
      setProjectId(created.id);
      setName("");
      setTab("review");
    });
  };
  const upload = async (files: File[]) =>
    run(async () => {
      for (const file of files) {
        const form = new FormData();
        form.set("file", file);
        await api(`/projects/${projectId}/documents`, {
          method: "POST",
          body: form,
        });
      }
      await refresh();
      if (fileInput.current) fileInput.current.value = "";
    });
  const remove = async () =>
    run(async () => {
      await api(`/projects/${projectId}`, { method: "DELETE" });
      setProjects((old) => old.filter((p) => p.id !== projectId));
      setProjectId("");
      setDocuments([]);
      setComparison({ groups: [], pending: 0 });
      setEvents([]);
    });
  return (
    <div className="workbench">
      <header className="topbar">
        <div className="brand">
          <FileText size={22} />
          <strong>{t("报价核验", "Quote Review")}</strong>
        </div>
        <div className="top-actions">
          <span className={`service ${health?.worker_online ? "online" : ""}`}>
            {health?.worker_online
              ? t("提取服务在线", "Extraction online")
              : health
                ? t("提取服务离线", "Extraction offline")
                : t("连接服务中", "Connecting")}
          </span>
          <button
            onClick={() => setLocale(locale === "zh-CN" ? "en" : "zh-CN")}
          >
            {locale === "zh-CN" ? "English" : "中文"}
          </button>
          <a
            className="icon-link"
            href="https://github.com/Kuang-xianxin/quote-review"
            target="_blank"
            rel="noreferrer"
            aria-label={t("查看开源代码", "View source code")}
          >
            <ExternalLink size={18} />
          </a>
        </div>
      </header>
      <div className="workspace-grid">
        <aside className="project-panel">
          <h2>{t("我的比价组", "My comparisons")}</h2>
          <form onSubmit={create} className="create-form">
            <label className="sr-only" htmlFor="project-name">
              {t("新建比价组名称", "New comparison name")}
            </label>
            <input
              id="project-name"
              required
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("例如：陶瓷杯采购", "e.g. Ceramic mug sourcing")}
            />
            <button disabled={busy || booting} aria-label={t("新建", "Create")}>
              <Plus size={18} />
            </button>
          </form>
          <nav aria-label={t("比价组", "Comparisons")}>
            {projects.map((p) => (
              <button
                key={p.id}
                className={p.id === projectId ? "selected" : ""}
                aria-current={p.id === projectId ? "page" : undefined}
                onClick={() => {
                  setProjectId(p.id);
                  setDocuments([]);
                  setSelectedId("");
                  setTab("review");
                }}
              >
                {p.name}
              </button>
            ))}
          </nav>
          <details className="privacy">
            <summary>{t("资料与使用说明", "Data & usage")}</summary>
            <p>
              {t(
                "文件保存在服务端，用当前浏览器的私有会话访问。清除 Cookie 或会话 7 天到期后将无法再次访问。过期资料会在计算节点下次运行时清理；请及时导出。",
                "Files are stored on the server and accessed through this browser's private session. Clearing cookies or the session expiring after 7 days removes access. Expired data is deleted when the compute worker next runs. Export when finished.",
              )}
            </p>
            <p>
              {t(
                "公开演示请只使用样例或脱敏资料。运营者的计算节点会读取文件并运行本地模型。",
                "Use sample or redacted data in this public demo. The operator's compute worker reads files and runs a local model.",
              )}
            </p>
            <p>
              {t(
                "每组最多 6 份文件，每份 500 KB。支持文字 PDF、XLSX、CSV、TXT、纯文本 EML；暂不支持扫描件和公式单元格。",
                "Up to 6 files per comparison, 500 KB each. Text PDFs, XLSX, CSV, TXT and plain-text EML are supported. Scans and formula cells are not supported yet.",
              )}
            </p>
          </details>
        </aside>
        <main>
          {error && (
            <div className="error global-error" role="alert">
              <span>{label(error, t)}</span>
              <button
                onClick={() =>
                  void (health
                    ? refresh().catch((e) => setError(e.message))
                    : start())
                }
              >
                <RefreshCw size={16} />
                {t("重试", "Retry")}
              </button>
            </div>
          )}
          {booting ? (
            <div className="empty">
              {t("正在加载工作区…", "Loading workspace…")}
            </div>
          ) : !project ? (
            <div className="welcome">
              <span className="eyebrow">
                {t("供应商报价工作台", "SUPPLIER QUOTATIONS")}
              </span>
              <h1>{t("先核对，再比较。", "Review before comparing.")}</h1>
              <p>
                {t(
                  "把分散在文件里的报价放到一起，检查规格、包装和价格，再导出已确认的比较结果。",
                  "Bring supplier quotes together, check specifications, packaging and prices, then export a comparison you have verified.",
                )}
              </p>
              <p className="muted">
                {t(
                  "在左侧新建一个比价组，然后上传文件，或载入中英文样例。",
                  "Create a comparison on the left, then upload files or load the bilingual samples.",
                )}
              </p>
            </div>
          ) : (
            <>
              <div className="workspace-title">
                <div>
                  <span className="eyebrow">{t("采购比价", "SOURCING")}</span>
                  <h1>{project.name}</h1>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button className="quiet" disabled={busy}>
                      <Trash2 size={16} />
                      {t("删除组", "Delete")}
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogTitle>
                      {t("删除此比价组？", "Delete this comparison?")}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      {t(
                        "原始文件、提取结果和核对记录都会删除。此操作不可撤销。",
                        "Original files, extraction results and review history will be deleted. This cannot be undone.",
                      )}
                    </AlertDialogDescription>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t("保留", "Keep")}</AlertDialogCancel>
                      <AlertDialogAction onClick={() => void remove()}>
                        {t("删除", "Delete")}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
              {!health?.worker_online && (
                <p className="notice">
                  {t(
                    "计算节点暂时离线。已保存的资料仍可核对和导出，新提取任务会等待节点恢复。",
                    "The compute worker is offline. Saved results remain available for review and export; new extractions will wait until it returns.",
                  )}
                </p>
              )}
              <Tabs value={tab} onValueChange={setTab}>
                <TabsList className="main-tabs">
                  <TabsTrigger value="review">
                    {t("文件与核对", "Files & review")}{" "}
                    <span>{documents.length}</span>
                  </TabsTrigger>
                  <TabsTrigger value="compare">
                    {t("报价比较", "Compare")}{" "}
                    <span>{comparison.groups.length}</span>
                  </TabsTrigger>
                  <TabsTrigger value="history">
                    {t("核对记录", "Review history")}
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="review">
                  <div className="upload-row">
                    <button
                      className="primary"
                      onClick={() => fileInput.current?.click()}
                      disabled={busy || documents.length >= 6}
                    >
                      <Upload size={17} />
                      {busy
                        ? t("处理中…", "Working…")
                        : t("上传报价", "Upload quotes")}
                    </button>
                    <input
                      ref={fileInput}
                      className="sr-only"
                      type="file"
                      accept=".pdf,.xlsx,.csv,.txt,.eml"
                      multiple
                      aria-label={t("选择报价文件", "Choose quotation files")}
                      onChange={(e) => {
                        if (e.target.files)
                          void upload(Array.from(e.target.files));
                      }}
                    />
                    <span className="muted small">
                      PDF · XLSX · CSV · TXT · EML · 500 KB
                    </span>
                    {documents.length === 0 && (
                      <button
                        onClick={() =>
                          void upload(
                            examples.map(
                              (example) =>
                                new File([example.text], example.name, {
                                  type: "text/plain",
                                }),
                            ),
                          )
                        }
                        disabled={busy}
                      >
                        {t("载入中英文样例", "Load bilingual samples")}
                      </button>
                    )}
                  </div>
                  {documents.length === 0 ? (
                    <div className="empty">
                      <FileText size={28} />
                      <p>{t("还没有报价文件", "No quotations yet")}</p>
                      <span className="muted">
                        {t(
                          "样例为虚构报价；载入后会实际调用模型提取。",
                          "Samples are fictional quotations. Loading them runs a real model extraction.",
                        )}
                      </span>
                    </div>
                  ) : (
                    <>
                      <div
                        className="documents"
                        aria-label={t("报价文件", "Quotation files")}
                      >
                        {documents.map((doc) => (
                          <button
                            key={doc.id}
                            className={
                              selected?.id === doc.id ? "selected" : ""
                            }
                            onClick={() => setSelectedId(doc.id)}
                          >
                            <FileText size={17} />
                            <span>{doc.filename}</span>
                            <span className={`state state-${doc.state}`}>
                              {label(
                                doc.state === "processing" && doc.stage
                                  ? doc.stage
                                  : doc.state,
                                t,
                              )}
                            </span>
                          </button>
                        ))}
                      </div>
                      {selected?.result && (
                        <ReviewEditor
                          key={`${selected.id}:${selected.revision}`}
                          doc={selected}
                          t={t}
                          onSaved={refresh}
                        />
                      )}
                      {selected && !selected.result && (
                        <div className="empty">
                          <p>
                            {label(
                              selected.state === "processing" && selected.stage
                                ? selected.stage
                                : selected.state,
                              t,
                            )}
                          </p>
                          {selected.error && (
                            <p className="error">{label(selected.error, t)}</p>
                          )}
                          <p className="muted">
                            {t(
                              "提取在后台进行，刷新页面不会丢失任务。小型本地模型可能需要几十秒至数分钟。",
                              "Extraction runs in the background and survives refresh. The small local model may take tens of seconds to a few minutes.",
                            )}
                          </p>
                          <button
                            disabled={busy}
                            onClick={() =>
                              void run(async () => {
                                await api(
                                  `/documents/${selected.id}/${["failed", "cancelled"].includes(selected.state) ? "retry" : "cancel"}`,
                                  { method: "POST" },
                                );
                                await refresh();
                              })
                            }
                          >
                            {["failed", "cancelled"].includes(selected.state)
                              ? t("重新提取", "Retry extraction")
                              : t("取消任务", "Cancel task")}
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </TabsContent>
                <TabsContent value="compare">
                  <div className="compare-header">
                    <div>
                      <h2>{t("已确认的报价", "Verified quotes")}</h2>
                      <p className="muted">
                        {t(
                          "按相同比价组、相同币种比较每件价格，不含运费和税费。包装、起订量和交期仍需一起考虑。",
                          "Compare per-piece prices within the same group and currency, excluding freight and tax. Consider packaging, minimum orders and lead time as well.",
                        )}
                      </p>
                    </div>
                    <a
                      className={`button ${comparison.groups.length ? "" : "disabled"}`}
                      href={`/api/projects/${projectId}/export?lang=${locale}`}
                      onClick={(e) => {
                        if (!comparison.groups.length) e.preventDefault();
                      }}
                    >
                      <ArrowDownToLine size={17} />
                      {t("导出 CSV", "Export CSV")}
                    </a>
                  </div>
                  {comparison.pending > 0 && (
                    <p className="notice">
                      {t(
                        `还有 ${comparison.pending} 条商品未确认，暂未纳入比较。`,
                        `${comparison.pending} item(s) still need review and are excluded.`,
                      )}
                    </p>
                  )}
                  {comparison.groups.length === 0 && (
                    <div className="empty">
                      {t(
                        "先在“文件与核对”中确认商品并保存。",
                        "Confirm items in Files & review and save them first.",
                      )}
                    </div>
                  )}
                  {comparison.groups.map((group) => (
                    <section
                      className="comparison-group"
                      key={`${group.key}:${group.currency}`}
                    >
                      <div className="section-line">
                        <h3>{group.key}</h3>
                        <span className="state">{group.currency}</span>
                      </div>
                      <div className="table-scroll">
                        <table>
                          <thead>
                            <tr>
                              {[
                                t("供应商 / 规格", "Supplier / product"),
                                t("原始报价", "Quoted price"),
                                t("每件单价", "Price per each"),
                                t("起订量", "Minimum order"),
                                t("交期", "Lead time"),
                                t("运费说明", "Shipping terms"),
                              ].map((title) => (
                                <th key={title}>{title}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {group.offers.map((offer) => (
                              <tr
                                key={`${offer.document_id}:${offer.item_index}`}
                              >
                                <td>
                                  <button
                                    className="text-button"
                                    onClick={() => {
                                      setSelectedId(offer.document_id);
                                      setTab("review");
                                    }}
                                  >
                                    {offer.supplier}
                                  </button>
                                  <div className="small muted">
                                    {offer.description}
                                  </div>
                                </td>
                                <td>
                                  {money(offer.unit_price)} /{" "}
                                  {offer.price_unit === "pack"
                                    ? t("包装", "pack")
                                    : offer.price_unit === "each"
                                      ? t("件", "each")
                                      : "?"}
                                  {offer.price_unit === "pack" && (
                                    <div className="small muted">
                                      {offer.pack_size ?? "?"}{" "}
                                      {t("件 / 包装", "each / pack")}
                                    </div>
                                  )}
                                </td>
                                <td className="price">
                                  {money(offer.price_each)}
                                  {offer.issues.map((issue) => (
                                    <div className="small error" key={issue}>
                                      {label(issue, t)}
                                    </div>
                                  ))}
                                </td>
                                <td>
                                  {offer.moq ?? "—"}{" "}
                                  {offer.moq
                                    ? offer.moq_unit === "pack"
                                      ? t("包装", "packs")
                                      : offer.moq_unit === "each"
                                        ? t("件", "each")
                                        : "?"
                                    : ""}
                                </td>
                                <td>
                                  {offer.lead_days === null
                                    ? "—"
                                    : `${offer.lead_days} ${t("天", "days")}`}
                                </td>
                                <td className="terms">
                                  {offer.shipping_note || "—"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  ))}
                </TabsContent>
                <TabsContent value="history">
                  <h2>{t("人工核对记录", "Human review history")}</h2>
                  {events.length === 0 ? (
                    <div className="empty">
                      {t(
                        "保存核对后，修改记录会出现在这里。",
                        "Your review history will appear here after saving.",
                      )}
                    </div>
                  ) : (
                    events.map((event) => (
                      <details className="audit-event" key={event.id}>
                        <summary>
                          <time>
                            {new Date(event.created * 1000).toLocaleString(
                              locale,
                            )}
                          </time>{" "}
                          · {event.note}
                        </summary>
                        <div className="audit-diff">
                          <div>
                            <h3>{t("修改前", "Before")}</h3>
                            <pre>
                              {JSON.stringify(
                                JSON.parse(event.before_value),
                                null,
                                2,
                              )}
                            </pre>
                          </div>
                          <div>
                            <h3>{t("修改后", "After")}</h3>
                            <pre>
                              {JSON.stringify(
                                JSON.parse(event.after_value),
                                null,
                                2,
                              )}
                            </pre>
                          </div>
                        </div>
                      </details>
                    ))
                  )}
                </TabsContent>
              </Tabs>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
