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
router.all("*", () => new Response("Not Found", { status: 404 }));

export default {
  fetch: (request: Request, env: Env, ctx: ExecutionContext) =>
    router.fetch(request, env, ctx),
} satisfies ExportedHandler<Env>;
