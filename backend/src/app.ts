import { db } from "./db/db.js";
import { Router, handler } from "./http/kit.js";
import { authRoutes } from "./routes/auth.js";
import { profileRoutes } from "./routes/profiles.js";
import { dataRoutes } from "./routes/data.js";

export function buildApp(log?: (l: Record<string, unknown>) => void) {
  const r = new Router();
  r.get("/v1/health", async () => {
    const t = Date.now();
    await db().query("SELECT 1");
    return { ok: true, db: db().name, dbMs: Date.now() - t, version: "1.0.0" };
  });
  authRoutes(r);
  profileRoutes(r);
  dataRoutes(r);
  return handler(r, log);
}
