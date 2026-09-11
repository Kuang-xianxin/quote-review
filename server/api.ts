import { z } from "zod";
import {
  compareDocuments,
  csvCell,
  initialReview,
  reviewSchema,
  validateExtraction,
  type ExtractionResult,
  type ReviewItem,
} from "../core/quotes.ts";
import {
  ApiError,
  hash,
  id,
  json,
  now,
  type Env,
  type Row,
} from "./platform.ts";

const MAX_BYTES = 512_000;
const uuid = /^[0-9a-f-]{36}$/;
interface Doc extends Row {
  id: string;
  project: string;
  filename: string;
  digest: string;
  blob: string;
  state: string;
  result: string | null;
  review: string | null;
  revision: number;
}
async function body(request: Request, limit = 600_000): Promise<Uint8Array> {
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const parts: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const part = await reader.read();
    if (part.done) break;
    length += part.value.length;
    if (length > limit) {
      await reader.cancel();
      throw new ApiError(413, "file_too_large");
    }
    parts.push(part.value);
  }
  const value = new Uint8Array(length);
  let position = 0;
  for (const part of parts) {
    value.set(part, position);
    position += part.length;
  }
  return value;
}
async function input(request: Request): Promise<unknown> {
  try {
    return JSON.parse(new TextDecoder().decode(await body(request)));
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(400, "invalid_json");
  }
}
async function session(request: Request, env: Env): Promise<string> {
  const token = /(?:^|;\s*)qr_session=([a-f0-9]{64})(?:;|$)/.exec(
    request.headers.get("cookie") ?? "",
  )?.[1];
  if (!token) throw new ApiError(401, "session_required");
  const value = await hash(token);
  if (
    !(await env.DB.prepare(
      "SELECT id FROM qr_sessions WHERE id=? AND expires>?",
    )
      .bind(value, now())
      .first())
  )
    throw new ApiError(401, "session_expired");
  return value;
}
async function project(env: Env, projectId: string, owner: string) {
  const row = await env.DB.prepare(
    "SELECT * FROM qr_projects WHERE id=? AND session=?",
  )
    .bind(projectId, owner)
    .first();
  if (!row) throw new ApiError(404, "project_not_found");
  return row;
}
async function document(env: Env, docId: string, owner: string): Promise<Doc> {
  const row = await env.DB.prepare(
    "SELECT d.* FROM qr_documents d JOIN qr_projects p ON p.id=d.project WHERE d.id=? AND p.session=?",
  )
    .bind(docId, owner)
    .first<Doc>();
  if (!row) throw new ApiError(404, "document_not_found");
  return row;
}
function decoded(doc: Doc) {
  const result = doc.result
    ? (JSON.parse(doc.result) as ExtractionResult)
    : null;
  const saved = doc.review ? JSON.parse(doc.review) : null;
  const review: ReviewItem[] | null = saved
    ? Array.isArray(saved)
      ? saved
      : saved.items
    : result
      ? initialReview(result)
      : null;
  return {
    ...doc,
    blob: undefined,
    result,
    review,
    supplier:
      saved && !Array.isArray(saved)
        ? saved.supplier
        : (result?.extraction.supplier ?? null),
    shipping_note:
      saved && !Array.isArray(saved)
        ? saved.shipping_note
        : (result?.extraction.shipping_note ?? null),
  };
}
async function documents(env: Env, projectId: string) {
  return (
    await env.DB.prepare(
      "SELECT d.*,j.state AS job_state,j.stage,j.error,j.attempt FROM qr_documents d LEFT JOIN qr_jobs j ON j.document=d.id WHERE d.project=? ORDER BY d.created,d.id",
    )
      .bind(projectId)
      .all<Doc>()
  ).results;
}
async function workerAuth(request: Request, env: Env) {
  if (
    !env.WORKER_TOKEN ||
    env.WORKER_TOKEN.length < 32 ||
    (await hash(request.headers.get("authorization") ?? "")) !==
      (await hash(`Bearer ${env.WORKER_TOKEN}`))
  )
    throw new ApiError(401, "worker_unauthorized");
}
const leaseInput = z.object({
  lease: z.string().uuid(),
  stage: z.enum(["parsing", "extracting", "validating"]).optional(),
});

