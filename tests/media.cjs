const assert = require("node:assert/strict");
const M = require("../simple/media.js");

async function check(store) {
  assert.equal(await store.put("p-one", "jpeg-bytes"), "p-one");
  assert.equal(await store.put("v-one", "webm-bytes"), "v-one");
  assert.equal(await store.get("p-one"), "jpeg-bytes");
  assert.equal(await store.get("v-one"), "webm-bytes");
  assert.equal(await store.get("missing"), null);
  await store.remove("p-one");
  assert.equal(await store.get("p-one"), null);
  assert.equal(await store.get("v-one"), "webm-bytes");
}

check(M.memoryStore())
  .then(function () { return M.bindStore(M.fakeDb()); })
  .then(check)
  .then(function () { console.log("media store ok"); })
  .catch(function (error) { console.error(error); process.exit(1); });
