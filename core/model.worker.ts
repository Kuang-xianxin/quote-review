import { CreateMLCEngine } from "@mlc-ai/web-llm";

// This worker handles one owned run. The caller terminates it on cancellation/timeout.
self.onmessage = async (
  event: MessageEvent<{ model: string; system: string; user: string }>,
) => {
  try {
    const engine = await CreateMLCEngine(
      event.data.model,
      {
        initProgressCallback: (p) =>
          self.postMessage({
            type: "progress",
            progress: p.progress,
            text: p.text,
          }),
      },
      { context_window_size: 4096 },
    );
    self.postMessage({
      type: "progress",
      progress: 1,
      text: "Model ready. Generating hypotheses on your device…",
    });
    const reply = await engine.chat.completions.create({
      messages: [
        { role: "system", content: event.data.system },
        { role: "user", content: event.data.user },
      ],
      temperature: 0,
      max_tokens: 650,
      response_format: { type: "json_object" },
    });
    self.postMessage({
      type: "complete",
      text: reply.choices[0]?.message.content ?? "",
    });
    await engine.unload();
  } catch (error) {
    self.postMessage({
      type: "error",
      message:
        error instanceof Error ? error.message : "Local inference failed.",
    });
  }
};
