import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { api } from "../server/api.ts";
import { LocalDatabase, LocalBucket } from "../server/local-platform.ts";
import {
  compareDocuments,
  initialReview,
  validateExtraction,
  csvCell,
  type ExtractionResult,
} from "../core/quotes.ts";
import { type Env } from "../server/platform.ts";

const extraction = {
  supplier: "Sample",
  shipping_note: "extra",
  items: [
    {
      description: "Mug",
      sku: "M1",
      currency: "USD",
      unit_price: "48.00",
      price_unit: "pack",
      pack_size: 24,
      moq: 5,
      moq_unit: "pack",
      lead_days: 21,
      source_ids: ["L1"],
    },
  ],
};
const lines = [
  {
    id: "L1",
    locator: "row 1",
    text: "M1 | Mug | USD 48.00/carton | 24 pieces/carton | MOQ 5 cartons | Lead time 21 days",
  },
];
const result: ExtractionResult = {
  ...validateExtraction(extraction, lines),
  model: "test-double",
  duration_ms: 1,
  warnings: [],
};
async function setup(t: test.TestContext) {
  const dir = await mkdtemp(join(tmpdir(), "quote-review-test-"));
  const db = new LocalDatabase(join(dir, "db.sqlite"));
  await db.migrate(resolve("drizzle"));
  const env: Env = {
    DB: db,
    QUOTES: new LocalBucket(join(dir, "blobs")),
    WORKER_TOKEN: "test-worker-token-".repeat(4),
  };
  t.after(async () => {
    db.close();
    assert.ok(dir.startsWith(join(tmpdir(), "quote-review-test-")));
    await rm(dir, { recursive: true, force: true });
  });
  const request = (
    path: string,
    method = "GET",
    body?: unknown,
    cookie = "",
    worker = false,
  ) =>
    api(
      new Request("https://quotes.test/api" + path, {
        method,
        headers: {
          "x-requested-with": "quote-review",
          ...(worker
            ? { authorization: `Bearer ${env.WORKER_TOKEN}` }
            : { cookie }),
          ...(body instanceof FormData
            ? {}
            : { "content-type": "application/json" }),
        },
        ...(body
          ? { body: body instanceof FormData ? body : JSON.stringify(body) }
          : {}),
      }),
      env,
    );
  const session = async () =>
    (await request("/session", "POST")).headers
      .get("set-cookie")!
      .split(";")[0];
  const cookie = await session();
  const project = (
    await (await request("/projects", "POST", { name: "Test" }, cookie)).json()
  ).id;
  const upload = async (content = "sample quote") => {
    const form = new FormData();
    form.set("file", new File([content], "quote.txt"));
    const response = await request(
      `/projects/${project}/documents`,
      "POST",
      form,
      cookie,
    );
    return { status: response.status, ...(await response.json()) };
  };
  const claim = async () =>
    (await (await request("/worker/claim", "POST", undefined, "", true)).json())
      .job;
  const complete = (job: Record<string, string>) =>
    request(
      `/worker/jobs/${job.id}/complete`,
      "POST",
      {
        lease: job.lease_token,
        source_sha256: job.digest,
        extraction,
        lines,
        model: "test-double",
        duration_ms: 1,
        warnings: [],
      },
      "",
      true,
    );
  return {
    db,
    env,
    request,
    session,
    cookie,
    project,
    upload,
    claim,
    complete,
  };
}

test("private sessions isolate project, source, audit, export and mutations", async (t) => {
  const s = await setup(t);
  const doc = await s.upload();
  const stranger = await s.session();
  for (const path of [
    `/projects/${s.project}`,
    `/projects/${s.project}/export`,
    `/projects/${s.project}/audit`,
    `/documents/${doc.id}/source`,
  ])
    assert.equal(
      (await s.request(path, "GET", undefined, stranger)).status,
      404,
    );
  assert.equal(
    (await s.request(`/projects/${s.project}`, "DELETE", undefined, stranger))
      .status,
    404,
  );
  assert.equal(
    (
      await api(
        new Request("https://quotes.test/api/projects", {
          method: "POST",
          headers: {
            cookie: s.cookie,
            origin: "https://attacker.test",
            "x-requested-with": "quote-review",
          },
        }),
        s.env,
      )
    ).status,
    403,
  );
  assert.equal((await s.request("/worker/claim", "POST")).status, 401);
});

