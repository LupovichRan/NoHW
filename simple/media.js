(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.NohwMedia = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const DB = "nohw-simple-media";
  const BOX = "blobs";

  function bindStore(db) {
    function run(mode, fn) {
      return new Promise(function (resolve, reject) {
        let req;
        try {
          req = fn(db.transaction(BOX, mode).objectStore(BOX));
        } catch (error) {
          reject(error);
          return;
        }
        req.onsuccess = function () { resolve(req.result); };
        req.onerror = function () { reject(req.error || new Error("save")); };
      });
    }
    return {
      put: function (id, blob) {
        return run("readwrite", function (box) { return box.put(blob, id); }).then(function () { return id; });
      },
      get: function (id) {
        return run("readonly", function (box) { return box.get(id); }).then(function (value) { return value == null ? null : value; });
      },
      remove: function (id) {
        return run("readwrite", function (box) { return box.delete(id); }).then(function () {});
      }
    };
  }
  function openStore(factory) {
    const idb = factory || (typeof indexedDB !== "undefined" ? indexedDB : null);
    if (!idb) return Promise.reject(new Error("save"));
    return new Promise(function (resolve, reject) {
      const req = idb.open(DB, 1);
      req.onupgradeneeded = function () {
        const db = req.result;
        if (!db.objectStoreNames.contains(BOX)) db.createObjectStore(BOX);
      };
      req.onsuccess = function () { resolve(bindStore(req.result)); };
      req.onerror = function () { reject(req.error || new Error("save")); };
    });
  }
  function memoryStore() {
    const map = new Map();
    return {
      put: function (id, blob) { map.set(id, blob); return Promise.resolve(id); },
      get: function (id) { return Promise.resolve(map.has(id) ? map.get(id) : null); },
      remove: function (id) { map.delete(id); return Promise.resolve(); }
    };
  }
  function fakeDb() {
    const map = new Map();
    function request(read, write) {
      const req = {};
      queueMicrotask(function () {
        try {
          if (write) write();
          req.result = read();
          if (req.onsuccess) req.onsuccess();
        } catch (error) {
          req.error = error;
          if (req.onerror) req.onerror();
        }
      });
      return req;
    }
    return {
      transaction: function () {
        return {
          objectStore: function () {
            return {
              put: function (value, key) { return request(function () { return key; }, function () { map.set(key, value); }); },
              get: function (key) { return request(function () { return map.has(key) ? map.get(key) : undefined; }, function () {}); },
              delete: function (key) { return request(function () { return undefined; }, function () { map.delete(key); }); }
            };
          }
        };
      }
    };
  }

  return { bindStore: bindStore, openStore: openStore, memoryStore: memoryStore, fakeDb: fakeDb };
});
