import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve, sep, extname } from "node:path";
import { randomBytes } from "node:crypto";
import { api } from "./api.ts";
import { LocalBucket, LocalDatabase } from "./local-platform.ts";

const directory = resolve(process.env.QUOTE_DATA_DIR || ".data");
await mkdir(directory, { recursive: true });
const tokenFile = resolve(directory, "worker-token");
let token = process.env.QUOTE_WORKER_TOKEN;
if (!token) {
  try {
    token = (await readFile(tokenFile, "utf8")).trim();
  } catch {
    token = randomBytes(32).toString("hex");
    await writeFile(tokenFile, token, { mode: 0o600, flag: "wx" });
  }
}
const DB = new LocalDatabase(resolve(directory, "quotes.sqlite"));
await DB.migrate(resolve("drizzle"));
const env = {
  DB,
  QUOTES: new LocalBucket(resolve(directory, "blobs")),
  WORKER_TOKEN: token,
  DEMO_MODE: "false",
};
const client = resolve("dist/client");
const mime: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
};
const port = Number(process.env.PORT || 8765);
const server = createServer(async (incoming, outgoing) => {
  try {
    const authority = `http://${incoming.headers.host || `127.0.0.1:${port}`}`;
    const url = new URL(incoming.url || "/", authority);
    if (!url.pathname.startsWith("/api/")) {
      let path = resolve(client, "." + decodeURIComponent(url.pathname));
      if (!path.startsWith(client + sep) && path !== client) {
        outgoing.writeHead(404).end();
        return;
      }
      if (!extname(path)) path = resolve(client, "index.html");
      try {
        const content = await readFile(path);
        outgoing.writeHead(200, {
          "content-type": mime[extname(path)] || "application/octet-stream",
        });
        outgoing.end(content);
      } catch {
        outgoing
          .writeHead(404)
          .end("Build the frontend or use the Vite preview.");
      }
      return;
    }
    const buffers: Uint8Array[] = [];
    let size = 0;
    for await (const chunk of incoming) {
      size += chunk.length;
      if (size > 600_000) {
        outgoing
          .writeHead(413, { "content-type": "application/json" })
          .end('{"error":"file_too_large"}');
        return;
      }
      buffers.push(chunk);
    }
    const headers = new Headers();
    for (const [name, value] of Object.entries(incoming.headers))
      if (value)
        headers.set(name, Array.isArray(value) ? value.join(",") : value);
    const data = Buffer.concat(buffers);
    const request = new Request(url, {
      method: incoming.method,
      headers,
      ...(size ? { body: data } : {}),
    });
    const response = await api(request, env);
    outgoing.writeHead(response.status, Object.fromEntries(response.headers));
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  } catch {
    outgoing
      .writeHead(500, { "content-type": "application/json" })
      .end('{"error":"service_unavailable"}');
  }
});
server.listen(port, "127.0.0.1", () =>
  console.log(
    `Quote Review backend http://127.0.0.1:${port} (SQLite + local files)`,
  ),
);
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () =>
    server.close(() => {
      DB.close();
      process.exit(0);
    }),
  );
