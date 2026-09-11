# Interview walkthrough

## Explain the actual problem

Supplier quotes arrive in inconsistent documents. The application proposes structured fields using a local model, shows the source for human review, then compares confirmed prices under an explicit packaging/currency contract. The model does not choose a supplier or place an order.

Development was AI-assisted. Reproduce and understand the system before describing personal work; do not invent independent authorship, customers or measured savings.

## Demonstrate the work

Upload the bilingual samples and observe real queued extraction. Explain carton versus each, independently specified MOQ units, source warnings and human corrections. Save a review, refresh, export, then show a conflicting stale revision and a cancelled task that cannot write late results.

## Be ready for these questions

- **Why not ask a chatbot for the cheapest quote?** It may mix units, guess currencies or omit rows. The model proposes fields; decimal arithmetic and data validation run deterministically; humans decide product equivalence.
- **Does constrained JSON guarantee correctness?** No. Preserved baseline outputs include valid JSON with wrong units, inferred currencies, omitted rows and an instruction-following failure. Inspect the full regression records, not just successful demos.
- **What prevents duplicate or stale work?** An atomic claim, fresh lease token, renewal and state/deadline predicates on completion. Cancellation invalidates the lease. Repeated successful completion is idempotent.
- **Where does atomicity stop?** Database and blob storage are separate. Upload failure cleans the new blob; deletion failure leaves retryable metadata. Production would need monitored compensation, backups and recovery exercises.
- **How would you validate usefulness?** Recruit actual purchasing users with redacted quotes; compare against human ground truth and measure missed rows, field corrections and task time. Synthetic accuracy and test counts are not user-value evidence.
- **What next?** Use observed failures to prioritize OCR, table alignment and expanded evaluation. Add team identity when collaboration demands it. A desktop compute worker is not a highly available production inference fleet.
