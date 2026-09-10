import type { Report } from "./engine.ts";
import { buildPrompt, validateHypotheses } from "./engine.ts";

export const LOCAL_MODEL = "Qwen2.5-0.5B-Instruct-q4f32_1-MLC";
export type Progress = { progress: number; text: string };
export type RunAI = { result: Promise<Report["ai"]>; cancel: () => void };

/** Each run owns its worker. Cancellation terminates download, generation and GPU work. */
export function runLocalAI(
  report: Report,
  onProgress: (p: Progress) => void,
): RunAI {
  const worker = new Worker(new URL("./model.worker.ts", import.meta.url), {
    type: "module",
  });
  let done = false;
  let fail: (reason: Error) => void = () => {};
  const started = performance.now();
  let timer: ReturnType<typeof setTimeout>;
  const cleanup = () => {
    done = true;
    clearTimeout(timer);
    worker.terminate();
  };
  const result = new Promise<Report["ai"]>((resolve, reject) => {
    fail = reject;
    // Includes initial model download. A user can cancel and retry on a faster connection.
    timer = setTimeout(() => {
      if (!done) {
        cleanup();
        reject(
          new Error(
            "Local AI exceeded its 10-minute download and generation budget. Evidence analysis is preserved.",
          ),
        );
      }
    }, 600_000);
    worker.onerror = () => {
      if (!done) {
        cleanup();
        reject(
          new Error(
            "The local model worker failed. Check WebGPU support and available memory.",
          ),
        );
      }
    };
    worker.onmessage = (event: MessageEvent) => {
      if (done) return;
      const msg = event.data;
      if (msg.type === "progress")
        onProgress({
          progress: Math.max(0, Math.min(1, msg.progress)),
          text: String(msg.text),
        });
      if (msg.type === "error") {
        cleanup();
        reject(new Error(String(msg.message)));
      }
      if (msg.type === "complete") {
        try {
          const prompt = buildPrompt(report);
          const { accepted, rejected } = validateHypotheses(
            JSON.parse(msg.text),
            prompt.evidence,
          );
          cleanup();
          resolve({
            model: LOCAL_MODEL,
            hypotheses: accepted,
            rejected,
            durationMs: Math.round(performance.now() - started),
          });
        } catch {
          cleanup();
          reject(
            new Error(
              "The local model returned invalid JSON. No unverified hypotheses were added.",
            ),
          );
        }
      }
    };
    const prompt = buildPrompt(report);
    worker.postMessage({
      model: LOCAL_MODEL,
      system: prompt.system,
      user: prompt.user,
    });
  });
  return {
    result,
    cancel: () => {
      if (!done) {
        cleanup();
        fail(
          new DOMException(
            "Local AI cancelled; your evidence report is unchanged.",
            "AbortError",
          ),
        );
      }
    },
  };
}
