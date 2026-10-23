// POST /api/extract  { post: {text, date, photos, images?: [dataURL], prevSubject?, sender?}, timetable }
// Uses Gemini when GEMINI_API_KEY is set on the server; otherwise the built-in Hebrew rules.
import { extractRules } from "../lib/core.js";
import { extractGemini } from "../lib/gemini.js";

export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: "bad json" }, { status: 400 }); }
  const post = body?.post;
  if (!post || typeof post.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(post.date)) return Response.json({ error: "post.date required" }, { status: 400 });
  post.text = String(post.text || "").slice(0, 6000);
  const ctx = { timetable: body.timetable || {} };
  const key = process.env.GEMINI_API_KEY;
  if (key) {
    try { return Response.json({ provider: "gemini", ...(await extractGemini(post, ctx, { key, model: process.env.GEMINI_MODEL || undefined })) }); }
    catch (e) { return Response.json({ provider: "rules", fallback: String(e.message || e), ...extractRules(post, ctx) }); }
  }
  return Response.json({ provider: "rules", ...extractRules(post, ctx) });
}
export function GET() {
  return Response.json({ provider: process.env.GEMINI_API_KEY ? "gemini" : "rules" });
}
