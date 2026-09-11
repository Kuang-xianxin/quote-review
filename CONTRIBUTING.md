# Contributing

**English** · [简体中文](CONTRIBUTING.zh-CN.md)

Start with a real limitation and a synthetic reproduction. Keep private incident logs, tenant data and credentials out of issues and commits.

1. Open a focused issue describing input, observed output, expected output, and why the difference matters.
2. Add a regression test that fails before the change. For diagnostic rules, include a negative case to prevent false positives.
3. Keep core code independent of the UI and network. Preserve deterministic output and clear evidence boundaries.
4. Run `npm test`, `npm run typecheck`, `npm run eval`, `npm run lint`, and `npm run build`.
5. Describe the final behavior and validation limits in the PR. AI assistance is welcome; do not invent validation or authorship claims.

Keep Chinese and English product copy and main documentation in sync. Preserve reciprocal language links; never translate evidence, quotes or user input.

Useful areas: structured trace formats, multilingual diagnostic fixtures, better bounded retrieval, accessibility, measured local-model evaluations. Do not add hosted/paid inference or send evidence to third-party services without a separately discussed design.