test("concurrent uploads deduplicate and never exceed the document cap", async (t) => {
  const s = await setup(t);
  const duplicates = await Promise.all([s.upload(), s.upload()]);
  assert.equal(duplicates[0].id, duplicates[1].id);
  const uploads = await Promise.all(
    Array.from({ length: 9 }, (_, i) => s.upload(`different ${i}`)),
  );
  assert.equal(uploads.filter((r) => r.status === 201).length, 5);
  assert.equal(
    (await s.db.prepare("SELECT COUNT(*) AS n FROM qr_documents").first())?.n,
    6,
  );
  assert.equal(
    (await s.db.prepare("SELECT COUNT(*) AS n FROM qr_jobs").first())?.n,
    6,
  );
});

test("only one worker claims a job; expired lease and cancelled completions are fenced", async (t) => {
  const s = await setup(t);
  const doc = await s.upload();
  const claims = await Promise.all([s.claim(), s.claim()]);
  assert.equal(claims.filter(Boolean).length, 1);
  const first = claims.find(Boolean);
  await s.db
    .prepare("UPDATE qr_jobs SET lease_until=0 WHERE id=?")
    .bind(first.id)
    .run();
  const second = await s.claim();
  assert.notEqual(first.lease_token, second.lease_token);
  assert.equal(second.attempt, 2);
  assert.equal((await s.complete(first)).status, 409);
  await s.request(`/documents/${doc.id}/cancel`, "POST", undefined, s.cookie);
  assert.equal((await s.complete(second)).status, 409);
  const detail = await (
    await s.request(`/projects/${s.project}`, "GET", undefined, s.cookie)
  ).json();
  assert.equal(detail.documents[0].state, "cancelled");
});

test("completion is idempotent; review revision and audit change atomically", async (t) => {
  const s = await setup(t);
  const doc = await s.upload();
  const job = await s.claim();
  assert.equal((await s.complete(job)).status, 200);
  assert.equal((await s.complete(job)).status, 200);
  const before = await (
    await s.request(
      `/projects/${s.project}/compare`,
      "GET",
      undefined,
      s.cookie,
    )
  ).json();
  assert.equal(before.groups.length, 0);
  assert.equal(before.pending, 1);
  const review = {
    revision: 2,
    note: "Confirmed original carton size",
    items: initialReview(result).map((item) => ({ ...item, reviewed: true })),
  };
  const saves = await Promise.all([
    s.request(`/documents/${doc.id}/review`, "POST", review, s.cookie),
    s.request(`/documents/${doc.id}/review`, "POST", review, s.cookie),
  ]);
  assert.deepEqual(saves.map((r) => r.status).sort(), [200, 409]);
  const history = await (
    await s.request(`/projects/${s.project}/audit`, "GET", undefined, s.cookie)
  ).json();
  assert.equal(history.events.length, 1);
  const comparison = await (
    await s.request(
      `/projects/${s.project}/compare`,
      "GET",
      undefined,
      s.cookie,
    )
  ).json();
  assert.equal(comparison.groups[0].offers[0].price_each, "2.00000000");
  const csv = await (
    await s.request(
      `/projects/${s.project}/export?lang=zh-CN`,
      "GET",
      undefined,
      s.cookie,
    )
  ).text();
  assert.match(csv, /不含运费税费/);
  assert.match(csv, /起订量单位/);
});

