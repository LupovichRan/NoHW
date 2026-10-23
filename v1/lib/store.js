// Family store drivers. Supabase (RPC via REST) when SUPABASE_URL + SUPABASE_KEY are set; else a local JSON file (dev) or memory.
import { mergeDocs, emptyDoc } from "./merge.js";

export function makeStore(env = process.env) {
  if (env.SUPABASE_URL && env.SUPABASE_KEY) {
    const call = async (fn, args) => {
      const r = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/${fn}`, {
        method: "POST",
        headers: { apikey: env.SUPABASE_KEY, authorization: `Bearer ${env.SUPABASE_KEY}`, "content-type": "application/json" },
        body: JSON.stringify(args),
      });
      if (!r.ok) throw new Error(`store ${r.status}`);
      const t = await r.text();
      return t ? JSON.parse(t) : null;
    };
    return {
      name: "supabase",
      get: async (code) => (await call("nohw_get_family", { p_code: code })) || null,
      put: async (code, doc) => { await call("nohw_put_family", { p_code: code, p_doc: doc }); },
    };
  }
  const mem = new Map();
  const file = env.NOHW_STORE_FILE;
  let fs = null;
  const load = async () => {
    if (!file) return;
    fs = fs || (await import("node:fs"));
    if (!mem.size && fs.existsSync(file)) for (const [k, v] of Object.entries(JSON.parse(fs.readFileSync(file, "utf8")))) mem.set(k, v);
  };
  return {
    name: file ? "file" : "memory",
    get: async (code) => { await load(); return mem.get(code) || null; },
    put: async (code, doc) => { await load(); mem.set(code, doc); if (file) fs.writeFileSync(file, JSON.stringify(Object.fromEntries(mem))); },
  };
}

export async function syncFamily(store, code, incoming) {
  const cur = (await store.get(code)) || emptyDoc();
  const next = incoming ? mergeDocs(cur, incoming) : cur;
  if (incoming) await store.put(code, next);
  return next;
}
