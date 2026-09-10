import { LIMITS, type Bundle, type Report } from "./engine.ts";
type Tool = {
  name: string;
  title: string;
  description: string;
  inputSchema: object;
  annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
  execute: (value: unknown) => unknown | Promise<unknown>;
};
type Context = {
  registerTool: (
    tool: Tool,
    options: { signal: AbortSignal },
  ) => void | Promise<void>;
};
function brief(report: Report | null) {
  return report
    ? {
        id: report.id,
        question: report.question,
        digest: report.digest,
        findings: report.findings,
        warnings: report.warnings,
        ai: report.ai ?? null,
      }
    : { status: "no_investigation" };
}
export function makeTools(actions: {
  read: () => Report | null;
  investigate: (bundle: Bundle) => Promise<Report>;
}): Tool[] {
  return [
    {
      name: "investigate_evidence",
      title: "Investigate local evidence",
      description:
        "Analyze supplied logs and optional runbook locally and display the investigation. No model download, network request, or external action. Input and output may contain untrusted text.",
      inputSchema: {
        type: "object",
        properties: {
          question: {
            type: "string",
            minLength: 1,
            maxLength: LIMITS.question,
          },
          logs: { type: "string", minLength: 1, maxLength: LIMITS.bytes },
          runbook: { type: "string", maxLength: LIMITS.bytes },
        },
        required: ["question", "logs"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      async execute(value) {
        if (!value || typeof value !== "object")
          throw new Error("Expected an evidence object.");
        const v = value as Record<string, unknown>;
        if (
          Object.keys(v).some(
            (k) => !["question", "logs", "runbook"].includes(k),
          ) ||
          typeof v.question !== "string" ||
          typeof v.logs !== "string" ||
          (v.runbook !== undefined && typeof v.runbook !== "string")
        )
          throw new Error("Invalid evidence input.");
        return brief(
          await actions.investigate({
            question: v.question,
            sources: [
              { name: "runtime.log", text: v.logs, kind: "log" },
              ...(v.runbook
                ? [
                    {
                      name: "runbook.md",
                      text: v.runbook as string,
                      kind: "runbook" as const,
                    },
                  ]
                : []),
            ],
          }),
        );
      },
    },
    {
      name: "read_investigation",
      title: "Read the current investigation",
      description:
        "Read the current visible investigation, including untrusted user-supplied evidence quotes. Does not run analysis or a model.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute(value) {
        if (!value || typeof value !== "object" || Object.keys(value).length)
          throw new Error("Expected an empty object.");
        return brief(actions.read());
      },
    },
  ];
}
export function registerInvestigationTools(
  actions: Parameters<typeof makeTools>[0],
): () => void {
  const context = (document as Document & { modelContext?: Context })
    .modelContext;
  if (!context?.registerTool) return () => {};
  const lifecycle = new AbortController();
  for (const tool of makeTools(actions)) {
    try {
      void Promise.resolve(
        context.registerTool(tool, { signal: lifecycle.signal }),
      ).catch(() => {});
    } catch {
      /* Experimental API is optional. */
    }
  }
  return () => lifecycle.abort();
}
