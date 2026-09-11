# Privacy and security boundaries

**English** · [简体中文](SECURITY.zh-CN.md)

Evidence processing occurs in the browser or local CLI. This app contains no evidence-upload endpoint. External requests load application/model assets; the providers may retain ordinary access logs. Local AI is enabled explicitly and does not transmit the evidence as a model API request.

Reports can contain sensitive incident information even after best-effort masking. Inspect them before sharing. Browser history storage is optional, device-local and removable from the app; it is not encrypted against another user of the same browser profile. Model caches are managed separately by the browser.

Instruction-like text is quarantined using a limited detector. This is not comprehensive prompt-injection protection. No generated instruction is executed. Exact citation matching does not establish correctness, authority or semantic support.

If you find a vulnerability, use the repository's private vulnerability reporting feature when enabled. Do not publish secrets, private logs or exploit details in a public issue. Public issues are suitable for ordinary functional bugs with synthetic fixtures.
