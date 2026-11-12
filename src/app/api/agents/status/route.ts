import { xevyoConfigured } from "@/server/xevyo";

/* GET /api/agents/status — is the live brain set up? (never reveals the key) */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  return new Response(JSON.stringify({ provider: "xevyo", live: xevyoConfigured() }), { headers: { "content-type": "application/json", "cache-control": "no-store" } });
}
