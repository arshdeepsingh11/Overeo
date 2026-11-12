import { knowledgePack } from "@/agents/knowledge-pack";

/* GET /api/agents/knowledge — OVEREO's knowledge pack as Markdown
   (for Xevyo's knowledge base). Public content only: no user data. */
export const runtime = "nodejs";
export const dynamic = "force-static";
export async function GET() {
  return new Response(knowledgePack(), { headers: { "content-type": "text/markdown; charset=utf-8", "cache-control": "public, max-age=3600", "content-disposition": 'inline; filename="overeo-knowledge.md"' } });
}
