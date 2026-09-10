import type { Bundle } from "./engine.ts";
export type Case = {
  id: string;
  title: string;
  subtitle: string;
  question: string;
  logs: string;
  runbook: string;
  expected: string[];
};
export const CASES: Case[] = [
  {
    id: "retry-storm",
    title: "The retry storm",
    subtitle: "A support agent hits a rate limit.",
    question: "Why did the support agent fail despite retries?",
    logs: `2026-09-09T09:41:02Z INFO agent.run started trace=run-042 model=local-test
2026-09-09T09:41:03Z INFO search.documents completed trace=run-042 hits=8
2026-09-09T09:41:04Z WARN llm.request failed trace=run-042 status=429 Retry-After=30
2026-09-09T09:41:04Z WARN llm.request retry trace=run-042 attempt=2 delay_ms=0
2026-09-09T09:41:04Z WARN llm.request failed trace=run-042 status=429
2026-09-09T09:41:04Z WARN llm.request retry trace=run-042 attempt=3 delay_ms=0
2026-09-09T09:41:05Z ERROR agent.run deadline exceeded trace=run-042 budget_ms=3000
2026-09-09T09:41:06Z INFO unrelated.health status=200 trace=health-018`,
    runbook: `Provider rate limits: honor Retry-After before retrying a 429.
Retry budget: at most 3 attempts; bounded exponential backoff with jitter.
The run deadline includes retrieval, model calls, retries, and cleanup.
A successful health check does not establish success of an agent run.`,
    expected: ["rate-limit", "retry", "timeout"],
  },
  {
    id: "empty-context",
    title: "The missing answer",
    subtitle: "The search tool succeeds with no context.",
    question: "Why did retrieval fail to ground the generated answer?",
    logs: `2026-09-09T10:10:00Z INFO agent.run started trace=run-081 tenant=demo
2026-09-09T10:10:01Z INFO retrieve query="refund policy" tenant=demo index=policy-v3 hits=0
2026-09-09T10:10:01Z INFO context.assemble trace=run-081 context_chars=0
2026-09-09T10:10:02Z INFO llm.generate trace=run-081 status=completed tokens=180
2026-09-09T10:10:03Z ERROR answer.validate trace=run-081 citation_count=0 reason=missing_evidence`,
    runbook: `Retrieval requires documents indexed under the same tenant and index version.
When context is empty, abstain and request additional evidence.
A completed model response is not proof of answer correctness.`,
    expected: ["retrieval"],
  },
  {
    id: "cancel-leak",
    title: "The task that stayed",
    subtitle: "The user cancels. The worker carries on.",
    question: "What should we check after cancellation and a pool timeout?",
    logs: `2026-09-09T11:00:00Z INFO agent.run started trace=run-119 task=lookup-7
2026-09-09T11:00:01Z INFO pool.acquire trace=run-119 active=20 limit=20
2026-09-09T11:00:03Z WARN cancel_requested trace=run-119 reason=client_disconnect
2026-09-09T11:00:04Z INFO task.heartbeat trace=run-119 task=lookup-7
2026-09-09T11:00:05Z ERROR pool exhausted waiting=12 active=20 limit=20 trace=run-120
2026-09-09T11:00:08Z ERROR request timeout trace=run-120
2026-09-09T11:00:10Z INFO task.heartbeat trace=run-119 task=lookup-7`,
    runbook: `The run owns lookup tasks and must cancel and await them on disconnect.
Connection release must complete even when its caller is cancelled.
Confirm terminal task events and pool.release by trace ID. A cancel request alone is insufficient.`,
    expected: ["cancellation", "work-after-cancel", "pool", "timeout"],
  },
];
export function caseBundle(c: Case): Bundle {
  return {
    question: c.question,
    sources: [
      { name: "runtime.log", text: c.logs, kind: "log" },
      { name: "runbook.md", text: c.runbook, kind: "runbook" },
    ],
  };
}
