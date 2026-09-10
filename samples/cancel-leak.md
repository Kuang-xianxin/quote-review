The run owns lookup tasks and must cancel and await them on disconnect.
Connection release must complete even when its caller is cancelled.
Confirm terminal task events and pool.release by trace ID. A cancel request alone is insufficient.
