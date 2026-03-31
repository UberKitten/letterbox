import { AutoRouter, cors, type IRequest } from "itty-router";
import type { Env } from "./env";
import { authRoutes } from "./auth";
import { graphRoutes } from "./graph";

const { preflight, corsify } = cors({
  origin: (origin: string) => {
    if (origin?.includes("localhost")) return origin;
    return origin;
  },
  credentials: true,
});

const router = AutoRouter({
  before: [preflight],
  finally: [corsify],
});

authRoutes(router);
graphRoutes(router);

router.get("/health", () => Response.json({ ok: true }));

// Fall through to static assets for non-API routes
router.all("*", (request: IRequest, env: Env) =>
  env.ASSETS.fetch(new Request(request.url, {
    method: request.method,
    headers: request.headers,
  })),
);

export default {
  fetch: (request: Request, env: Env, ctx: ExecutionContext) =>
    router.fetch(request, env, ctx),
} satisfies ExportedHandler<Env>;
