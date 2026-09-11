CREATE TABLE `qr_audit` (
	`id` text PRIMARY KEY NOT NULL,
	`project` text NOT NULL,
	`document` text NOT NULL,
	`action` text NOT NULL,
	`note` text NOT NULL,
	`before_value` text,
	`after_value` text,
	`created` integer NOT NULL,
	FOREIGN KEY (`project`) REFERENCES `qr_projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `qr_audit_project` ON `qr_audit` (`project`,`created`);--> statement-breakpoint
CREATE TABLE `qr_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`project` text NOT NULL,
	`filename` text NOT NULL,
	`bytes` integer NOT NULL,
	`digest` text NOT NULL,
	`blob` text NOT NULL,
	`state` text NOT NULL,
	`result` text,
	`review` text,
	`revision` integer DEFAULT 1 NOT NULL,
	`change_token` text,
	`created` integer NOT NULL,
	FOREIGN KEY (`project`) REFERENCES `qr_projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `qr_document_identity` ON `qr_documents` (`project`,`digest`);--> statement-breakpoint
CREATE TABLE `qr_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`document` text NOT NULL,
	`state` text NOT NULL,
	`attempt` integer DEFAULT 0 NOT NULL,
	`lease_token` text,
	`lease_until` integer,
	`error` text,
	`stage` text,
	`created` integer NOT NULL,
	`updated` integer NOT NULL,
	FOREIGN KEY (`document`) REFERENCES `qr_documents`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `qr_job_claim` ON `qr_jobs` (`state`,`created`);--> statement-breakpoint
CREATE UNIQUE INDEX `qr_document_job` ON `qr_jobs` (`document`);--> statement-breakpoint
CREATE TABLE `qr_projects` (
	`id` text PRIMARY KEY NOT NULL,
	`session` text NOT NULL,
	`name` text NOT NULL,
	`created` integer NOT NULL,
	FOREIGN KEY (`session`) REFERENCES `qr_sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `qr_project_session` ON `qr_projects` (`session`);--> statement-breakpoint
CREATE TABLE `qr_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`created` integer NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `qr_workers` (
	`id` text PRIMARY KEY NOT NULL,
	`model` text NOT NULL,
	`seen` integer NOT NULL
);
