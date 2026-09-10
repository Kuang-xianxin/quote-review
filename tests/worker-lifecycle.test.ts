import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { runLocalAI } from "../core/local-ai.ts";
import { investigate } from "../core/engine.ts";
import { CASES, caseBundle } from "../core/fixtures.ts";
class OwnedWorker {
  static current: OwnedWorker;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  terminated = 0;
  constructor() {
    OwnedWorker.current = this;
  }
  postMessage() {}
  terminate() {
    this.terminated++;
  }
  emit(data: unknown) {
    this.onmessage?.({ data });
  }
}
function install(t: TestContext) {
  const old = Object.getOwnPropertyDescriptor(globalThis, "Worker");
  Object.defineProperty(globalThis, "Worker", {
    configurable: true,
    value: OwnedWorker,
  });
  t.after(() => {
    if (old) Object.defineProperty(globalThis, "Worker", old);
    else Reflect.deleteProperty(globalThis, "Worker");
  });
}
test("cancellation rejects and terminates the owned worker exactly once", async (t) => {
  install(t);
  const report = await investigate(caseBundle(CASES[0]));
  const run = runLocalAI(report, () => {});
  const rejected = assert.rejects(run.result, { name: "AbortError" });
  run.cancel();
  run.cancel();
  await rejected;
  OwnedWorker.current.emit({ type: "complete", text: '{"hypotheses":[]}' });
  assert.equal(OwnedWorker.current.terminated, 1);
});
test("invalid JSON cannot replace a completed evidence report", async (t) => {
  install(t);
  const report = await investigate(caseBundle(CASES[0]));
  const before = JSON.stringify(report);
  const run = runLocalAI(report, () => {});
  OwnedWorker.current.emit({ type: "complete", text: "not json" });
  await assert.rejects(run.result, /invalid JSON/);
  assert.equal(JSON.stringify(report), before);
  assert.equal(OwnedWorker.current.terminated, 1);
});
test("worker failure rejects and releases resources", async (t) => {
  install(t);
  const report = await investigate(caseBundle(CASES[0]));
  const run = runLocalAI(report, () => {});
  OwnedWorker.current.onerror?.();
  await assert.rejects(run.result, /worker failed/);
  assert.equal(OwnedWorker.current.terminated, 1);
});
test("completion validates citations before exposing hypotheses", async (t) => {
  install(t);
  const report = await investigate(caseBundle(CASES[0]));
  const run = runLocalAI(report, () => {});
  OwnedWorker.current.emit({
    type: "complete",
    text: JSON.stringify({
      hypotheses: [
        {
          title: "x",
          explanation: "x",
          nextCheck: "x",
          citations: [{ evidenceId: "E9999", quote: "nonexistent evidence" }],
        },
      ],
    }),
  });
  const result = await run.result;
  assert.equal(result?.hypotheses.length, 0);
  assert.equal(result?.rejected.length, 1);
  assert.equal(OwnedWorker.current.terminated, 1);
});

test("the total run budget terminates a stuck model worker", async (t) => {
  install(t);
  const report = await investigate(caseBundle(CASES[0]));
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const run = runLocalAI(report, () => {});
  const rejected = assert.rejects(run.result, /10-minute/);
  t.mock.timers.tick(600_001);
  await rejected;
  assert.equal(OwnedWorker.current.terminated, 1);
});
