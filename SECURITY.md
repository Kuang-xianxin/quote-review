# Data and security boundaries

The public demo accepts only synthetic/redacted material. Documents are uploaded to cloud blob storage; extracted text, proposals and review history are stored in the cloud database. The operator's authenticated compute node downloads documents to process them. Do not upload supplier contracts, personal data or confidential prices to someone else's demonstration.

Anonymous workspace access uses a random HttpOnly, SameSite cookie; server-side ownership is checked for project, source, comparison, export, review and audit endpoints. No team accounts or recovery links exist. Clearing cookies loses access. The session expires after seven days; expired files/records are removed in bounded batches when the compute worker next claims jobs. Deleting a comparison removes its documents and history sooner. Expiry is not a promise of immediate deletion while the worker is offline.

Limits: 500 KB/file, 6 files/project, 5 projects/session, 200 stored files, 16 active jobs, 500 new sessions/day. Parsing has text/page/sheet/cell limits, a process timeout and a POSIX-only memory limit. Windows parsing is isolated and time-bounded but lacks a hard memory quota. These are demo safeguards, not a security audit or comprehensive abuse defense.

Document text is untrusted. The model has no tools and cannot execute commands or fetch URLs. Instruction-like text and some source mismatches are flagged, but extraction may still be manipulated. Human review is mandatory. Formula cells are rejected on import and formula-like CSV output is escaped.

Keep worker bearer tokens secret; they authorize processing all queued documents. The local server listens on loopback. For confidential use, self-host and add organization identity, access lifecycle and backups. Report a security concern privately through the repository's GitHub Security advisories; use only synthetic reproductions in public issues.
