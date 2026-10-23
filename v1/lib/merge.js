// Family doc merge: last-writer-wins per item (field u = ms timestamp). Tombstones via deleted:true.
export function emptyDoc() { return { meta: { child: "", timetable: {}, u: 0 }, items: {} }; }
export function mergeDocs(a, b) {
  a = a || emptyDoc(); b = b || emptyDoc();
  const out = { meta: (b.meta?.u || 0) > (a.meta?.u || 0) ? b.meta : a.meta, items: { ...a.items } };
  for (const [id, it] of Object.entries(b.items || {})) if (!out.items[id] || (it.u || 0) > (out.items[id].u || 0)) out.items[id] = it;
  return out;
}
export const CODE_RE = /^[A-HJ-NP-Z2-9]{8}$/;
export function newCode(rand = Math.random) {
  const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 8 }, () => A[Math.floor(rand() * A.length)]).join("");
}