async function workerRoutes(
  request: Request,
  env: Env,
  path: string,
): Promise<Response> {
  await workerAuth(request, env);
  const current = now();
  if (path === "/api/worker/heartbeat" && request.method === "POST") {
    const worker = z
      .object({
        id: z.string().min(1).max(80),
        model: z.string().min(1).max(120),
      })
      .parse(await input(request));
    await env.DB.prepare(
      "INSERT INTO qr_workers(id,model,seen) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET model=excluded.model,seen=excluded.seen",
    )
      .bind(worker.id, worker.model, current)
      .run();
    return json({ ok: true });
  }
  if (path === "/api/worker/claim" && request.method === "POST") {
    // Reap expired sessions in bounded batches. Blob deletion precedes metadata deletion,
    // so a transient storage failure leaves a retryable record instead of an orphan.
    const expired = (
      await env.DB.prepare(
        "SELECT d.id,d.blob FROM qr_documents d JOIN qr_projects p ON p.id=d.project JOIN qr_sessions s ON s.id=p.session WHERE s.expires<=? LIMIT 20",
      )
        .bind(current)
        .all()
    ).results;
    for (const doc of expired) {
      await env.QUOTES.delete(String(doc.blob));
      await env.DB.prepare("DELETE FROM qr_documents WHERE id=?")
        .bind(doc.id)
        .run();
    }
    await env.DB.batch([
      env.DB.prepare(
        "DELETE FROM qr_projects WHERE session IN (SELECT id FROM qr_sessions WHERE expires<=?) AND NOT EXISTS(SELECT 1 FROM qr_documents WHERE project=qr_projects.id)",
      ).bind(current),
      env.DB.prepare(
        "DELETE FROM qr_sessions WHERE expires<=? AND NOT EXISTS(SELECT 1 FROM qr_projects WHERE session=qr_sessions.id)",
      ).bind(current),
    ]);
    // One atomic UPDATE owns the claim. Expired leases can be reclaimed; attempts are bounded.
    await env.DB.batch([
      env.DB.prepare(
        "UPDATE qr_jobs SET state='failed',error='lease_exhausted',updated=? WHERE state='leased' AND lease_until<? AND attempt>=3",
      ).bind(current, current),
      env.DB.prepare(
        "UPDATE qr_documents SET state='failed' WHERE state='processing' AND id IN (SELECT document FROM qr_jobs WHERE state='failed')",
      ),
    ]);
    const lease = id();
    const job = await env.DB.prepare(
      "UPDATE qr_jobs SET state='leased',attempt=attempt+1,lease_token=?,lease_until=?,stage='parsing',error=NULL,updated=? WHERE id=(SELECT id FROM qr_jobs WHERE (state='queued' OR (state='leased' AND lease_until<?)) AND attempt<3 ORDER BY created,id LIMIT 1) RETURNING *",
    )
      .bind(lease, current + 90, current, current)
      .first();
    if (!job) return json({ job: null });
    await env.DB.prepare(
      "UPDATE qr_documents SET state='processing' WHERE id=? AND EXISTS(SELECT 1 FROM qr_jobs WHERE id=? AND lease_token=? AND state='leased')",
    )
      .bind(job.document, job.id, lease)
      .run();
    const doc = await env.DB.prepare(
      "SELECT filename,digest,bytes FROM qr_documents WHERE id=?",
    )
      .bind(job.document)
      .first();
    return json({ job: { ...job, ...doc } });
  }
  const match =
    /^\/api\/worker\/jobs\/([a-f0-9-]{36})\/(source|lease|complete|fail)$/.exec(
      path,
    );
  if (!match) throw new ApiError(404, "route_not_found");
  const [, jobId, action] = match;
  if (action === "source" && request.method === "GET") {
    const lease = request.headers.get("x-job-lease") ?? "";
    const doc = await env.DB.prepare(
      "SELECT d.blob FROM qr_documents d JOIN qr_jobs j ON j.document=d.id WHERE j.id=? AND j.lease_token=? AND j.state='leased' AND j.lease_until>?",
    )
      .bind(jobId, lease, current)
      .first();
    if (!doc) throw new ApiError(409, "lease_lost");
    const file = await env.QUOTES.get(String(doc.blob));
    if (!file) throw new ApiError(404, "source_missing");
    return new Response(await file.arrayBuffer(), {
      headers: {
        "content-type": "application/octet-stream",
        "cache-control": "no-store",
      },
    });
  }
  if (request.method !== "POST") throw new ApiError(405, "method_not_allowed");
  const value = await input(request);
  const { lease, stage } = leaseInput.parse(value);
  if (action === "lease") {
    const updated = await env.DB.prepare(
      "UPDATE qr_jobs SET lease_until=?,stage=?,updated=? WHERE id=? AND state='leased' AND lease_token=? AND lease_until>?",
    )
      .bind(current + 90, stage ?? "extracting", current, jobId, lease, current)
      .run();
    if (!updated.meta.changes) throw new ApiError(409, "lease_lost");
    return json({ ok: true });
  }
  const job = await env.DB.prepare(
    "SELECT j.*,d.digest,d.state AS document_state FROM qr_jobs j JOIN qr_documents d ON d.id=j.document WHERE j.id=? AND j.lease_token=?",
  )
    .bind(jobId, lease)
    .first();
  if (!job) throw new ApiError(409, "lease_lost");
  if (job.state === "completed" && action === "complete")
    return json({ ok: true, already_completed: true });
  if (job.state !== "leased" || Number(job.lease_until) <= current)
    throw new ApiError(409, "lease_lost");
  if (action === "fail") {
    const fail = z
      .object({ error: z.string().regex(/^[a-z_]{1,80}$/) })
      .parse(value);
    const changes = await env.DB.batch([
      env.DB.prepare(
        "UPDATE qr_jobs SET state='failed',error=?,updated=? WHERE id=? AND state='leased' AND lease_token=? AND lease_until>?",
      ).bind(fail.error, current, jobId, lease, current),
      env.DB.prepare(
        "UPDATE qr_documents SET state='failed' WHERE id=? AND state='processing' AND EXISTS(SELECT 1 FROM qr_jobs WHERE id=? AND state='failed' AND lease_token=?)",
      ).bind(job.document, jobId, lease),
    ]);
    if (!changes[0].meta.changes) throw new ApiError(409, "lease_lost");
    return json({ ok: true });
  }
  const complete = z
    .object({
      source_sha256: z.string().length(64),
      extraction: z.unknown(),
      lines: z.unknown(),
      model: z.string().min(1).max(120),
      duration_ms: z.number().int().min(0).max(900000),
      warnings: z.array(z.string().max(200)).max(20),
    })
    .parse(value);
  if (complete.source_sha256 !== job.digest)
    throw new ApiError(400, "source_digest_mismatch");
  const validated = validateExtraction(complete.extraction, complete.lines);
  const result: ExtractionResult = {
    ...validated,
    model: complete.model,
    duration_ms: complete.duration_ms,
    warnings: complete.warnings,
  };
  const changes = await env.DB.batch([
    env.DB.prepare(
      "UPDATE qr_jobs SET state='completed',stage='complete',updated=? WHERE id=? AND state='leased' AND lease_token=? AND lease_until>?",
    ).bind(current, jobId, lease, current),
    env.DB.prepare(
      "UPDATE qr_documents SET state='ready',result=?,review=NULL,revision=revision+1 WHERE id=? AND state='processing' AND EXISTS(SELECT 1 FROM qr_jobs WHERE id=? AND state='completed' AND lease_token=?)",
    ).bind(JSON.stringify(result), job.document, jobId, lease),
  ]);
  if (!changes[0].meta.changes) throw new ApiError(409, "lease_lost");
  return json({ ok: true });
}

