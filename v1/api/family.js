// GET /api/family?code=XXXXXXXX -> doc ;  POST /api/family {code, doc} -> merged doc
// The 8-char code is the family's shared secret. Only item text and done-state are stored; photos never leave the phone.
import { makeStore, syncFamily } from "../lib/store.js";
import { CODE_RE } from "../lib/merge.js";

const store = makeStore();
const bad = (m, s = 400) => Response.json({ error: m }, { status: s });

export async function GET(request) {
  const code = new URL(request.url).searchParams.get("code") || "";
  if (!CODE_RE.test(code)) return bad("bad code");
  try { return Response.json({ store: store.name, doc: await syncFamily(store, code, null) }); } catch { return bad("store unavailable", 502); }
}
export async function POST(request) {
  let b;
  try { b = await request.json(); } catch { return bad("bad json"); }
  if (!CODE_RE.test(b?.code || "")) return bad("bad code");
  const s = JSON.stringify(b.doc || {});
  if (s.length > 400_000) return bad("too big", 413);
  try { return Response.json({ store: store.name, doc: await syncFamily(store, b.code, b.doc) }); } catch { return bad("store unavailable", 502); }
}
