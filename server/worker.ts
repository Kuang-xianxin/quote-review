import { api } from "./api.ts";
import type { Env } from "./platform.ts";
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (new URL(request.url).pathname.startsWith("/api/"))
      return api(request, env);
    return env.ASSETS
      ? env.ASSETS.fetch(request)
      : new Response("Not found", { status: 404 });
  },
};
