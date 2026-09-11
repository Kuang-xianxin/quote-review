import type { Report } from "./engine.ts";
import { translate, type Locale } from "./i18n.ts";

/** Localize application-owned narration without changing the underlying evidence. */
export function localizeReport(report: Report, locale: Locale): Report {
  const t = (text: string) => translate(locale, text);
  return {
    ...report,
    summary: t(report.summary),
    findings: report.findings.map((f) => ({
      ...f,
      title: t(f.title),
      detail: t(f.detail),
      nextCheck: t(f.nextCheck),
    })),
    warnings: report.warnings.map(t),
    trace: report.trace.map((event) => ({
      ...event,
      stage: t(event.stage),
      detail: t(event.detail),
    })),
    ...(report.ai
      ? { ai: { ...report.ai, rejected: report.ai.rejected.map(t) } }
      : {}),
  };
}
