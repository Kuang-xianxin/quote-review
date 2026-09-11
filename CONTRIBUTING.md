# Contributing

Start with a reproducible purchasing problem. Attach only a small synthetic or redacted quote, expected fields and source positions; never publish private supplier documents. Chinese and English reports are welcome.

Keep changes focused on extraction correctness, row completeness, source review, unit contracts or workflow reliability. Include an appropriate regression that fails before the fix. Run npm test, typecheck, lint, build and Python parser tests. Model/prompt changes also require a real model benchmark with retained mismatches and measured scope.

Use the same API contracts for cloud and local adapters. Preserve existing migration history, ownership checks, stale-lease rejection and optimistic review updates. Explain assumptions rather than inventing quote fields. Do not add paid APIs, mandatory keys or unnecessary infrastructure.
