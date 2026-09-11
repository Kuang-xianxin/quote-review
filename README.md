# Quote Review

[简体中文](README.zh-CN.md) · [Live workbench](https://quote-review.loyal-lamb-5637.chatgpt.site/?lang=en) · [Architecture](docs/ARCHITECTURE.md) · [Validation](docs/VALIDATION.md)

Compare supplier quotations without quietly mixing a carton price with a piece price. Import a quotation, inspect the local model's proposed fields next to the original text, correct mistakes, then export confirmed offers grouped by product and currency.

**A review workbench, not an automatic purchasing decision.** Model outputs can be wrong. Freight, tax, exchange rates and product equivalence are not inferred into a cheapest-supplier recommendation.

## Try it

1. Create a comparison and select **Load bilingual samples**, or upload a redacted quotation.
2. Wait for the actual background extraction. The sample files contain fictional suppliers; their answers are not preloaded.
3. Check the original lines, packaging, currency and minimum-order unit. Correct fields or add omitted items. Assign equivalent products to the same comparison group.
4. Mark checked rows, add a review note and save. Compare normalized per-piece prices and export CSV.

The public backend stores files and reviews. Inference runs on the operator's desktop CPU. When that computer is offline, the site remains accessible and existing results can be reviewed; new jobs wait. This is a small public demo, not a 24/7 inference SLA. Use only synthetic or redacted data there. [Data boundaries](SECURITY.md).

## What is implemented

- Chinese/English working UI, PDF/XLSX/CSV/TXT/plain-text EML import, actual local GGUF inference.
- Server persistence: Cloudflare Worker + D1 + R2; the same API runs with Node SQLite and local files.
- Private anonymous sessions, source-file hashes, duplicate detection, bounded uploads and queue.
- Leased jobs, bounded retry, cancellation, fencing against stale worker results; isolated parser process.
- Source-line citations, missing/unsupported-value warnings, manual correction and missed-item entry.
- Optimistic review revisions and an audit trail. Currency-separated comparisons using decimal arithmetic, formula-safe CSV export.

## Run locally (Windows, verified path)

Requirements: Node **22.13+**, Python **3.13**, internet for the initial dependency/model download, approximately **2.50 GB** for model weights plus runtime/dependencies. The measured host has an i5-12400, 25 GB RAM; inference uses 4 CPU threads. No GPU, model account or paid API key is required. Hardware, electricity, storage and hosting quotas still exist.

```powershell
npm ci
py -3.13 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r worker/requirements.txt
.\.venv\Scripts\python.exe worker/bootstrap.py
npm run build
npm start
```

In a second terminal at the same project root:

```powershell
.\.venv\Scripts\python.exe worker/run.py
```

Open **http://127.0.0.1:8765**. The server generates a private token in `.data/worker-token`, which the worker reads automatically. For frontend development run `npm run dev` in a third terminal and open the printed URL. SQLite and files stay in `.data`; neither is tracked in Git.

Linux/macOS: use `python3 -m venv .venv`, install the requirements, download the same model with `bootstrap.py`, install a compatible `llama-server` (validated binary version b10901), and pass `--llama /absolute/path/to/llama-server`. Native inference on those operating systems has not been measured here. CI covers the platform-independent API/parser paths.

## Verify

```powershell
npm test
npm run typecheck
npm run lint
.\.venv\Scripts\python.exe -m unittest discover -s worker -p test_parse.py
.\.venv\Scripts\python.exe worker/benchmark.py
npm run build
```

The model benchmark really loads the weights. It records outputs, expected fields, mismatches and timings; a small synthetic fixture set is not production accuracy. Baseline failures are retained in [validation records](docs/validation/). [Interview walkthrough](docs/INTERVIEW.en.md).

## Current limits

Text PDFs only (10-page cap); no scanned OCR, images, XLS, formula cells, PDF table-layout reconstruction, login/team sharing, exchange-rate conversion, automatic SKU equivalence, freight allocation or orders. Files are limited to 500 KB and bounded extracted text; complex documents can be rejected. A browser cookie is required to revisit private results for up to 7 days. Expired data is cleaned when the worker next claims work. Delete a comparison to remove it sooner.

## Contributing

The most useful contributions are sanitized quotations that reproduce a wrong field or omitted row, with the expected value and source position. Do not upload real supplier/customer documents publicly. See [CONTRIBUTING](CONTRIBUTING.md).

MIT application code. Model weights and runtime retain their own licenses; see [third-party notices](THIRD_PARTY_NOTICES.md). The initial repository was a static incident-investigation prototype; Git history preserves it. The current product was rebuilt around procurement quote review.
