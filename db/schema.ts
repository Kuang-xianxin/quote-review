import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const sessions = sqliteTable("qr_sessions", {
  id: text("id").primaryKey(),
  created: integer("created").notNull(),
  expires: integer("expires").notNull(),
});
export const projects = sqliteTable(
  "qr_projects",
  {
    id: text("id").primaryKey(),
    session: text("session")
      .notNull()
      .references(() => sessions.id),
    name: text("name").notNull(),
    created: integer("created").notNull(),
  },
  (t) => [index("qr_project_session").on(t.session)],
);
export const documents = sqliteTable(
  "qr_documents",
  {
    id: text("id").primaryKey(),
    project: text("project")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    filename: text("filename").notNull(),
    bytes: integer("bytes").notNull(),
    digest: text("digest").notNull(),
    blob: text("blob").notNull(),
    state: text("state").notNull(),
    result: text("result"),
    review: text("review"),
    revision: integer("revision").notNull().default(1),
    changeToken: text("change_token"),
    created: integer("created").notNull(),
  },
  (t) => [uniqueIndex("qr_document_identity").on(t.project, t.digest)],
);
export const jobs = sqliteTable(
  "qr_jobs",
  {
    id: text("id").primaryKey(),
    document: text("document")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    state: text("state").notNull(),
    attempt: integer("attempt").notNull().default(0),
    leaseToken: text("lease_token"),
    leaseUntil: integer("lease_until"),
    error: text("error"),
    stage: text("stage"),
    created: integer("created").notNull(),
    updated: integer("updated").notNull(),
  },
  (t) => [
    index("qr_job_claim").on(t.state, t.created),
    uniqueIndex("qr_document_job").on(t.document),
  ],
);
export const audit = sqliteTable(
  "qr_audit",
  {
    id: text("id").primaryKey(),
    project: text("project")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    document: text("document").notNull(),
    action: text("action").notNull(),
    note: text("note").notNull(),
    before: text("before_value"),
    after: text("after_value"),
    created: integer("created").notNull(),
  },
  (t) => [index("qr_audit_project").on(t.project, t.created)],
);
export const workers = sqliteTable("qr_workers", {
  id: text("id").primaryKey(),
  model: text("model").notNull(),
  seen: integer("seen").notNull(),
});