test("deleting a comparison removes its files, queued work and records", async (t) => {
  const s = await setup(t);
  const doc = await s.upload();
  const row = await s.db
    .prepare("SELECT blob FROM qr_documents WHERE id=?")
    .bind(doc.id)
    .first();
  assert.equal(
    (await s.request(`/projects/${s.project}`, "DELETE", undefined, s.cookie))
      .status,
    200,
  );
  assert.equal(await s.env.QUOTES.get(String(row?.blob)), null);
  assert.equal(await s.claim(), null);
});

test("expired anonymous data is cleaned by the worker before claiming", async (t) => {
  const s = await setup(t);
  await s.upload();
  await s.db.prepare("UPDATE qr_sessions SET expires=0").run();
  assert.equal(await s.claim(), null);
  for (const table of ["qr_sessions", "qr_projects", "qr_documents", "qr_jobs"])
    assert.equal(
      (await s.db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first())?.n,
      0,
    );
});

test("same-currency, reviewed offers normalize explicit packaging with decimal arithmetic", () => {
  const items = initialReview(result).map((item) => ({
    ...item,
    reviewed: true,
  }));
  const compared = compareDocuments([
    { id: "a", filename: "a", result, review: items },
    {
      id: "b",
      filename: "b",
      result,
      review: items.map((item) => ({
        ...item,
        currency: "EUR",
        pack_size: 12,
      })),
    },
    {
      id: "c",
      filename: "c",
      result,
      review: items.map((item) => ({ ...item, pack_size: null })),
    },
  ]);
  assert.equal(compared.groups.length, 2);
  assert.equal(compared.groups[0].offers[0].price_each, "2.00000000");
  assert.equal(compared.groups[0].offers[1].price_each, null);
  assert.equal(compared.groups[1].offers[0].price_each, "4.00000000");
  assert.equal(csvCell(' =HYPERLINK("x")'), '"\' =HYPERLINK(""x"")"');
});

test("source validation rejects fabricated citations and flags unsupported numbers / unit conflict", () => {
  assert.throws(
    () =>
      validateExtraction(
        {
          ...extraction,
          items: [{ ...extraction.items[0], source_ids: ["L999"] }],
        },
        lines,
      ),
    /unknown_source_id/,
  );
  const output = validateExtraction(
    {
      ...extraction,
      items: [
        {
          ...extraction.items[0],
          price_unit: "each",
          unit_price: "49",
          moq: null,
        },
      ],
    },
    [{ ...lines[0], text: "每箱48，MOQ 5 cartons" }],
  );
  assert.ok(output.checks.some((c) => c.code === "pack_basis_conflict"));
  assert.ok(output.checks.some((c) => c.code === "unit_price_not_in_source"));
  assert.ok(output.checks.some((c) => c.code === "moq_omitted"));
});

test("manual corrections and added rows preserve the original model proposal", async (t) => {
  const s = await setup(t);
  const doc = await s.upload();
  const job = await s.claim();
  await s.complete(job);
  const items = initialReview(result).map((item) => ({
    ...item,
    reviewed: true,
  }));
  items.push({ ...items[0], sku: "M2", group_key: "M2", unit_price: "72.00" });
  const saved = await s.request(
    `/documents/${doc.id}/review`,
    "POST",
    {
      revision: 2,
      note: "Corrected seller and added missing row from source",
      supplier: "Corrected seller",
      shipping_note: "Freight to be confirmed",
      items,
    },
    s.cookie,
  );
  assert.equal(saved.status, 200);
  const detail = await (
    await s.request(`/projects/${s.project}`, "GET", undefined, s.cookie)
  ).json();
  assert.equal(detail.documents[0].result.extraction.supplier, "Sample");
  assert.equal(detail.documents[0].supplier, "Corrected seller");
  assert.equal(detail.documents[0].review.length, 2);
  const compared = await (
    await s.request(
      `/projects/${s.project}/compare`,
      "GET",
      undefined,
      s.cookie,
    )
  ).json();
  assert.equal(compared.groups[0].offers[0].supplier, "Corrected seller");
  assert.equal(compared.groups.length, 2);
});
