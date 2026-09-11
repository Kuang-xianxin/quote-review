import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { mkdir, readFile, writeFile, unlink, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import type { Database, Statement, Bucket, Row } from "./platform.ts";

class LocalStatement implements Statement {
  constructor(
    readonly db: DatabaseSync,
    readonly sql: string,
    readonly values: SQLInputValue[] = [],
  ) {}
  bind(...values: unknown[]): Statement {
    return new LocalStatement(this.db, this.sql, values as SQLInputValue[]);
  }
  async first<T = Row>(): Promise<T | null> {
    return (
      (this.db.prepare(this.sql).get(...this.values) as T | undefined) ?? null
    );
  }
  async all<T = Row>(): Promise<{ results: T[] }> {
    return { results: this.db.prepare(this.sql).all(...this.values) as T[] };
  }
  async run() {
    return this.execute();
  }
  execute() {
    return {
      meta: {
        changes: Number(this.db.prepare(this.sql).run(...this.values).changes),
      },
    };
  }
}
export class LocalDatabase implements Database {
  readonly native: DatabaseSync;
  constructor(filename: string) {
    this.native = new DatabaseSync(filename);
    this.native.exec(
      "PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;",
    );
  }
  prepare(sql: string) {
    return new LocalStatement(this.native, sql);
  }
  async batch(statements: Statement[]) {
    this.native.exec("BEGIN IMMEDIATE");
    try {
      const result = statements.map((statement) =>
        (statement as LocalStatement).execute(),
      );
      this.native.exec("COMMIT");
      return result;
    } catch (error) {
      this.native.exec("ROLLBACK");
      throw error;
    }
  }
  async migrate(directory: string) {
    this.native.exec(
      "CREATE TABLE IF NOT EXISTS qr_migrations(name TEXT PRIMARY KEY)",
    );
    for (const name of (await readdir(directory))
      .filter((file) => file.endsWith(".sql"))
      .sort()) {
      if (
        this.native
          .prepare("SELECT name FROM qr_migrations WHERE name=?")
          .get(name)
      )
        continue;
      const sql = await readFile(resolve(directory, name), "utf8");
      this.native.exec("BEGIN IMMEDIATE");
      try {
        this.native.exec(sql);
        this.native
          .prepare("INSERT INTO qr_migrations(name) VALUES(?)")
          .run(name);
        this.native.exec("COMMIT");
      } catch (error) {
        this.native.exec("ROLLBACK");
        throw error;
      }
    }
  }
  close() {
    this.native.close();
  }
}
export class LocalBucket implements Bucket {
  constructor(readonly directory: string) {}
  private path(key: string) {
    if (!/^quotes\/[a-f0-9-]{36}$/.test(key))
      throw new Error("invalid_blob_key");
    return resolve(this.directory, key.slice(7));
  }
  async put(key: string, value: ArrayBuffer | Uint8Array) {
    await mkdir(this.directory, { recursive: true });
    await writeFile(this.path(key), new Uint8Array(value));
  }
  async get(key: string) {
    try {
      const bytes = await readFile(this.path(key));
      return { arrayBuffer: async () => Uint8Array.from(bytes).buffer };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }
  async delete(key: string) {
    try {
      await unlink(this.path(key));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
}
