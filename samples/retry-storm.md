Provider rate limits: honor Retry-After before retrying a 429.
Retry budget: at most 3 attempts; bounded exponential backoff with jitter.
The run deadline includes retrieval, model calls, retries, and cleanup.
A successful health check does not establish success of an agent run.