export async function api(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url),
    path = url.pathname;
  try {
    if (path.startsWith("/api/worker/"))
      return await workerRoutes(request, env, path);
    if (request.method !== "GET" && request.method !== "HEAD") {
      if (
        request.headers.get("x-requested-with") !== "quote-review" ||
        request.headers.get("sec-fetch-site") === "cross-site"
      )
        throw new ApiError(403, "request_origin_rejected");
      const origin = request.headers.get("origin");
      if (origin && origin !== url.origin)
        throw new ApiError(403, "request_origin_rejected");
    }
    if (path === "/api/health") {
      const worker = await env.DB.prepare(
        "SELECT model,seen FROM qr_workers ORDER BY seen DESC LIMIT 1",
      ).first();
      return json({
        ok: true,
        storage: "server",
        worker_online: !!worker && Number(worker.seen) > now() - 60,
        model: worker?.model ?? null,
        demo: env.DEMO_MODE !== "false",
      });
    }
    if (path === "/api/session" && request.method === "POST") {
      try {
        await session(request, env);
        return json({ ok: true });
      } catch (e) {
        if (!(e instanceof ApiError && e.status === 401)) throw e;
      }
      const count = await env.DB.prepare(
        "SELECT COUNT(*) AS n FROM qr_sessions WHERE created>?",
      )
        .bind(now() - 86400)
        .first();
      if (Number(count?.n) >= 500) throw new ApiError(429, "demo_capacity");
      const token = [...crypto.getRandomValues(new Uint8Array(32))]
        .map((x) => x.toString(16).padStart(2, "0"))
        .join("");
      const inserted = await env.DB.prepare(
        "INSERT INTO qr_sessions(id,created,expires) SELECT ?,?,? WHERE (SELECT COUNT(*) FROM qr_sessions WHERE created>?)<500",
      )
        .bind(await hash(token), now(), now() + 7 * 86400, now() - 86400)
        .run();
      if (!inserted.meta.changes) throw new ApiError(429, "demo_capacity");
      return json({ ok: true }, 201, {
        "Set-Cookie": `qr_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800${url.protocol === "https:" ? "; Secure" : ""}`,
      });
    }
    const owner = await session(request, env);
    if (path === "/api/projects" && request.method === "GET")
      return json({
        projects: (
          await env.DB.prepare(
            "SELECT id,name,created FROM qr_projects WHERE session=? ORDER BY created DESC",
          )
            .bind(owner)
            .all()
        ).results,
      });
    if (path === "/api/projects" && request.method === "POST") {
      const data = z
        .object({ name: z.string().trim().min(1).max(100) })
        .parse(await input(request));
      const projectId = id();
      const created = await env.DB.prepare(
        "INSERT INTO qr_projects(id,session,name,created) SELECT ?,?,?,? WHERE (SELECT COUNT(*) FROM qr_projects WHERE session=?)<5",
      )
        .bind(projectId, owner, data.name, now(), owner)
        .run();
      if (!created.meta.changes) throw new ApiError(429, "project_limit");
      return json({ id: projectId, name: data.name }, 201);
    }
    const projectRoute =
      /^\/api\/projects\/([a-f0-9-]{36})(?:\/(documents|compare|export|audit))?$/.exec(
        path,
      );
    if (projectRoute) {
      const [, projectId, action] = projectRoute;
      const currentProject = await project(env, projectId, owner);
      if (!action && request.method === "GET")
        return json({
          project: currentProject,
          documents: (await documents(env, projectId)).map(decoded),
        });
      if (!action && request.method === "DELETE") {
        const docs = await documents(env, projectId);
        for (const doc of docs) await env.QUOTES.delete(doc.blob);
        await env.DB.prepare("DELETE FROM qr_projects WHERE id=? AND session=?")
          .bind(projectId, owner)
          .run();
        return json({ ok: true });
      }
      if (action === "audit" && request.method === "GET")
        return json({
          events: (
            await env.DB.prepare(
              "SELECT * FROM qr_audit WHERE project=? ORDER BY created DESC,id DESC LIMIT 100",
            )
              .bind(projectId)
              .all()
          ).results,
        });
      if (
        (action === "compare" || action === "export") &&
        request.method === "GET"
      ) {
        const docs = (await documents(env, projectId))
          .filter((doc) => doc.result)
          .map((doc) => {
            const row = decoded(doc);
            return {
              id: doc.id,
              filename: doc.filename,
              result: {
                ...row.result!,
                extraction: {
                  ...row.result!.extraction,
                  supplier: row.supplier,
                  shipping_note: row.shipping_note,
                },
              },
              review: row.review,
            };
          });
        const result = compareDocuments(docs);
        if (action === "compare") return json(result);
        const cn = url.searchParams.get("lang") === "zh-CN";
        const rows: unknown[][] = [
          cn
            ? [
                "比价组",
                "供应商",
                "币种",
                "报价",
                "报价单位",
                "每包装件数",
                "每件单价（不含运费税费）",
                "起订量",
                "起订量单位",
                "交期（天）",
                "运费说明",
                "来源文件",
              ]
            : [
                "Group",
                "Supplier",
                "Currency",
                "Quoted price",
                "Price unit",
                "Units per pack",
                "Price per each (excludes freight/tax)",
                "Minimum order",
                "MOQ unit",
                "Lead days",
                "Shipping note",
                "Source file",
              ],
        ];
        for (const group of result.groups)
          for (const offer of group.offers)
            rows.push([
              group.key,
              offer.supplier,
              offer.currency,
              offer.unit_price,
              offer.price_unit,
              offer.pack_size,
              offer.price_each,
              offer.moq,
              offer.moq_unit,
              offer.lead_days,
              offer.shipping_note,
              offer.filename,
            ]);
        return new Response(
          "\ufeff" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n"),
          {
            headers: {
              "Content-Type": "text/csv;charset=utf-8",
              "Content-Disposition":
                'attachment; filename="quote-comparison.csv"',
              "Cache-Control": "no-store",
            },
          },
        );
      }
      if (action === "documents" && request.method === "POST") {
        const raw = await body(request);
        const form = await new Response(Uint8Array.from(raw).buffer, {
          headers: {
            "Content-Type": request.headers.get("content-type") ?? "",
          },
        }).formData();
        const file = form.get("file");
        if (!(file instanceof File)) throw new ApiError(400, "file_required");
        if (!file.size || file.size > MAX_BYTES)
          throw new ApiError(413, "file_too_large");
        if (!/\.(pdf|xlsx|csv|txt|eml)$/i.test(file.name))
          throw new ApiError(400, "unsupported_file");
        const content = await file.arrayBuffer(),
          digest = await hash(content);
        const existing = await env.DB.prepare(
          "SELECT id FROM qr_documents WHERE project=? AND digest=?",
        )
          .bind(projectId, digest)
          .first();
        if (existing) return json({ id: existing.id, duplicate: true });
        const count = await env.DB.prepare(
          "SELECT COUNT(*) AS n FROM qr_documents WHERE project=?",
        )
          .bind(projectId)
          .first();
        if (Number(count?.n) >= 6) throw new ApiError(429, "document_limit");
        const pending = await env.DB.prepare(
          "SELECT COUNT(*) AS n FROM qr_jobs WHERE state IN ('queued','leased')",
        ).first();
        if (Number(pending?.n) >= 16) throw new ApiError(429, "queue_full");
        const docId = id(),
          jobId = id(),
          blob = `quotes/${docId}`;
        await env.QUOTES.put(blob, content);
        try {
          const changes = await env.DB.batch([
            env.DB.prepare(
              "INSERT INTO qr_documents(id,project,filename,bytes,digest,blob,state,created) SELECT ?,?,?,?,?,?,'queued',? WHERE (SELECT COUNT(*) FROM qr_documents WHERE project=?)<6 AND (SELECT COUNT(*) FROM qr_documents)<200 AND (SELECT COUNT(*) FROM qr_jobs WHERE state IN ('queued','leased'))<16",
            ).bind(
              docId,
              projectId,
              file.name.replace(/[\r\n/\\]/g, "_").slice(0, 150),
              file.size,
              digest,
              blob,
              now(),
              projectId,
            ),
            env.DB.prepare(
              "INSERT INTO qr_jobs(id,document,state,created,updated) SELECT ?,?,'queued',?,? WHERE EXISTS(SELECT 1 FROM qr_documents WHERE id=?)",
            ).bind(jobId, docId, now(), now(), docId),
          ]);
          if (!changes[0].meta.changes)
            throw new ApiError(429, "demo_capacity");
        } catch (error) {
          await env.QUOTES.delete(blob);
          const duplicate = await env.DB.prepare(
            "SELECT id FROM qr_documents WHERE project=? AND digest=?",
          )
            .bind(projectId, digest)
            .first();
          if (duplicate) return json({ id: duplicate.id, duplicate: true });
          throw error;
        }
        return json({ id: docId, job_id: jobId }, 201);
      }
    }
    const documentRoute =
      /^\/api\/documents\/([a-f0-9-]{36})\/(source|review|cancel|retry)$/.exec(
        path,
      );
    if (documentRoute) {
      const [, docId, action] = documentRoute;
      if (!uuid.test(docId)) throw new ApiError(404, "document_not_found");
      const doc = await document(env, docId, owner);
      if (action === "source" && request.method === "GET") {
        const file = await env.QUOTES.get(doc.blob);
        if (!file) throw new ApiError(404, "source_missing");
        return new Response(await file.arrayBuffer(), {
          headers: {
            "Content-Type": "application/octet-stream",
            "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(doc.filename)}`,
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
          },
        });
      }
      if (request.method !== "POST")
        throw new ApiError(405, "method_not_allowed");
      if (action === "review") {
        if (!doc.result || !["ready", "reviewed"].includes(doc.state))
          throw new ApiError(409, "not_ready");
        const review = reviewSchema.parse(await input(request)),
          result = JSON.parse(doc.result) as ExtractionResult;
        const token = id(),
          after = JSON.stringify({
            items: review.items,
            supplier:
              review.supplier === undefined
                ? decoded(doc).supplier
                : review.supplier,
            shipping_note:
              review.shipping_note === undefined
                ? decoded(doc).shipping_note
                : review.shipping_note,
          });
        const changes = await env.DB.batch([
          env.DB.prepare(
            "UPDATE qr_documents SET review=?,state='reviewed',revision=revision+1,change_token=? WHERE id=? AND revision=? AND state IN ('ready','reviewed')",
          ).bind(after, token, docId, review.revision),
          env.DB.prepare(
            "INSERT INTO qr_audit(id,project,document,action,note,before_value,after_value,created) SELECT ?,?,?,'review',?,?,?,? WHERE EXISTS(SELECT 1 FROM qr_documents WHERE id=? AND change_token=?)",
          ).bind(
            id(),
            doc.project,
            docId,
            review.note,
            doc.review ?? JSON.stringify(initialReview(result)),
            after,
            now(),
            docId,
            token,
          ),
        ]);
        if (!changes[0].meta.changes)
          throw new ApiError(409, "revision_conflict");
        return json({ ok: true, revision: review.revision + 1 });
      }
      if (action === "cancel") {
        await env.DB.batch([
          env.DB.prepare(
            "UPDATE qr_jobs SET state='cancelled',lease_token=NULL,updated=? WHERE document=? AND state IN ('queued','leased')",
          ).bind(now(), docId),
          env.DB.prepare(
            "UPDATE qr_documents SET state='cancelled' WHERE id=? AND state IN ('queued','processing')",
          ).bind(docId),
        ]);
        return json({ ok: true });
      }
      if (action === "retry") {
        const changes = await env.DB.batch([
          env.DB.prepare(
            "UPDATE qr_jobs SET state='queued',attempt=0,lease_token=NULL,error=NULL,stage=NULL,updated=? WHERE document=? AND state IN ('cancelled','failed') AND (SELECT COUNT(*) FROM qr_jobs WHERE state IN ('queued','leased'))<16",
          ).bind(now(), docId),
          env.DB.prepare(
            "UPDATE qr_documents SET state='queued' WHERE id=? AND state IN ('cancelled','failed') AND EXISTS(SELECT 1 FROM qr_jobs WHERE document=? AND state='queued')",
          ).bind(docId, docId),
        ]);
        if (!changes[0].meta.changes) throw new ApiError(409, "not_retryable");
        return json({ ok: true });
      }
    }
    throw new ApiError(404, "route_not_found");
  } catch (error) {
    if (error instanceof ApiError)
      return json({ error: error.code }, error.status);
    if (error instanceof z.ZodError)
      return json(
        {
          error: "invalid_fields",
          fields: error.issues.map((issue) => issue.path.join(".")),
        },
        400,
      );
    if (
      error instanceof Error &&
      ["unknown_source_id", "duplicate_source_ids"].includes(error.message)
    )
      return json({ error: error.message }, 400);
    console.error(
      "quote-review: request failed",
      error instanceof Error ? error.name : "unknown",
    );
    return json({ error: "service_unavailable" }, 503);
  }
}
